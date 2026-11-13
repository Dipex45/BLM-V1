import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import express, { NextFunction, Request, Response } from "express";
import path from "node:path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { z } from "zod";
import Stripe from "stripe";
import axios from "axios";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { DecodedIdToken, getAuth as getAdminAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import * as Sentry from "@sentry/node";
import { company } from "./src/lib/company";
import { calculateBookingQuote, needsRouteDistance, serviceKind } from "./src/lib/bookingPricing";
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_TRACKING_LOCATIONS,
  convertFromNgn as convertWithRates,
  resolveCurrencyRates,
  resolvePricingCatalog,
  type PublicCatalog,
} from "./src/lib/catalog";

type Role =
  | "super_admin"
  | "dispatcher"
  | "finance_admin"
  | "customer_support_agent"
  | "driver"
  | "customer";

type AuthenticatedUser = {
  uid: string;
  email: string | null;
  role: Role;
  emailVerified: boolean;
  token: DecodedIdToken;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_EMAIL_FROM = process.env.NOTIFICATION_EMAIL_FROM || "BLM Motors <bookings@blmmotors.ng>";

/** Without these the live site cannot work, so the server refuses to start. */
const requiredProductionKeys = ["APP_URL", "CORS_ORIGINS"];

/** Each of these switches on one feature. When missing, that feature is simply turned off. */
const optionalEnvironmentKeys: Record<string, string> = {
  REDIS_URL: "background jobs run inline instead of on a queue",
  PAYSTACK_SECRET_KEY: "Paystack payments are hidden",
  STRIPE_SECRET_KEY: "card payments are hidden",
  VITE_STRIPE_PUBLISHABLE_KEY: "card payments are hidden",
  STRIPE_WEBHOOK_SECRET: "card payments are only confirmed when the customer returns to the site",
  RESEND_API_KEY: "emails are not sent",
  NOTIFICATION_EMAIL_FROM: "emails use the default sender",
  SUPPORT_ALERT_EMAIL: "support alerts go to bookings@blmmotors.ng",
  TWILIO_ACCOUNT_SID: "SMS and WhatsApp messages are not sent",
  TWILIO_AUTH_TOKEN: "SMS and WhatsApp messages are not sent",
  TWILIO_FROM_NUMBER: "SMS messages are not sent",
  TWILIO_WHATSAPP_FROM: "WhatsApp messages are not sent",
  GOOGLE_MAPS_PLATFORM_KEY: "customers type an estimated distance instead of a road distance",
  SENTRY_DSN: "errors are only written to the server log",
};

/** Treat obvious placeholder values ("placeholder", "changeme", "xxx") as not set. */
function envValue(key: string) {
  const value = process.env[key]?.trim() || "";
  return /^(placeholder|changeme|change-me|your[-_]|xxx|todo)/i.test(value) ? "" : value;
}

/**
 * The browser and the server MUST talk to the same Firebase project and Firestore
 * database, otherwise ID tokens fail verification and each side reads different data.
 * Both resolve from VITE_FIREBASE_* env vars first, then firebase-applet-config.json.
 */
type FirebaseWebConfig = { projectId: string; firestoreDatabaseId: string };

function loadFirebaseWebConfig(): FirebaseWebConfig {
  let fileConfig: Record<string, string> = {};
  try {
    fileConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
  } catch {
    fileConfig = {};
  }
  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID?.trim() || fileConfig.projectId || "",
    firestoreDatabaseId:
      process.env.VITE_FIRESTORE_DATABASE_ID?.trim() || fileConfig.firestoreDatabaseId || "(default)",
  };
}

const firebaseWebConfig = loadFirebaseWebConfig();

function readServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    log("error", "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
}

function validateEnvironment() {
  const required = requiredProductionKeys.filter((key) => !envValue(key));
  if (!firebaseWebConfig.projectId) required.push("VITE_FIREBASE_PROJECT_ID (or firebase-applet-config.json projectId)");
  if (!readServiceAccount() && !process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    required.push("FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS");
  }
  const optional = Object.keys(optionalEnvironmentKeys).filter((key) => !envValue(key));
  for (const key of optional) log("warn", `${key} is not set: ${optionalEnvironmentKeys[key]}`);
  if (isProduction && required.length > 0) {
    throw new Error(`Missing required production settings: ${required.join(", ")}`);
  }
  return [...required, ...optional];
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || (isProduction ? 0.15 : 1)),
  });
}

const BookingStatusSchema = z.enum([
  "Quoted",
  "Booked",
  "Paid",
  "Confirmed",
  "Dispatched",
  "InTransit",
  "Completed",
  "Cancelled",
]);

const BookingValidationSchema = z.object({
  pickup: z.string().trim().min(1).max(200),
  destination: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  vehicleClass: z.string().trim().min(1).max(80),
  totalAmount: z.number().positive().max(50_000_000),
});

const BookingCreateSchema = BookingValidationSchema.extend({
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().trim().min(5).max(40),
  serviceType: z.string().trim().min(2).max(120),
  displayCurrency: z.string().length(3).optional(),
  isReturn: z.boolean().default(false),
  notes: z.string().trim().max(1000).default(""),
  touringPackage: z.string().trim().max(120).optional(),
  touringState: z.string().trim().max(80).optional(),
  tourGuideNeeded: z.boolean().optional(),
  internationalCountry: z.string().trim().max(80).optional(),
  passengerCount: z.number().int().min(1).max(50).optional(),
  borderClearanceHelp: z.boolean().optional(),
  logisticsDetails: z.string().trim().max(2000).optional(),
  packageWeightKg: z.number().positive().max(100_000).optional(),
  carHireVehicle: z.string().trim().max(120).optional(),
  carHireDurationDays: z.number().int().min(1).max(365).optional(),
  carHireWithDriver: z.boolean().optional(),
  pickupHub: z.string().trim().max(200).optional(),
  distanceKm: z.number().positive().max(50_000).optional(),
  pricingSnapshot: z.record(z.string(), z.unknown()).optional(),
}).omit({ totalAmount: true });

const SupportedCurrencySchema = z.enum(["NGN", "XOF", "GHS", "USD", "EUR", "GBP"]);

const QuoteSchema = z.object({
  serviceType: z.string().trim().min(2).max(120),
  vehicleClass: z.string().trim().max(80).default(""),
  pickup: z.string().trim().max(200).default(""),
  destination: z.string().trim().max(200).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  isReturn: z.boolean().default(false),
  touringPackage: z.string().trim().max(120).optional(),
  touringState: z.string().trim().max(80).optional(),
  tourGuideNeeded: z.boolean().optional(),
  internationalCountry: z.string().trim().max(80).optional(),
  passengerCount: z.number().int().min(1).max(50).optional(),
  borderClearanceHelp: z.boolean().optional(),
  packageWeightKg: z.number().positive().max(100_000).optional(),
  carHireVehicle: z.string().trim().max(120).optional(),
  carHireDurationDays: z.number().int().min(1).max(365).optional(),
  carHireWithDriver: z.boolean().optional(),
  pickupHub: z.string().trim().max(200).optional(),
  distanceKm: z.number().positive().max(50_000).optional(),
});

const NewsletterSchema = z.object({ email: z.string().trim().email().max(200) });

const ReviewStatusSchema = z.object({ status: z.enum(["published", "hidden"]) });

const DriverStatusSchema = z.object({
  state: z.enum(["approved", "suspended", "rejected", "pending_review"]),
  reason: z.string().trim().max(300).optional(),
});

const StripeIntentSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  email: z.string().email().optional(),
  currency: SupportedCurrencySchema.optional(),
});

const StripeReconcileSchema = z.object({
  paymentIntentId: z.string().trim().min(3).max(200),
});

const RefundSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  paymentIntentId: z.string().trim().min(3).max(200).optional(),
  reason: z.string().trim().max(500).optional(),
});

const PaystackInitializeSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  email: z.string().email().optional(),
  currency: SupportedCurrencySchema.optional(),
});

const ManualPaymentSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
});

const ManualProofSchema = z.object({
  paymentId: z.string().trim().min(3).max(160),
  proofOfPaymentUrl: z.string().url().max(3000),
  proofFileName: z.string().trim().min(1).max(200),
  customerNote: z.string().trim().max(500).optional(),
});

const ManualReviewSchema = z.object({
  paymentId: z.string().trim().min(3).max(160),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

const StatusUpdateSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  status: BookingStatusSchema,
  assignedDriverId: z.string().trim().min(1).max(160).optional(),
  cancellationReason: z.string().trim().max(500).optional(),
});

const DriverAssignmentSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  driverId: z.string().trim().min(3).max(160),
});

const CheckpointUpdateSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  status: BookingStatusSchema,
  location: z.string().trim().min(2).max(240),
  notes: z.string().trim().max(500).optional(),
});

/** Staff and drivers are identified by their sign-in email or Firebase UID. */
const AccountReferenceSchema = z.string().trim().min(3).max(200);

const PromoteAdminSchema = z.object({
  account: AccountReferenceSchema,
  role: z.enum(["super_admin", "dispatcher", "finance_admin", "customer_support_agent"]).default("dispatcher"),
});

const DriverOnboardingSchema = z.object({
  name: z.string().trim().min(2).max(160),
  license: z.string().trim().min(3).max(80),
  phone: z.string().trim().min(5).max(40),
  account: AccountReferenceSchema,
  vehicleId: z.string().trim().max(160).optional(),
});

const AdminSettingKeySchema = z.enum([
  "vehicle_types",
  "pricing_rules",
  "touring_packages",
  "touring_states",
  "international_tours",
  "car_hire_options",
  "tracking_locations",
  "currency_rates",
  "bank_accounts",
  "feature_flags",
  "routes",
]);

const AdminSettingUpdateSchema = z.object({ value: z.unknown() });

const PaymentReconciliationSchema = z.object({
  paymentId: z.string().trim().min(3).max(160),
  reconciled: z.boolean(),
  notes: z.string().trim().max(500).optional(),
});

const ArchiveBookingsSchema = z.object({
  olderThanDays: z.number().int().min(30).max(3650).default(90),
  reason: z.string().trim().min(5).max(500),
});

const HubSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(240),
});

const BlockedDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3).max(300),
});

const AdminDeleteSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

const DriverLocationSchema = z.object({
  bookingId: z.string().trim().max(160).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).max(240).optional(),
  accuracy: z.number().min(0).max(10_000).optional(),
});

const DriverJobActionSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  action: z.enum(["accept", "reject", "arrived", "in_transit", "completed"]),
  note: z.string().trim().max(300).optional(),
});

const DriverAvailabilitySchema = z.object({
  state: z.enum(["available", "offline"]),
});

const ReviewSubmissionSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  comment: z.string().trim().min(10).max(1500),
  photoUrls: z.array(z.string().url().max(3000)).max(4).default([]),
});

const SupportTicketCreateSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  category: z.enum(["booking", "payment", "driver", "logistics", "other"]),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  message: z.string().trim().min(10).max(3000),
  bookingId: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});

const SupportMessageSchema = z.object({
  message: z.string().trim().min(1).max(3000),
});

const SupportStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]),
  escalationLevel: z.number().int().min(0).max(3).optional(),
});

class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function log(level: "info" | "warn" | "error", message: string, context: Record<string, unknown> = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "blm-motors-api",
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid request body", parsed.error.issues);
  }
  return parsed.data;
}

function getClientIp(req: Request) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function parseCookies(req: Request) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  const token = req.get("x-csrf-token");
  const cookieToken = parseCookies(req).blm_csrf;
  if (!token || !cookieToken || !constantTimeEqual(token, cookieToken)) {
    throw new HttpError(403, "Your security check expired. Please refresh the page and try again.");
  }
  next();
}

function getAllowedOrigins() {
  const configured = process.env.CORS_ORIGINS || process.env.APP_URL || "";
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

let stripeClient: Stripe | null = null;
function getStripe() {
  if (!stripeClient) {
    const key = envValue("STRIPE_SECRET_KEY");
    if (!key) throw new HttpError(503, "Card payments aren’t set up yet. Please choose another way to pay.");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0];

  const projectId = firebaseWebConfig.projectId;
  const serviceAccount = readServiceAccount();
  // Customers see a plain message; the technical reason goes to the server log and /api/health.
  const unavailable = (reason: string) => {
    log("error", `Firebase Admin unavailable: ${reason}`);
    return new HttpError(503, "Online booking is temporarily unavailable. Please try again shortly, or book with us on WhatsApp.");
  };
  if (serviceAccount?.project_id && projectId && serviceAccount.project_id !== projectId) {
    throw unavailable(`service account belongs to "${serviceAccount.project_id}" but the web app signs users into "${projectId}". Use a service account from the same project.`);
  }
  if (process.env.FIREBASE_PROJECT_ID && projectId && process.env.FIREBASE_PROJECT_ID !== projectId) {
    log("warn", "FIREBASE_PROJECT_ID differs from the web app project and is ignored", {
      configured: process.env.FIREBASE_PROJECT_ID,
      webProject: projectId,
    });
  }
  if (!serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    throw unavailable("credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
  }

  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount as any) : applicationDefault(),
    projectId: projectId || serviceAccount?.project_id,
  });
}

let adminDb: FirebaseFirestore.Firestore | null = null;
function getAdminDb() {
  if (!adminDb) {
    const databaseId = firebaseWebConfig.firestoreDatabaseId;
    adminDb = databaseId && databaseId !== "(default)"
      ? getFirestore(initializeFirebaseAdmin(), databaseId)
      : getFirestore(initializeFirebaseAdmin());
    adminDb.settings({ ignoreUndefinedProperties: true });
  }
  return adminDb;
}

async function getFeatureFlags() {
  const snapshot = await getAdminDb().collection("settings").doc("feature_flags").get();
  const value = snapshot.data()?.value;
  return { ...DEFAULT_FEATURE_FLAGS, ...(value && typeof value === "object" ? value : {}) };
}

async function getPricingCatalog() {
  const settings = getAdminDb().collection("settings");
  const [rules, vehicles, packages, states, countries, cars] = await Promise.all(
    ["pricing_rules", "vehicle_types", "touring_packages", "touring_states", "international_tours", "car_hire_options"].map(
      (key) => settings.doc(key).get(),
    ),
  );
  return resolvePricingCatalog({
    rules: rules.data()?.value,
    vehicles: vehicles.data()?.value,
    touringPackages: packages.data()?.value,
    touringStates: states.data()?.value,
    internationalTours: countries.data()?.value,
    carHireOptions: cars.data()?.value,
  });
}

async function getCurrencyRates() {
  const snapshot = await getAdminDb().collection("settings").doc("currency_rates").get();
  return resolveCurrencyRates(snapshot.data()?.value);
}

async function getActiveHubs() {
  const snapshot = await getAdminDb().collection("hubs").get();
  const hubs = snapshot.docs
    .map((document): Record<string, any> => ({ id: document.id, ...document.data() }))
    .filter((hub) => hub.active !== false)
    .map((hub) => ({ id: hub.id, name: String(hub.name || ""), address: String(hub.address || ""), active: true }))
    .filter((hub) => hub.name);
  return hubs.length ? hubs : company.hubs.map((hub) => ({ ...hub, active: true }));
}

async function getBankConfig() {
  const snapshot = await getAdminDb().collection("settings").doc("bank_accounts").get();
  const value = snapshot.data()?.value || {};
  const config = {
    bankName: String(value.bankName || ""),
    accountName: String(value.accountName || ""),
    accountNumber: String(value.accountNumber || ""),
    branchName: String(value.branchName || ""),
    currency: String(value.currency || "NGN"),
    instructions: String(value.instructions || "Transfer the exact amount and use your payment reference as the narration."),
    deadlineHours: Math.max(Number(value.deadlineHours || 24), 1),
    contactPhone: String(value.contactPhone || "+2349064090276"),
    contactEmail: String(value.contactEmail || "bookings@blmmotors.ng"),
    referencePrefix: String(value.referencePrefix || "BLM").replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "BLM",
    requireProofUpload: value.requireProofUpload !== false,
  };
  return { ...config, configured: Boolean(config.bankName && config.accountName && config.accountNumber) };
}

async function getRouteDistance(origin: string, destination: string) {
  const key = envValue("GOOGLE_MAPS_PLATFORM_KEY");
  if (!key) return null;
  const response = await axios.get("https://maps.googleapis.com/maps/api/distancematrix/json", {
    params: { origins: origin, destinations: destination, mode: "driving", departure_time: "now", key },
    timeout: 12_000,
  });
  const element = response.data?.rows?.[0]?.elements?.[0];
  if (response.data?.status !== "OK" || element?.status !== "OK") {
    throw new HttpError(422, "We couldn’t find a road route between those places. Please check the addresses.");
  }
  return {
    distanceKm: Number((Number(element.distance.value) / 1000).toFixed(1)),
    distanceMeters: Number(element.distance.value),
    durationSeconds: Number(element.duration_in_traffic?.value || element.duration?.value || 0),
    distanceText: String(element.distance.text || ""),
    durationText: String(element.duration_in_traffic?.text || element.duration?.text || ""),
  };
}

type QuoteInput = z.infer<typeof QuoteSchema>;

/** Route distance cache so quote previews and the final booking use the identical Maps result. */
const routeCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof getRouteDistance>> }>();
async function cachedRouteDistance(origin: string, destination: string) {
  const key = `${origin.toLowerCase()}|${destination.toLowerCase()}`;
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.value;
  const value = await getRouteDistance(origin, destination);
  routeCache.set(key, { at: Date.now(), value });
  if (routeCache.size > 500) routeCache.delete(routeCache.keys().next().value as string);
  return value;
}

async function calculateAuthoritativeQuote(input: QuoteInput) {
  const [catalog, hubs] = await Promise.all([getPricingCatalog(), getActiveHubs()]);
  const kind = serviceKind(input.serviceType);
  let routeMetadata: Awaited<ReturnType<typeof getRouteDistance>> = null;

  if (kind === "distance") {
    const vehicle = catalog.vehicles.find((item) => item.title.toLowerCase() === input.vehicleClass.toLowerCase());
    if (!vehicle) throw new HttpError(422, "That car type is no longer available. Please pick another.");
  } else if (kind === "car_hire") {
    const car = catalog.carHireOptions.find((item) => item.id === input.carHireVehicle);
    if (!car) throw new HttpError(422, "That hire car is no longer available. Please pick another.");
    if (!car.available) throw new HttpError(409, "That hire car is booked out right now. Please pick another.");
    if (input.pickupHub && !hubs.some((hub) => hub.name === input.pickupHub)) {
      throw new HttpError(422, "That pickup point is no longer available. Please pick another.");
    }
  } else if (kind === "touring") {
    if (!catalog.touringPackages.some((item) => item.id === input.touringPackage)) throw new HttpError(422, "That tour is no longer available. Please pick another.");
    if (!catalog.touringStates.some((item) => item.name === input.touringState)) throw new HttpError(422, "That state is no longer available for tours. Please pick another.");
  } else if (kind === "cross_border") {
    if (!catalog.internationalTours.some((item) => item.name === input.internationalCountry)) throw new HttpError(422, "We no longer go to that country. Please pick another.");
  }

  if (needsRouteDistance(kind) && input.pickup.length >= 3 && input.destination.length >= 3) {
    routeMetadata = await cachedRouteDistance(input.pickup, input.destination);
  }
  if (needsRouteDistance(kind) && !routeMetadata && !input.distanceKm) {
    throw new HttpError(422, "Please enter where you’re going from and to.");
  }

  const quote = calculateBookingQuote(
    { ...input, distanceKm: routeMetadata?.distanceKm || input.distanceKm },
    catalog,
  );
  return { ...quote, kind, distanceSource: routeMetadata ? "google_maps" : needsRouteDistance(kind) ? "customer_estimate" : null, routeMetadata };
}

function getFirebaseAuth() {
  return getAdminAuth(initializeFirebaseAdmin());
}

const adminRoles: Role[] = ["super_admin", "dispatcher", "finance_admin", "customer_support_agent"];

function hasRole(user: AuthenticatedUser, roles: Role[]) {
  return roles.includes(user.role) || user.role === "super_admin";
}

/**
 * Privileged roles come only from server-controlled sources: the `admins` collection
 * (written exclusively by this API) or custom claims set by this API. The `users`
 * document is client-writable at creation, so it may only grant `driver`/`customer`.
 */
async function resolveRole(decoded: DecodedIdToken): Promise<Role> {
  const db = getAdminDb();
  const adminDoc = await db.collection("admins").doc(decoded.uid).get();
  if (adminDoc.exists) {
    const storedRole = adminDoc.data()?.role;
    if (typeof storedRole === "string" && isRole(storedRole)) return normalizeRole(storedRole);
  }

  const claimRole = decoded.role;
  if (claimRole === "driver") return "driver";

  const driverDoc = await db.collection("drivers").doc(decoded.uid).get();
  if (driverDoc.exists) return "driver";
  return "customer";
}

function isRole(role: string): role is Role | "admin" {
  return ["admin", "super_admin", "dispatcher", "finance_admin", "customer_support_agent", "driver", "customer"].includes(
    role,
  );
}

function normalizeRole(role: string): Role {
  return role === "admin" ? "super_admin" : (role as Role);
}

function sessionIdForRequest(req: Request, userId: string) {
  const userAgent = req.get("user-agent") || "unknown";
  const ip = getClientIp(req);
  return crypto.createHash("sha256").update(`${userId}:${ip}:${userAgent}`).digest("hex");
}

async function recordSession(req: Request, auth: AuthenticatedUser) {
  const userAgent = req.get("user-agent") || "unknown";
  const ip = getClientIp(req);
  const sessionId = sessionIdForRequest(req, auth.uid);
  const ref = getAdminDb().collection("user_sessions").doc(sessionId);
  const existing = await ref.get();
  if (existing.data()?.revoked === true) throw new HttpError(401, "This device was signed out. Please sign in again.");

  await ref.set(
      {
        userId: auth.uid,
        email: auth.email,
        role: auth.role,
        ip,
        userAgent,
        ...(existing.exists ? {} : { revoked: false, createdAt: FieldValue.serverTimestamp() }),
        lastSeenAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

async function buildAuthenticatedUser(req: Request, enforceEmailVerified = true): Promise<AuthenticatedUser> {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Please sign in first.");
  }

  const token = header.slice("Bearer ".length).trim();
  const decoded = await getFirebaseAuth().verifyIdToken(token, true);
  const role = await resolveRole(decoded);
  const auth: AuthenticatedUser = {
    uid: decoded.uid,
    email: decoded.email || null,
    emailVerified: decoded.email_verified === true,
    role,
    token: decoded,
  };

  if (enforceEmailVerified && !auth.emailVerified && auth.role === "customer") {
    throw new HttpError(403, "Please confirm your email address first. Check your inbox for the link.");
  }

  await recordSession(req, auth);
  return auth;
}

function authenticate(req: Request, _res: Response, next: NextFunction) {
  buildAuthenticatedUser(req)
    .then((auth) => {
      req.auth = auth;
      next();
    })
    .catch(next);
}

function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new HttpError(401, "Please sign in first.");
    if (!hasRole(req.auth, roles)) {
      throw new HttpError(403, "You don’t have permission to do this.");
    }
    next();
  };
}

async function persistAudit(
  req: Request,
  action: string,
  resource: string,
  metadata: Record<string, unknown> = {},
  before?: unknown,
  after?: unknown,
) {
  try {
    await getAdminDb().collection("audit_logs").add({
      actorId: req.auth?.uid || "system",
      actorEmail: req.auth?.email || null,
      actorRole: req.auth?.role || "system",
      action,
      resource,
      metadata,
      before: before || null,
      after: after || null,
      ip: getClientIp(req),
      userAgent: req.get("user-agent") || "unknown",
      rollback: {
        supported: false,
        reason: "Operational rollback requires a domain-specific compensating action.",
      },
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    log("error", "Audit persistence failed", { action, resource, error: String(error) });
  }
}

type QueueJobName =
  | "notification.deliver"
  | "payment.reconcile"
  | "dispatch.assign";

class OperationsQueue {
  enabled = false;
  connection: IORedis | null = null;
  queue: Queue | null = null;
  deadLetterQueue: Queue | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      log("warn", "REDIS_URL missing; background jobs will run inline and health will report degraded");
      return;
    }

    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
    let lastErrorLog = 0;
    this.connection.on("error", (error) => {
      // Log at most once a minute instead of on every reconnect attempt.
      if (Date.now() - lastErrorLog < 60_000) return;
      lastErrorLog = Date.now();
      log("error", "Redis is unreachable; background jobs will run directly until it reconnects", { error: error.message });
    });
    this.queue = new Queue("blm-ops", { connection: this.connection });
    this.deadLetterQueue = new Queue("blm-ops-dead-letter", { connection: this.connection });
    this.enabled = true;

    const worker = new Worker(
      "blm-ops",
      async (job) => {
        await processQueueJob(job.name as QueueJobName, job.data);
      },
      { connection: this.connection },
    );

    // Connection errors are already reported (throttled) by the Redis client above.
    worker.on("error", () => undefined);
    this.queue.on("error", () => undefined);
    this.deadLetterQueue.on("error", () => undefined);

    worker.on("failed", async (job, error) => {
      log("error", "Queue job failed", {
        jobId: job?.id,
        name: job?.name,
        attempts: job?.attemptsMade,
        error: error.message,
      });

      if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
        await this.deadLetterQueue?.add(job.name, {
          originalJobId: job.id,
          payload: job.data,
          error: error.message,
          failedAt: new Date().toISOString(),
        });
      }
    });
  }

  get connected() {
    return this.enabled && this.connection?.status === "ready";
  }

  /**
   * Queue a job, or run it straight away when Redis is not configured or not reachable.
   * A failing side job (an email or SMS) must never fail the customer's booking or payment.
   */
  async enqueue(name: QueueJobName, data: Record<string, unknown>, attempts = 3) {
    if (this.queue && this.connected) {
      try {
        return await this.queue.add(name, data, {
          attempts,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 1_000,
          removeOnFail: false,
        });
      } catch (error) {
        log("warn", "Could not queue job; running it directly", { name, error: String(error) });
      }
    }
    try {
      await processQueueJob(name, data);
    } catch (error) {
      log("error", "Background job failed", { name, error: error instanceof Error ? error.message : String(error) });
    }
    return { inline: true };
  }
}

let operationsQueue: OperationsQueue;

async function processQueueJob(name: QueueJobName, data: Record<string, unknown>) {
  if (name === "notification.deliver") {
    await deliverNotification(String(data.notificationId));
    return;
  }

  if (name === "payment.reconcile") {
    const provider = String(data.provider);
    if (provider === "stripe" && data.paymentIntentId) {
      const intent = await getStripe().paymentIntents.retrieve(String(data.paymentIntentId));
      await reconcileStripePayment(intent, String(data.eventId || "manual-reconciliation"));
    }
    if (provider === "paystack" && data.reference) {
      await reconcilePaystackReference(String(data.reference), String(data.eventId || "manual-reconciliation"));
    }
    return;
  }

  if (name === "dispatch.assign") {
    const bookingId = z.string().trim().min(3).max(160).parse(data.bookingId);
    const rejectedDriverId = data.rejectedDriverId ? String(data.rejectedDriverId) : "";
    const bookingRef = getAdminDb().collection("bookings").doc(bookingId);
    const booking = await bookingRef.get();
    if (!booking.exists || booking.data()?.assignedDriverId) return;
    const available = await getAdminDb().collection("drivers").where("availability.state", "==", "available").limit(20).get();
    const chosen = available.docs.find((driver) => driver.id !== rejectedDriverId);
    if (!chosen) {
      await bookingRef.set({ dispatchQueue: { state: "waiting_for_driver", queuedAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    const batch = getAdminDb().batch();
    batch.update(bookingRef, {
      assignedDriverId: chosen.id,
      status: "Confirmed",
      dispatchQueue: { state: "assigned", assignedAt: FieldValue.serverTimestamp() },
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(chosen.ref, { assignedJobs: FieldValue.arrayUnion(bookingId), "availability.state": "assigned", updatedAt: FieldValue.serverTimestamp() });
    batch.set(getAdminDb().collection("booking_events").doc(), { bookingId, type: "dispatch.assigned", actorId: "system", actorRole: "system", metadata: { driverId: chosen.id }, createdAt: FieldValue.serverTimestamp() });
    await batch.commit();
    await queueCustomerStatusNotifications(bookingId, booking.data() || {}, "Confirmed");
    return;
  }

  throw new Error(`Unsupported queue job: ${name}`);
}

async function queueNotification(input: {
  channel: "email" | "sms" | "whatsapp";
  to: string;
  subject?: string;
  body: string;
  template: string;
  metadata?: Record<string, unknown>;
}) {
  const doc = await getAdminDb().collection("notification_logs").add({
    ...input,
    provider: input.channel === "email" ? "resend" : input.channel === "whatsapp" ? "twilio_whatsapp" : "twilio",
    status: "queued",
    attempts: 0,
    deliveryState: "pending",
    retries: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await operationsQueue.enqueue("notification.deliver", { notificationId: doc.id });
  return doc.id;
}

async function deliverNotification(notificationId: string) {
  const db = getAdminDb();
  const ref = db.collection("notification_logs").doc(notificationId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const notification = snap.data() || {};
  await ref.update({
    status: "processing",
    attempts: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const providerMessageId =
      notification.channel === "email"
        ? await sendEmailViaResend(String(notification.to), String(notification.subject || "BLM Motors"), String(notification.body))
        : await sendTwilioMessage(String(notification.to), String(notification.body), notification.channel === "whatsapp");

    await ref.update({
      providerMessageId,
      status: providerMessageId === "provider_not_configured" ? "provider_not_configured" : "sent",
      deliveryState: providerMessageId === "provider_not_configured" ? "blocked" : "accepted",
      sentAt: providerMessageId === "provider_not_configured" ? null : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await ref.update({
      status: "failed",
      deliveryState: "failed",
      retries: FieldValue.arrayUnion({ at: new Date().toISOString(), error: String(error) }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw error;
  }
}

async function sendEmailViaResend(to: string, subject: string, body: string) {
  const apiKey = envValue("RESEND_API_KEY");
  if (!apiKey) {
    log("warn", "RESEND_API_KEY missing; email notification blocked", { to, subject });
    return "provider_not_configured";
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: DEFAULT_EMAIL_FROM,
      to: [to],
      subject,
      text: body,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend delivery failed: ${JSON.stringify(payload)}`);
  }
  return payload.id || "resend_accepted";
}

async function sendTwilioMessage(to: string, body: string, whatsapp = false) {
  const sid = envValue("TWILIO_ACCOUNT_SID");
  const token = envValue("TWILIO_AUTH_TOKEN");
  const from = whatsapp ? envValue("TWILIO_WHATSAPP_FROM") : envValue("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    log("warn", `Twilio env missing; ${whatsapp ? "WhatsApp" : "SMS"} notification blocked`, { to });
    return "provider_not_configured";
  }

  const normalizedTo = whatsapp && !to.startsWith("whatsapp:") ? `whatsapp:${to}` : to;
  const normalizedFrom = whatsapp && !from.startsWith("whatsapp:") ? `whatsapp:${from}` : from;

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: normalizedFrom, To: normalizedTo, Body: body }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Twilio delivery failed: ${JSON.stringify(payload)}`);
  }
  return payload.sid || "twilio_accepted";
}

function toMinorUnits(amount: number, currency: string) {
  const zeroDecimal = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
  return zeroDecimal.has(currency.toLowerCase()) ? Math.round(amount) : Math.round(amount * 100);
}

async function convertFromNgn(amountInNgn: number, currency: z.infer<typeof SupportedCurrencySchema>) {
  return convertWithRates(amountInNgn, currency, await getCurrencyRates());
}

async function findAuthUser(account: string) {
  const auth = getFirebaseAuth();
  const user = account.includes("@")
    ? await auth.getUserByEmail(account.toLowerCase()).catch(() => null)
    : await auth.getUser(account).catch(() => null);
  if (!user) throw new HttpError(404, `There’s no BLM account for ${account}. Ask them to sign up on the website first.`);
  return user;
}

function serializeTimestamps<T extends Record<string, any>>(data: T): T {
  const output: Record<string, any> = { ...data };
  for (const [key, value] of Object.entries(output)) {
    if (value && typeof value === "object" && typeof value.toDate === "function") output[key] = value.toDate().toISOString();
  }
  return output as T;
}

async function loadBooking(bookingId: string, auth: AuthenticatedUser, adminAccessRoles: Role[] = adminRoles) {
  const ref = getAdminDb().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "We couldn’t find that booking.");
  const booking = snap.data() || {};
  const ownerId = String(booking.customerId || "");
  if (ownerId !== auth.uid && !hasRole(auth, adminAccessRoles)) {
    throw new HttpError(403, "You can only view your own bookings.");
  }
  return { ref, snap, booking };
}

async function resolveDriverForUser(uid: string) {
  const direct = await getAdminDb().collection("drivers").doc(uid).get();
  if (direct.exists) return direct;
  const linked = await getAdminDb().collection("drivers").where("authUid", "==", uid).limit(1).get();
  return linked.empty ? null : linked.docs[0];
}

async function queueCustomerStatusNotifications(bookingId: string, booking: Record<string, any>, status: string) {
  const claimRef = getAdminDb().collection("notification_claims").doc(`${bookingId}:${status.toLowerCase()}`);
  const claimed = await getAdminDb().runTransaction(async (transaction) => {
    const existing = await transaction.get(claimRef);
    if (existing.exists) return false;
    transaction.create(claimRef, { bookingId, status, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return;
  const flags = await getFeatureFlags();
  const customerName = String(booking.customerName || "Customer");
  const friendlyStatus = ({ Booked: "booked", Paid: "paid", Confirmed: "confirmed — a driver has been assigned", Dispatched: "on its way: your driver is heading to you", InTransit: "on the move", Completed: "complete. Thank you for travelling with BLM", Cancelled: "cancelled" } as Record<string, string>)[status] || status;
  const message = `Hello ${customerName}, your BLM booking ${booking.trackingId || bookingId} is ${friendlyStatus}. Track it here: ${(process.env.APP_URL || "").replace(/\/$/, "")}/tracking?booking=${encodeURIComponent(booking.trackingId || bookingId)}`;
  const phone = String(booking.customerPhone || booking.phone || "").trim();
  if (phone && flags.whatsappNotifications) {
    await queueNotification({ channel: "whatsapp", to: phone, body: message, template: "booking_status_update", metadata: { bookingId, status } });
  }
  if (phone && flags.smsNotifications) {
    await queueNotification({ channel: "sms", to: phone, body: message, template: "booking_status_update", metadata: { bookingId, status } });
  }
  if (booking.customerEmail) {
    await queueNotification({
      channel: "email",
      to: String(booking.customerEmail),
      subject: `Your BLM booking update`,
      body: message,
      template: "booking_status_update",
      metadata: { bookingId, status },
    });
  }
}

async function findExistingPayment(bookingId: string, provider: "stripe" | "paystack") {
  const snap = await getAdminDb()
    .collection("payments")
    .where("bookingId", "==", bookingId)
    .where("provider", "==", provider)
    .where("status", "in", ["initialized", "requires_action", "processing", "succeeded"])
    .limit(1)
    .get();

  return snap.empty ? null : { id: snap.docs[0].id, data: snap.docs[0].data(), ref: snap.docs[0].ref };
}

async function markPaymentSucceeded(paymentRef: FirebaseFirestore.DocumentReference, eventId: string, providerStatus: string) {
  const db = getAdminDb();
  const bookingId = await db.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) throw new HttpError(404, "We couldn’t find that payment.");
    const payment = paymentSnap.data() || {};
    const bookingRef = db.collection("bookings").doc(String(payment.bookingId));
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpError(404, "We couldn’t find that booking.");
    const booking = bookingSnap.data() || {};

    if (payment.status === "succeeded") return null;

    tx.update(paymentRef, {
      status: "succeeded",
      providerStatus,
      reconciledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      webhookEventIds: FieldValue.arrayUnion(eventId),
    });

    tx.update(bookingRef, {
      status: "Paid",
      paidAt: FieldValue.serverTimestamp(),
      paymentStatus: "succeeded",
      paymentProvider: payment.provider,
      paymentIntentId: payment.provider === "stripe" ? payment.providerPaymentId : null,
      paymentReference: payment.provider === "paystack" ? payment.providerReference : null,
      updatedAt: FieldValue.serverTimestamp(),
      "lifecycle.paidAt": FieldValue.serverTimestamp(),
      "lifecycle.lastEvent": "payment.succeeded",
    });

    const ledgerRef = db.collection("ledger_entries").doc(`${paymentRef.id}:revenue`);
    tx.set(
      ledgerRef,
      {
        paymentId: paymentRef.id,
        bookingId: payment.bookingId,
        customerId: booking.customerId,
        type: "revenue",
        direction: "credit",
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: "posted",
        eventId,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(db.collection("booking_events").doc(), {
      bookingId: payment.bookingId,
      type: "payment.succeeded",
      actorId: "system",
      actorRole: "system",
      metadata: { paymentId: paymentRef.id, provider: payment.provider, eventId },
      createdAt: FieldValue.serverTimestamp(),
    });
    if (booking.customerId) {
      tx.set(db.collection("customers").doc(String(booking.customerId)), {
        paymentHistory: FieldValue.arrayUnion(paymentRef.id),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return String(payment.bookingId);
  });
  if (bookingId) {
    const booking = await db.collection("bookings").doc(bookingId).get();
    await queueCustomerStatusNotifications(bookingId, booking.data() || {}, "Paid");
  }
}

async function markPaymentFailed(paymentRef: FirebaseFirestore.DocumentReference, eventId: string, providerStatus: string) {
  await paymentRef.update({
    status: "failed",
    providerStatus,
    reconciledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    webhookEventIds: FieldValue.arrayUnion(eventId),
  });
}

async function reconcileStripePayment(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  const db = getAdminDb();
  let paymentRef: FirebaseFirestore.DocumentReference | null = null;
  const paymentId = paymentIntent.metadata?.paymentId;

  if (paymentId) {
    paymentRef = db.collection("payments").doc(paymentId);
  } else {
    const snap = await db
      .collection("payments")
      .where("provider", "==", "stripe")
      .where("providerPaymentId", "==", paymentIntent.id)
      .limit(1)
      .get();
    paymentRef = snap.empty ? null : snap.docs[0].ref;
  }

  if (!paymentRef) {
    await db.collection("payment_reconciliation_exceptions").add({
      provider: "stripe",
      providerPaymentId: paymentIntent.id,
      status: paymentIntent.status,
      eventId,
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  if (paymentIntent.status === "succeeded") {
    await markPaymentSucceeded(paymentRef, eventId, paymentIntent.status);
  } else if (["canceled", "requires_payment_method"].includes(paymentIntent.status)) {
    await markPaymentFailed(paymentRef, eventId, paymentIntent.status);
  } else {
    await paymentRef.update({
      status: paymentIntent.status,
      providerStatus: paymentIntent.status,
      updatedAt: FieldValue.serverTimestamp(),
      webhookEventIds: FieldValue.arrayUnion(eventId),
    });
  }
}

async function reconcilePaystackReference(reference: string, eventId: string) {
  const secretKey = envValue("PAYSTACK_SECRET_KEY");
  if (!secretKey) throw new HttpError(503, "Paystack isn’t set up yet. Please choose another way to pay.");

  const response = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  const data = response.data?.data;
  const snap = await getAdminDb()
    .collection("payments")
    .where("provider", "==", "paystack")
    .where("providerReference", "==", reference)
    .limit(1)
    .get();

  if (snap.empty) {
    await getAdminDb().collection("payment_reconciliation_exceptions").add({
      provider: "paystack",
      providerReference: reference,
      status: data?.status || "unknown",
      eventId,
      createdAt: FieldValue.serverTimestamp(),
    });
    return data;
  }

  const paymentRef = snap.docs[0].ref;
  if (data?.status === "success") {
    await markPaymentSucceeded(paymentRef, eventId, data.status);
  } else {
    await markPaymentFailed(paymentRef, eventId, data?.status || "failed");
  }

  return data;
}

function contentSecurityDirectives() {
  const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const sentry = ["https://*.sentry.io"];
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    scriptSrc: ["'self'", "https://js.stripe.com", "https://*.js.stripe.com", "https://maps.googleapis.com", "https://apis.google.com", "https://www.gstatic.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    connectSrc: [
      "'self'",
      "https://*.googleapis.com",
      "https://*.firebaseio.com",
      "wss://*.firebaseio.com",
      "https://*.firebaseapp.com",
      "https://api.stripe.com",
      "https://maps.googleapis.com",
      "https://open.er-api.com",
      ...sentry,
    ],
    frameSrc: [
      "'self'",
      "https://*.firebaseapp.com",
      ...(authDomain ? [`https://${authDomain}`] : []),
      "https://js.stripe.com",
      "https://*.js.stripe.com",
      "https://hooks.stripe.com",
      "https://accounts.google.com",
      "https://appleid.apple.com",
    ],
    formAction: ["'self'", "https://checkout.paystack.com"],
    workerSrc: ["'self'", "blob:"],
    manifestSrc: ["'self'"],
    upgradeInsecureRequests: (process.env.APP_URL || "").startsWith("https://") ? [] : null,
  };
}

async function startServer() {
  const missingEnvironment = validateEnvironment();
  const app = express();
  operationsQueue = new OperationsQueue();

  const allowedOrigins = getAllowedOrigins();

  app.set("trust proxy", 1);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin denied"));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  app.use(
    helmet({
      // Explicit allow-list: the default policy would block Firebase sign-in, Firestore,
      // Stripe, Google Fonts/Maps and uploaded images on the live site.
      contentSecurityPolicy: isProduction ? { useDefaults: false, directives: contentSecurityDirectives() } : false,
      crossOriginEmbedderPolicy: false,
      // Google/Apple sign-in opens a popup that must be able to report back to this page.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json", limit: "256kb" }),
    asyncHandler(async (req, res) => {
      const secret = envValue("STRIPE_WEBHOOK_SECRET");
      if (!secret) throw new HttpError(503, "Card payment confirmations aren’t set up yet (STRIPE_WEBHOOK_SECRET).");

      const signature = req.get("stripe-signature");
      if (!signature) throw new HttpError(400, "Missing Stripe signature");

      const event = getStripe().webhooks.constructEvent(req.body, signature, secret);

      if (event.type.startsWith("payment_intent.")) {
        await reconcileStripePayment(event.data.object as Stripe.PaymentIntent, event.id);
      }

      if (event.type === "charge.dispute.created") {
        const dispute = event.data.object as Stripe.Dispute;
        await getAdminDb().collection("payment_disputes").doc(dispute.id).set(
          {
            provider: "stripe",
            status: dispute.status,
            amount: dispute.amount,
            currency: dispute.currency,
            reason: dispute.reason,
            eventId: event.id,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      res.json({ received: true });
    }),
  );

  app.post(
    "/api/webhooks/paystack",
    express.raw({ type: "application/json", limit: "256kb" }),
    asyncHandler(async (req, res) => {
      const secretKey = envValue("PAYSTACK_SECRET_KEY");
      if (!secretKey) throw new HttpError(503, "Paystack isn’t set up yet. Please choose another way to pay.");

      const signature = req.get("x-paystack-signature") || "";
      const expected = crypto.createHmac("sha512", secretKey).update(req.body).digest("hex");
      if (!constantTimeEqual(signature, expected)) {
        throw new HttpError(400, "Invalid Paystack signature");
      }

      const event = JSON.parse(req.body.toString("utf8"));
      if (event.event === "charge.success" && event.data?.reference) {
        await reconcilePaystackReference(event.data.reference, event.event);
      }

      res.json({ received: true });
    }),
  );

  app.use(express.json({ limit: "20kb" }));

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a few minutes and try again." },
  });
  const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many payment attempts. Please wait a few minutes and try again." },
  });
  const quoteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many price checks. Please wait a moment." },
  });
  app.use("/api/quote", quoteLimiter);
  app.use("/api", (req, res, next) => (req.path === "/quote" ? next() : generalLimiter(req, res, next)));

  app.get("/api/health", asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      redis: operationsQueue.connected ? "connected" : operationsQueue.enabled ? "unreachable" : "not_configured",
      queues: operationsQueue.connected ? "queue" : "running_directly",
      firebaseAdmin: readServiceAccount() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ? "configured" : "missing_credentials",
      firebaseProject: firebaseWebConfig.projectId || null,
      firestoreDatabase: firebaseWebConfig.firestoreDatabaseId,
      providers: {
        resend: Boolean(envValue("RESEND_API_KEY")),
        twilio: Boolean(envValue("TWILIO_ACCOUNT_SID") && envValue("TWILIO_AUTH_TOKEN") && envValue("TWILIO_FROM_NUMBER")),
        stripe: Boolean(envValue("STRIPE_SECRET_KEY") && envValue("STRIPE_WEBHOOK_SECRET")),
        paystack: Boolean(envValue("PAYSTACK_SECRET_KEY")),
        whatsapp: Boolean(envValue("TWILIO_ACCOUNT_SID") && envValue("TWILIO_AUTH_TOKEN") && envValue("TWILIO_WHATSAPP_FROM")),
        maps: Boolean(envValue("GOOGLE_MAPS_PLATFORM_KEY")),
        sentry: Boolean(process.env.SENTRY_DSN),
      },
      missingEnvironment: isProduction ? [] : missingEnvironment,
    });
  }));

  app.get("/api/public/config", asyncHandler(async (_req, res) => {
    const [flags, bank] = await Promise.all([getFeatureFlags(), getBankConfig()]);
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.json({
      features: flags,
      payments: {
        paystack: Boolean(flags.paystack && envValue("PAYSTACK_SECRET_KEY")),
        stripe: Boolean(flags.stripe && envValue("STRIPE_SECRET_KEY")),
        manualBankTransfer: Boolean(flags.manualBankTransfer && bank.configured),
      },
      mapsEnabled: Boolean(flags.liveTracking && envValue("GOOGLE_MAPS_PLATFORM_KEY")),
    });
  }));

  /** Everything the public site needs to show prices, fleet and options. */
  app.get("/api/public/catalog", asyncHandler(async (_req, res) => {
    const settings = getAdminDb().collection("settings");
    const today = new Date().toISOString().slice(0, 10);
    const [catalog, hubs, rates, flags, bank, routesSnap, trackingSnap, blockedSnap] = await Promise.all([
      getPricingCatalog(),
      getActiveHubs(),
      getCurrencyRates(),
      getFeatureFlags(),
      getBankConfig(),
      settings.doc("routes").get(),
      settings.doc("tracking_locations").get(),
      getAdminDb().collection("blocked_dates").where("date", ">=", today).get(),
    ]);
    const stringList = (value: unknown, fallback: string[]) =>
      Array.isArray(value) && value.length ? value.map(String).filter(Boolean) : fallback;
    const body: PublicCatalog = {
      ...catalog,
      hubs,
      currencyRates: rates,
      blockedDates: blockedSnap.docs.map((document) => String(document.data().date)).sort(),
      routes: stringList(routesSnap.data()?.value, company.routes),
      trackingLocations: stringList(trackingSnap.data()?.value, DEFAULT_TRACKING_LOCATIONS),
      mapsEnabled: Boolean(envValue("GOOGLE_MAPS_PLATFORM_KEY")),
      features: flags,
      payments: {
        paystack: Boolean(flags.paystack && envValue("PAYSTACK_SECRET_KEY")),
        stripe: Boolean(flags.stripe && envValue("STRIPE_SECRET_KEY") && envValue("VITE_STRIPE_PUBLISHABLE_KEY")),
        manualBankTransfer: Boolean(flags.manualBankTransfer && bank.configured),
      },
    };
    res.set("Cache-Control", "no-cache");
    res.json(body);
  }));

  /** Authoritative price preview: the exact figure POST /api/bookings will charge. */
  app.post("/api/quote", requireCsrf, asyncHandler(async (req, res) => {
    const input = parseBody(QuoteSchema, req.body);
    res.json(await calculateAuthoritativeQuote(input));
  }));

  app.post("/api/newsletter", paymentLimiter, requireCsrf, asyncHandler(async (req, res) => {
    const { email } = parseBody(NewsletterSchema, req.body);
    const id = crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 40);
    const ref = getAdminDb().collection("newsletter_subscribers").doc(id);
    const existing = await ref.get();
    await ref.set({
      email: email.toLowerCase(),
      status: "subscribed",
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    if (!existing.exists) {
      await queueNotification({
        channel: "email",
        to: process.env.SUPPORT_ALERT_EMAIL || company.email,
        subject: "New newsletter sign-up",
        body: `${email} signed up for BLM news and offers.`,
        template: "newsletter_subscribed",
      });
    }
    res.status(existing.exists ? 200 : 201).json({ success: true });
  }));

  app.get("/api/security/csrf-token", (_req, res) => {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie("blm_csrf", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "strict",
      secure: isProduction,
      path: "/",
      maxAge: 2 * 60 * 60 * 1000,
    });
    res.json({ token });
  });

  app.post("/api/auth/session", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    if (req.auth!.role === "customer") {
      const ref = getAdminDb().collection("customers").doc(req.auth!.uid);
      const existing = await ref.get();
      const loginEvent = {
        ip: getClientIp(req),
        userAgent: req.get("user-agent") || "unknown",
        at: new Date().toISOString(),
      };
      await ref.set({
        profile: {
          fullName: String(req.auth!.token.name || existing.data()?.profile?.fullName || "Customer"),
          email: req.auth!.email || "",
          phone: existing.data()?.profile?.phone || "",
        },
        role: "customer",
        verificationStatus: req.auth!.emailVerified ? "verified" : "pending",
        ...(existing.exists ? {} : { bookingHistory: [], paymentHistory: [], fraudFlags: [], deviceTracking: [] }),
        loginHistory: FieldValue.arrayUnion(loginEvent),
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
    }
    // Keep the token's role claim in step with the server record so Storage and
    // Firestore rules (which read request.auth.token.role) agree with the API.
    const claimRole = req.auth!.token.role;
    const desiredClaim = req.auth!.role === "customer" ? undefined : req.auth!.role;
    let claimsUpdated = false;
    if (claimRole !== desiredClaim) {
      const record = await getFirebaseAuth().getUser(req.auth!.uid);
      const claims = { ...(record.customClaims || {}) };
      if (desiredClaim) claims.role = desiredClaim;
      else delete claims.role;
      await getFirebaseAuth().setCustomUserClaims(req.auth!.uid, claims);
      claimsUpdated = true;
    }
    const profile = await getAdminDb().collection("users").doc(req.auth!.uid).get();
    await persistAudit(req, "AUTH_SESSION_SYNC", `users/${req.auth!.uid}`);
    res.json({
      uid: req.auth!.uid,
      email: req.auth!.email,
      role: req.auth!.role,
      emailVerified: req.auth!.emailVerified,
      fullName: String(profile.data()?.fullName || req.auth!.token.name || ""),
      phone: String(profile.data()?.phone || ""),
      claimsUpdated,
    });
  }));

  app.get("/api/auth/sessions", authenticate, asyncHandler(async (req, res) => {
    const snapshot = await getAdminDb().collection("user_sessions").where("userId", "==", req.auth!.uid).limit(50).get();
    const currentSessionId = sessionIdForRequest(req, req.auth!.uid);
    const sessions = snapshot.docs.map((session) => {
      const data = session.data();
      return {
        id: session.id,
        current: session.id === currentSessionId,
        ip: data.ip || "unknown",
        userAgent: data.userAgent || "unknown",
        revoked: data.revoked === true,
        lastSeenAt: data.lastSeenAt?.toDate?.().toISOString?.() || null,
      };
    });
    res.json({ sessions });
  }));

  app.delete("/api/auth/sessions/:id", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const id = z.string().trim().length(64).parse(req.params.id);
    const ref = getAdminDb().collection("user_sessions").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== req.auth!.uid) throw new HttpError(404, "We couldn’t find that device.");
    await ref.update({ revoked: true, revokedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await persistAudit(req, "DEVICE_SESSION_REVOKED", `user_sessions/${id}`);
    res.json({ success: true, current: id === sessionIdForRequest(req, req.auth!.uid) });
  }));

  app.post("/api/auth/sessions/revoke-all", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const snapshot = await getAdminDb().collection("user_sessions").where("userId", "==", req.auth!.uid).limit(100).get();
    const batch = getAdminDb().batch();
    snapshot.docs.forEach((session) => batch.update(session.ref, { revoked: true, revokedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }));
    await batch.commit();
    await getFirebaseAuth().revokeRefreshTokens(req.auth!.uid);
    await persistAudit(req, "ALL_DEVICE_SESSIONS_REVOKED", `users/${req.auth!.uid}`, { count: snapshot.size });
    res.json({ success: true, revoked: snapshot.size });
  }));

  app.post("/api/payment/manual/initialize", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const { bookingId } = parseBody(ManualPaymentSchema, req.body);
    const [flags, bank] = await Promise.all([getFeatureFlags(), getBankConfig()]);
    if (!flags.manualBankTransfer || !bank.configured) {
      throw new HttpError(503, "Bank transfer isn’t available right now. Please choose another way to pay.");
    }

    const { ref: bookingRef, booking } = await loadBooking(bookingId, req.auth!, ["finance_admin", "customer_support_agent"]);
    if (!["Quoted", "Booked"].includes(String(booking.status))) {
      throw new HttpError(409, "This booking can’t be paid for right now. It may already be paid or cancelled.");
    }

    const existing = await getAdminDb().collection("payments")
      .where("bookingId", "==", bookingId)
      .where("provider", "==", "manual_bank_transfer")
      .limit(1)
      .get();
    if (!existing.empty) {
      const payment = existing.docs[0].data();
      return res.json({ paymentId: existing.docs[0].id, ...payment, bankDetails: bank });
    }

    const paymentRef = getAdminDb().collection("payments").doc();
    const reference = `${bank.referencePrefix}-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const trackingId = `BLM-${String(booking.serviceType || "TRK").toUpperCase().includes("LOGISTICS") ? "LOG" : "TRK"}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const deadline = new Date(Date.now() + bank.deadlineHours * 60 * 60 * 1000).toISOString();
    const amount = Number(booking.totalAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Something is wrong with this booking’s price. Please contact us.");

    const batch = getAdminDb().batch();
    batch.set(paymentRef, {
      bookingId,
      customerId: req.auth!.uid,
      customerName: booking.customerName || req.auth!.email || "Customer",
      customerEmail: booking.customerEmail || req.auth!.email || "",
      paymentReference: reference,
      trackingId,
      provider: "manual_bank_transfer",
      method: "BANK_TRANSFER",
      currency: "NGN",
      amount,
      status: "AWAITING_PAYMENT",
      deadline,
      reconciliation: { required: true, source: "finance_admin_review" },
      events: [{ id: crypto.randomUUID(), eventType: "PAYMENT_CREATED", actorId: req.auth!.uid, actorRole: req.auth!.role, timestamp: new Date().toISOString() }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(bookingRef, {
      paymentReference: reference,
      trackingId,
      paymentStatus: "initialized",
      paymentProvider: "manual_bank_transfer",
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    await persistAudit(req, "MANUAL_PAYMENT_INITIALIZED", `payments/${paymentRef.id}`, { bookingId, reference });
    res.json({ paymentId: paymentRef.id, paymentReference: reference, trackingId, amount, currency: "NGN", deadline, bankDetails: bank, instructions: bank.instructions });
  }));

  app.post("/api/payment/manual/proof", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const payload = parseBody(ManualProofSchema, req.body);
    const ref = getAdminDb().collection("payments").doc(payload.paymentId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new HttpError(404, "We couldn’t find that payment.");
    const payment = snapshot.data() || {};
    if (payment.customerId !== req.auth!.uid && !hasRole(req.auth!, ["finance_admin", "customer_support_agent"])) {
      throw new HttpError(403, "You can only update your own payments.");
    }
    if (["PAID", "REFUNDED"].includes(String(payment.status))) throw new HttpError(409, "This payment has already been completed.");

    await ref.update({
      proofOfPaymentUrl: payload.proofOfPaymentUrl,
      proofFileName: payload.proofFileName,
      customerNote: payload.customerNote || "",
      status: "UNDER_REVIEW",
      submittedAt: FieldValue.serverTimestamp(),
      events: FieldValue.arrayUnion({ id: crypto.randomUUID(), eventType: "PAYMENT_PROOF_SUBMITTED", actorId: req.auth!.uid, actorRole: req.auth!.role, timestamp: new Date().toISOString() }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await persistAudit(req, "MANUAL_PAYMENT_PROOF_SUBMITTED", `payments/${payload.paymentId}`);
    res.json({ success: true });
  }));

  app.post("/api/payment/manual/review", authenticate, requireRoles("finance_admin"), requireCsrf, asyncHandler(async (req, res) => {
    const payload = parseBody(ManualReviewSchema, req.body);
    const paymentRef = getAdminDb().collection("payments").doc(payload.paymentId);
    const paymentSnapshot = await paymentRef.get();
    if (!paymentSnapshot.exists) throw new HttpError(404, "We couldn’t find that payment.");
    const payment = paymentSnapshot.data() || {};
    if (payment.provider !== "manual_bank_transfer") throw new HttpError(400, "This payment wasn’t made by bank transfer.");
    const bookingRef = getAdminDb().collection("bookings").doc(String(payment.bookingId));

    if (payload.decision === "reject") {
      await paymentRef.update({
        status: "PAYMENT_REJECTED",
        rejectionReason: payload.reason || "Payment could not be verified",
        rejectedAt: FieldValue.serverTimestamp(),
        reviewedBy: req.auth!.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await persistAudit(req, "MANUAL_PAYMENT_REJECTED", `payments/${payload.paymentId}`, { reason: payload.reason || null });
      return res.json({ success: true, status: "PAYMENT_REJECTED" });
    }

    const ledgerRef = getAdminDb().collection("ledger_entries").doc(`${payload.paymentId}:revenue`);
    await getAdminDb().runTransaction(async (transaction) => {
      const latest = await transaction.get(paymentRef);
      if (latest.data()?.status === "PAID") return;
      transaction.update(paymentRef, {
        status: "PAID",
        isReconciled: true,
        reconciledAt: FieldValue.serverTimestamp(),
        reconciledBy: req.auth!.uid,
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedBy: req.auth!.email || req.auth!.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(bookingRef, {
        status: "Paid",
        paymentStatus: "succeeded",
        paymentProvider: "manual_bank_transfer",
        updatedAt: FieldValue.serverTimestamp(),
        "lifecycle.paidAt": FieldValue.serverTimestamp(),
        "lifecycle.lastEvent": "payment.succeeded",
      });
      transaction.set(ledgerRef, {
        paymentId: payload.paymentId,
        bookingId: payment.bookingId,
        type: "revenue",
        direction: "credit",
        amount: Number(payment.amount || 0),
        currency: String(payment.currency || "NGN"),
        provider: "manual_bank_transfer",
        status: "posted",
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (payment.customerId) {
        transaction.set(getAdminDb().collection("customers").doc(String(payment.customerId)), {
          paymentHistory: FieldValue.arrayUnion(payload.paymentId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
    await persistAudit(req, "MANUAL_PAYMENT_APPROVED", `payments/${payload.paymentId}`, { bookingId: payment.bookingId });
    const paidBooking = await bookingRef.get();
    await queueCustomerStatusNotifications(String(payment.bookingId), paidBooking.data() || {}, "Paid");
    res.json({ success: true, status: "PAID" });
  }));

  app.post("/api/bookings", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const input = parseBody(BookingCreateSchema, req.body);
    const today = new Date().toISOString().slice(0, 10);
    if (input.date < today) throw new HttpError(422, "Please pick today or a later date.");
    const blocked = await getAdminDb().collection("blocked_dates").where("date", "==", input.date).limit(1).get();
    if (!blocked.empty) {
      throw new HttpError(409, `Sorry, we’re not taking bookings on ${input.date} (${blocked.docs[0].data().reason || "closed"}). Please pick another day.`);
    }
    const quote = await calculateAuthoritativeQuote(input);
    const ref = getAdminDb().collection("bookings").doc();
    const trackingId = `BLM-${input.serviceType.toLowerCase().includes("logistics") ? "LOG" : "TRK"}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const booking = {
      ...input,
      customerId: req.auth!.uid,
      customerEmail: req.auth!.email || input.customerEmail,
      totalAmount: quote.total,
      currency: "NGN",
      pricingSnapshot: { ...input.pricingSnapshot, ...quote, source: "server", calculatedAt: new Date().toISOString() },
      routeMetadata: quote.routeMetadata,
      trackingId,
      status: "Booked",
      lifecycle: { bookedAt: FieldValue.serverTimestamp(), lastEvent: "booking.booked" },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.set(booking);
    await getAdminDb().collection("customers").doc(req.auth!.uid).set({
      profile: {
        fullName: input.customerName,
        email: req.auth!.email || input.customerEmail,
        phone: input.customerPhone,
      },
      bookingHistory: FieldValue.arrayUnion(ref.id),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await getAdminDb().collection("booking_events").add({ bookingId: ref.id, type: "booking.booked", actorId: req.auth!.uid, actorRole: req.auth!.role, metadata: { trackingId, totalAmount: quote.total }, createdAt: FieldValue.serverTimestamp() });
    await persistAudit(req, "BOOKING_CREATED", `bookings/${ref.id}`, { serviceType: input.serviceType, totalAmount: quote.total });
    await queueCustomerStatusNotifications(ref.id, booking, "Booked");
    res.status(201).json({ id: ref.id, trackingId, totalAmount: quote.total, pricingSnapshot: booking.pricingSnapshot });
  }));

  /** Booking + its payment state for the checkout screen (owner or staff only). */
  app.get("/api/bookings/:id", authenticate, asyncHandler(async (req, res) => {
    const bookingId = z.string().trim().min(3).max(160).parse(req.params.id);
    const { booking } = await loadBooking(bookingId, req.auth!);
    const paymentsSnap = await getAdminDb().collection("payments").where("bookingId", "==", bookingId).get();
    const payments = paymentsSnap.docs
      .map((document) => {
        const { clientSecret: _secret, idempotencyKey: _key, ...rest } = document.data();
        return serializeTimestamps({ id: document.id, ...rest });
      })
      .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const manual = payments.find((payment: any) => payment.provider === "manual_bank_transfer");
    const bank = manual ? await getBankConfig() : null;
    res.json({
      booking: serializeTimestamps({ id: bookingId, ...booking }),
      payments,
      bankDetails: bank && bank.configured ? bank : null,
    });
  }));

  app.get("/api/reviews", asyncHandler(async (_req, res) => {
    const snapshot = await getAdminDb().collection("reviews").where("status", "==", "published").limit(100).get();
    const reviews = snapshot.docs
      .map((review) => {
        const data = review.data();
        return {
          id: review.id,
          customerName: data.customerName || "BLM customer",
          serviceType: data.serviceType || "Transport service",
          rating: Number(data.rating || 0),
          title: data.title || "",
          comment: data.comment || "",
          bookingId: data.bookingId || null,
          verified: true,
          photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
          createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || null,
        };
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.json({ reviews });
  }));

  app.post("/api/reviews", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const payload = parseBody(ReviewSubmissionSchema, req.body);
    const { booking } = await loadBooking(payload.bookingId, req.auth!, []);
    if (String(booking.status) !== "Completed") throw new HttpError(409, "You can leave a review once your trip is finished.");
    const existing = await getAdminDb().collection("reviews").where("bookingId", "==", payload.bookingId).limit(1).get();
    if (!existing.empty) throw new HttpError(409, "You’ve already reviewed this trip. Thank you!");
    const ref = await getAdminDb().collection("reviews").add({
      ...payload,
      customerId: req.auth!.uid,
      customerName: booking.customerName || req.auth!.email || "BLM customer",
      customerEmail: booking.customerEmail || req.auth!.email || null,
      serviceType: booking.serviceType || "Transport service",
      verified: true,
      verificationSource: "completed_booking",
      status: "published",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await getAdminDb().collection("bookings").doc(payload.bookingId).update({ reviewId: ref.id, updatedAt: FieldValue.serverTimestamp() });
    await persistAudit(req, "VERIFIED_REVIEW_CREATED", `reviews/${ref.id}`, { bookingId: payload.bookingId, rating: payload.rating });
    res.status(201).json({ id: ref.id });
  }));

  app.get("/api/support/tickets", authenticate, asyncHandler(async (req, res) => {
    const supportAgent = hasRole(req.auth!, ["customer_support_agent"]);
    const source = supportAgent
      ? await getAdminDb().collection("support_tickets").limit(200).get()
      : await getAdminDb().collection("support_tickets").where("customerId", "==", req.auth!.uid).limit(100).get();
    const tickets = source.docs.map((ticket) => {
      const data = ticket.data();
      return {
        id: ticket.id,
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt || null,
      };
    }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    res.json({ tickets });
  }));

  app.post("/api/support/tickets", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const input = parseBody(SupportTicketCreateSchema, req.body);
    if (input.bookingId) await loadBooking(input.bookingId, req.auth!, []);
    const database = getAdminDb();
    const ticketRef = database.collection("support_tickets").doc();
    const messageRef = database.collection("support_conversations").doc(ticketRef.id).collection("messages").doc();
    const batch = database.batch();
    batch.set(ticketRef, {
      ...input,
      customerId: req.auth!.uid,
      customerEmail: req.auth!.email,
      status: "open",
      escalationLevel: input.priority === "urgent" ? 1 : 0,
      lastMessagePreview: input.message.slice(0, 180),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(messageRef, {
      senderId: req.auth!.uid,
      senderRole: req.auth!.role,
      message: input.message,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    await queueNotification({
      channel: "email",
      to: process.env.SUPPORT_ALERT_EMAIL || "bookings@blmmotors.ng",
      subject: `${input.priority === "urgent" ? "URGENT: " : ""}New customer message: ${input.subject}`,
      body: `${req.auth!.email || "A customer"} sent a message (ref ${ticketRef.id}):\n\n${input.message}`,
      template: "support_ticket_created",
      metadata: { ticketId: ticketRef.id, customerId: req.auth!.uid },
    });
    await persistAudit(req, "SUPPORT_TICKET_CREATED", `support_tickets/${ticketRef.id}`, { category: input.category, priority: input.priority });
    res.status(201).json({ id: ticketRef.id });
  }));

  app.get("/api/support/tickets/:id/messages", authenticate, asyncHandler(async (req, res) => {
    const id = z.string().trim().min(3).max(160).parse(req.params.id);
    const ticket = await getAdminDb().collection("support_tickets").doc(id).get();
    if (!ticket.exists) throw new HttpError(404, "We couldn’t find that message.");
    const data = ticket.data() || {};
    if (data.customerId !== req.auth!.uid && !hasRole(req.auth!, ["customer_support_agent"])) throw new HttpError(403, "You can only see your own messages.");
    const snapshot = await getAdminDb().collection("support_conversations").doc(id).collection("messages").orderBy("createdAt", "asc").limit(300).get();
    const messages = snapshot.docs.map((message) => {
      const value = message.data();
      return { id: message.id, ...value, createdAt: value.createdAt?.toDate?.().toISOString?.() || value.createdAt || null };
    });
    res.json({ messages });
  }));

  app.post("/api/support/tickets/:id/messages", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const id = z.string().trim().min(3).max(160).parse(req.params.id);
    const { message } = parseBody(SupportMessageSchema, req.body);
    const database = getAdminDb();
    const ticketRef = database.collection("support_tickets").doc(id);
    const ticket = await ticketRef.get();
    if (!ticket.exists) throw new HttpError(404, "We couldn’t find that message.");
    const data = ticket.data() || {};
    const supportAgent = hasRole(req.auth!, ["customer_support_agent"]);
    if (data.customerId !== req.auth!.uid && !supportAgent) throw new HttpError(403, "You can only see your own messages.");
    if (data.status === "closed") throw new HttpError(409, "This conversation is closed. Please send a new message.");
    const messageRef = database.collection("support_conversations").doc(id).collection("messages").doc();
    const batch = database.batch();
    batch.set(messageRef, { senderId: req.auth!.uid, senderRole: req.auth!.role, message, createdAt: FieldValue.serverTimestamp() });
    batch.update(ticketRef, { status: supportAgent ? "waiting_customer" : "open", lastMessagePreview: message.slice(0, 180), updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
    if (supportAgent && data.customerEmail) {
      await queueNotification({ channel: "email", to: String(data.customerEmail), subject: `BLM replied: ${data.subject}`, body: message, template: "support_ticket_reply", metadata: { ticketId: id } });
    }
    if (supportAgent && data.phone && (await getFeatureFlags()).whatsappNotifications) {
      await queueNotification({ channel: "whatsapp", to: String(data.phone), body: `BLM: ${message}`, template: "support_ticket_reply", metadata: { ticketId: id } });
    }
    await persistAudit(req, "SUPPORT_MESSAGE_CREATED", `support_tickets/${id}`, { senderRole: req.auth!.role });
    res.status(201).json({ id: messageRef.id });
  }));

  app.post("/api/support/tickets/:id/status", authenticate, requireRoles("customer_support_agent"), requireCsrf, asyncHandler(async (req, res) => {
    const id = z.string().trim().min(3).max(160).parse(req.params.id);
    const update = parseBody(SupportStatusSchema, req.body);
    const ref = getAdminDb().collection("support_tickets").doc(id);
    const ticket = await ref.get();
    if (!ticket.exists) throw new HttpError(404, "We couldn’t find that message.");
    await ref.update({ ...update, assignedAgentId: req.auth!.uid, updatedAt: FieldValue.serverTimestamp() });
    await persistAudit(req, "SUPPORT_TICKET_STATUS_UPDATED", `support_tickets/${id}`, update, ticket.data());
    res.json({ success: true });
  }));

  app.get("/api/tracking/:bookingId", asyncHandler(async (req, res) => {
    const reference = z.string().trim().min(3).max(160).parse(req.params.bookingId);
    const bookings = getAdminDb().collection("bookings");
    let bookingSnap = await bookings.doc(reference).get();
    if (!bookingSnap.exists) {
      const byTracking = await bookings.where("trackingId", "==", reference).limit(1).get();
      if (!byTracking.empty) bookingSnap = byTracking.docs[0];
    }
    if (!bookingSnap.exists) {
      const byPayment = await bookings.where("paymentReference", "==", reference).limit(1).get();
      if (!byPayment.empty) bookingSnap = byPayment.docs[0];
    }
    if (!bookingSnap.exists) {
      const payment = await getAdminDb().collection("payments").where("paymentReference", "==", reference).limit(1).get();
      const linkedBookingId = payment.empty ? "" : String(payment.docs[0].data().bookingId || "");
      if (linkedBookingId) bookingSnap = await bookings.doc(linkedBookingId).get();
    }
    if (!bookingSnap.exists) throw new HttpError(404, "We couldn’t find a booking with that tracking number.");

    const bookingId = bookingSnap.id;
    const booking = bookingSnap.data() || {};
    const eventsSnap = await getAdminDb()
      .collection("booking_events")
      .where("bookingId", "==", bookingId)
      .limit(50)
      .get();

    // Customer-safe event feed (no actor IDs), newest first. Sorted in memory to avoid a composite index.
    const events = eventsSnap.docs.map((doc) => {
      const event = doc.data();
      const metadata = event.metadata || {};
      return {
        id: doc.id,
        type: String(event.type || "booking.update"),
        location: metadata.location ? String(metadata.location) : null,
        notes: metadata.notes ? String(metadata.notes) : null,
        status: metadata.status ? String(metadata.status) : null,
        createdAt: event.createdAt?.toDate?.().toISOString?.() || null,
      };
    }).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, 20);

    const statusOrder = ["Quoted", "Booked", "Paid", "Confirmed", "Dispatched", "InTransit", "Completed"];
    const mayShowLocation = statusOrder.indexOf(String(booking.status)) >= statusOrder.indexOf("Dispatched");
    const flags = await getFeatureFlags();
    const driverId = String(booking.assignedDriverId || "");
    const [driverSnap, locationSnap] = await Promise.all([
      driverId ? getAdminDb().collection("drivers").doc(driverId).get() : Promise.resolve(null),
      driverId && flags.liveTracking && mayShowLocation
        ? getAdminDb().collection("driver_locations").doc(driverId).get()
        : Promise.resolve(null),
    ]);
    const driver = driverSnap?.data() || {};
    const location = locationSnap?.data() || null;

    res.json({
      id: bookingId,
      trackingId: booking.trackingId || bookingId,
      paymentReference: booking.paymentReference || null,
      pickup: booking.pickup || null,
      destination: booking.destination || null,
      status: booking.status || "Unknown",
      assignedDriverId: booking.assignedDriverId || null,
      driver: driverId ? {
        name: driver.name || driver.profile?.name || "BLM verified driver",
        photoUrl: driver.photoUrl || driver.profile?.photoUrl || null,
        vehiclePhotoUrl: driver.vehiclePhotoUrl || null,
        rating: driver.ratings?.average || null,
        ratingCount: driver.ratings?.count || 0,
        verificationStatus: driver.kyc?.status || driver.onboarding?.state || "pending",
        insuranceStatus: driver.insurance?.status || "not_recorded",
      } : null,
      liveLocation: location ? {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        heading: location.heading == null ? null : Number(location.heading),
        speed: location.speed == null ? null : Number(location.speed),
        accuracy: location.accuracy == null ? null : Number(location.accuracy),
        heartbeatAt: location.heartbeatAt?.toDate?.().toISOString?.() || null,
      } : null,
      liveTrackingEnabled: Boolean(flags.liveTracking && mayShowLocation),
      vehicleClass: booking.vehicleClass || null,
      serviceType: booking.serviceType || null,
      currentCheckpoint: booking.currentCheckpoint || booking.pickup || null,
      date: booking.date || null,
      time: booking.time || null,
      etaHistory: booking.etaHistory || [],
      routeMetadata: booking.routeMetadata || null,
      updatedAt: booking.updatedAt?.toDate?.().toISOString?.() || booking.updatedAt || null,
      events,
    });
  }));

  app.post(
    "/api/payment/stripe/create-intent",
    paymentLimiter,
    authenticate,
    requireCsrf,
    asyncHandler(async (req, res) => {
      if (!(await getFeatureFlags()).stripe) throw new HttpError(503, "Card payments are switched off right now. Please choose another way to pay.");
      const { bookingId, currency: requestedCurrency } = parseBody(StripeIntentSchema, req.body);
      const { booking } = await loadBooking(bookingId, req.auth!, ["finance_admin", "customer_support_agent"]);
      if (!["Quoted", "Booked"].includes(String(booking.status))) {
        throw new HttpError(409, "This booking can’t be paid for right now. It may already be paid or cancelled.");
      }

      const existing = await findExistingPayment(bookingId, "stripe");
      if (existing?.data.status === "succeeded") {
        throw new HttpError(409, "This booking is already paid.");
      }
      if (existing?.data.clientSecret) {
        return res.json({ clientSecret: existing.data.clientSecret, paymentId: existing.id, reused: true });
      }

      const baseAmount = Number(booking.totalAmount || 0);
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) throw new HttpError(400, "Something is wrong with this booking’s price. Please contact us.");
      const currency = String(requestedCurrency || booking.checkoutCurrency || booking.displayCurrency || booking.currency || "NGN").toUpperCase() as z.infer<typeof SupportedCurrencySchema>;
      SupportedCurrencySchema.parse(currency);
      const amount = await convertFromNgn(baseAmount, currency);

      const paymentRef = getAdminDb().collection("payments").doc();
      const idempotencyKey =
        (req.get("x-idempotency-key") || `stripe-intent:${req.auth!.uid}:${bookingId}:${currency}:${toMinorUnits(amount, currency)}`).slice(0, 255);
      const paymentIntent = await getStripe().paymentIntents.create(
        {
          amount: toMinorUnits(amount, currency),
          currency: currency.toLowerCase(),
          metadata: {
            paymentId: paymentRef.id,
            bookingId,
            customerId: req.auth!.uid,
          },
          receipt_email: req.auth!.email || String(booking.customerEmail || ""),
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey },
      );

      await paymentRef.set({
        provider: "stripe",
        providerPaymentId: paymentIntent.id,
        bookingId,
        customerId: req.auth!.uid,
        baseAmount,
        baseCurrency: "NGN",
        amount,
        amountMinor: toMinorUnits(amount, currency),
        currency,
        status: paymentIntent.status,
        providerStatus: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        idempotencyKey,
        fraud: {
          riskLevel: "pending",
          duplicateCheck: "passed",
        },
        reconciliation: {
          required: true,
          source: "webhook_or_server_verify",
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await persistAudit(req, "PAYMENT_INTENT_CREATED", `payments/${paymentRef.id}`, { bookingId, provider: "stripe" });
      await queueNotification({
        channel: "email",
        to: req.auth!.email || String(booking.customerEmail || ""),
        subject: "We’re processing your payment",
        body: `We’ve started processing your payment for booking ${bookingId}. We’ll let you know as soon as it’s confirmed.`,
        template: "payment_initialized",
        metadata: { bookingId, paymentId: paymentRef.id, provider: "stripe" },
      });

      res.json({ clientSecret: paymentIntent.client_secret, paymentId: paymentRef.id });
    }),
  );

  app.post(
    "/api/payment/stripe/reconcile",
    paymentLimiter,
    authenticate,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { paymentIntentId } = parseBody(StripeReconcileSchema, req.body);
      const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
      if (!intent.metadata?.bookingId) throw new HttpError(400, "We couldn’t match this payment to a booking. Please contact us.");
      await loadBooking(intent.metadata.bookingId, req.auth!, ["finance_admin", "customer_support_agent"]);
      await reconcileStripePayment(intent, `client_reconcile:${crypto.randomUUID()}`);
      await persistAudit(req, "PAYMENT_RECONCILED", `stripe/${paymentIntentId}`, { status: intent.status });
      res.json({ status: intent.status });
    }),
  );

  app.post(
    "/api/payment/stripe/refund",
    paymentLimiter,
    authenticate,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { bookingId, paymentIntentId, reason } = parseBody(RefundSchema, req.body);
      const { booking } = await loadBooking(bookingId, req.auth!, ["finance_admin", "customer_support_agent"]);
      const canSelfCancel = booking.customerId === req.auth!.uid;
      if (!canSelfCancel && !hasRole(req.auth!, ["finance_admin", "customer_support_agent"])) {
        throw new HttpError(403, "You can’t request a refund for this booking.");
      }

      const paymentSnap = await getAdminDb()
        .collection("payments")
        .where("bookingId", "==", bookingId)
        .where("provider", "==", "stripe")
        .where("status", "==", "succeeded")
        .limit(1)
        .get();

      const payment = paymentSnap.empty ? null : paymentSnap.docs[0].data();
      if (!payment && paymentIntentId && booking.paymentIntentId !== paymentIntentId) {
        throw new HttpError(403, "That payment doesn’t belong to this booking.");
      }
      const intentId = payment?.providerPaymentId || booking.paymentIntentId;
      if (!intentId) throw new HttpError(404, "There’s no card payment to refund on this booking.");

      const refund = await getStripe().refunds.create(
        {
          payment_intent: String(intentId),
          metadata: { bookingId, requestedBy: req.auth!.uid, reason: reason || "customer_or_admin_request" },
        },
        { idempotencyKey: `refund:${bookingId}:${intentId}`.slice(0, 255) },
      );

      await getAdminDb().collection("refunds").doc(refund.id).set({
        provider: "stripe",
        bookingId,
        paymentIntentId: intentId,
        requestedBy: req.auth!.uid,
        reason: reason || null,
        status: refund.status,
        amount: refund.amount,
        currency: refund.currency?.toUpperCase(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await getAdminDb().collection("bookings").doc(bookingId).set(
        {
          refundStatus: refund.status,
          status: "Cancelled",
          "lifecycle.cancelledAt": FieldValue.serverTimestamp(),
          "lifecycle.lastEvent": "refund.created",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      await persistAudit(req, "REFUND_CREATED", `refunds/${refund.id}`, { bookingId, intentId, status: refund.status });
      await queueNotification({
        channel: "email",
        to: String(booking.customerEmail || req.auth!.email || ""),
        subject: "Your refund is on its way",
        body: `We’ve sent a refund for booking ${bookingId} to your card. It can take 5–10 working days to show on your statement.`,
        template: "refund_initiated",
        metadata: { bookingId, refundId: refund.id },
      });


      res.json({ success: true, refundId: refund.id, status: refund.status });
    }),
  );

  app.post(
    "/api/payment/paystack/initialize",
    paymentLimiter,
    authenticate,
    requireCsrf,
    asyncHandler(async (req, res) => {
      if (!(await getFeatureFlags()).paystack) throw new HttpError(503, "Paystack is switched off right now. Please choose another way to pay.");
      const { bookingId, currency: requestedCurrency } = parseBody(PaystackInitializeSchema, req.body);
      const secretKey = envValue("PAYSTACK_SECRET_KEY");
      if (!secretKey) throw new HttpError(503, "Paystack isn’t set up yet. Please choose another way to pay.");

      const { booking } = await loadBooking(bookingId, req.auth!, ["finance_admin", "customer_support_agent"]);
      if (!["Quoted", "Booked"].includes(String(booking.status))) {
        throw new HttpError(409, "This booking can’t be paid for right now. It may already be paid or cancelled.");
      }

      const existing = await findExistingPayment(bookingId, "paystack");
      if (existing?.data.status === "succeeded") {
        throw new HttpError(409, "This booking is already paid.");
      }

      const baseAmount = Number(booking.totalAmount || 0);
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) throw new HttpError(400, "Something is wrong with this booking’s price. Please contact us.");
      const currency = String(requestedCurrency || booking.checkoutCurrency || booking.displayCurrency || booking.currency || "NGN").toUpperCase() as z.infer<typeof SupportedCurrencySchema>;
      SupportedCurrencySchema.parse(currency);
      if (!["NGN", "GHS"].includes(currency)) {
        throw new HttpError(400, "Paystack only accepts naira (NGN) and cedis (GHS). Please pay by card for other currencies.");
      }
      const amount = await convertFromNgn(baseAmount, currency);

      const paymentRef = existing?.ref || getAdminDb().collection("payments").doc();
      const reference = existing?.data.providerReference || `BLM-${bookingId}-${crypto.randomBytes(5).toString("hex")}`;

      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: req.auth!.email || booking.customerEmail,
          amount: toMinorUnits(amount, currency),
          currency,
          reference,
          metadata: { bookingId, paymentId: paymentRef.id, customerId: req.auth!.uid },
          callback_url: `${process.env.APP_URL || ""}/checkout/${bookingId}`,
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      await paymentRef.set(
        {
          provider: "paystack",
          providerReference: reference,
          bookingId,
          customerId: req.auth!.uid,
          baseAmount,
          baseCurrency: "NGN",
          amount,
          amountMinor: toMinorUnits(amount, currency),
          currency,
          status: "initialized",
          providerStatus: response.data?.data?.status || "initialized",
          reconciliation: {
            required: true,
            source: "webhook_or_server_verify",
          },
          fraud: {
            duplicateCheck: "passed",
            riskLevel: "pending",
          },
          createdAt: existing ? existing.data.createdAt : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      await persistAudit(req, "PAYSTACK_INITIALIZED", `payments/${paymentRef.id}`, { bookingId, reference });
      res.json(response.data);
    }),
  );

  app.get(
    "/api/payment/paystack/verify/:reference",
    paymentLimiter,
    authenticate,
    asyncHandler(async (req, res) => {
      const reference = z.string().trim().min(3).max(200).parse(req.params.reference);
      const paymentSnap = await getAdminDb()
        .collection("payments")
        .where("provider", "==", "paystack")
        .where("providerReference", "==", reference)
        .limit(1)
        .get();
      if (paymentSnap.empty) throw new HttpError(404, "We couldn’t find that Paystack payment.");

      const payment = paymentSnap.docs[0].data();
      await loadBooking(String(payment.bookingId), req.auth!, ["finance_admin", "customer_support_agent"]);
      const data = await reconcilePaystackReference(reference, `client_reconcile:${crypto.randomUUID()}`);
      await persistAudit(req, "PAYSTACK_RECONCILED", `paystack/${reference}`, { status: data?.status });
      res.json({ status: data?.status, data });
    }),
  );

  app.post(
    "/api/bookings/update-status",
    authenticate,
    requireRoles("dispatcher", "customer_support_agent"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { bookingId, status, assignedDriverId, cancellationReason } = parseBody(StatusUpdateSchema, req.body);
      const { ref, snap, booking } = await loadBooking(bookingId, req.auth!, ["dispatcher", "customer_support_agent"]);
      const before = snap.data();

      const update: Record<string, unknown> = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        "lifecycle.lastEvent": `booking.${status.toLowerCase()}`,
        [`lifecycle.${status.toLowerCase()}At`]: FieldValue.serverTimestamp(),
      };

      if (assignedDriverId) {
        update.assignedDriverId = assignedDriverId;
      }
      if (status === "Cancelled") {
        update.cancellationHistory = FieldValue.arrayUnion({
          at: new Date().toISOString(),
          by: req.auth!.uid,
          reason: cancellationReason || "No reason provided",
          previousStatus: booking.status || null,
        });
      }

      await ref.update(update);
      await getAdminDb().collection("booking_events").add({
        bookingId,
        type: `booking.${status.toLowerCase()}`,
        actorId: req.auth!.uid,
        actorRole: req.auth!.role,
        metadata: { previousStatus: booking.status || null, status, assignedDriverId: assignedDriverId || null },
        createdAt: FieldValue.serverTimestamp(),
      });

      await queueCustomerStatusNotifications(bookingId, booking, status);

      await persistAudit(req, "BOOKING_STATUS_UPDATED", `bookings/${bookingId}`, { status }, before, update);

      res.json({ success: true });
    }),
  );

  app.post(
    "/api/bookings/cancel",
    authenticate,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { bookingId, reason } = parseBody(
        z.object({
          bookingId: z.string().trim().min(3).max(160),
          reason: z.string().trim().max(500).optional(),
        }),
        req.body,
      );
      const { ref, snap, booking } = await loadBooking(bookingId, req.auth!, ["customer_support_agent", "dispatcher"]);
      if (!["Quoted", "Booked", "Paid", "Confirmed"].includes(String(booking.status))) {
        throw new HttpError(409, "This booking can’t be cancelled now because the trip has already started or finished.");
      }

      await ref.update({
        status: "Cancelled",
        refundStatus: booking.paymentStatus === "succeeded" ? booking.refundStatus || "Required" : "N/A",
        cancellationHistory: FieldValue.arrayUnion({
          at: new Date().toISOString(),
          by: req.auth!.uid,
          reason: reason || "customer_cancelled",
          previousStatus: booking.status || null,
        }),
        "lifecycle.cancelledAt": FieldValue.serverTimestamp(),
        "lifecycle.lastEvent": "booking.cancelled",
        updatedAt: FieldValue.serverTimestamp(),
      });

      await getAdminDb().collection("booking_events").add({
        bookingId,
        type: "booking.cancelled",
        actorId: req.auth!.uid,
        actorRole: req.auth!.role,
        metadata: { previousStatus: booking.status || null, reason: reason || "customer_cancelled" },
        createdAt: FieldValue.serverTimestamp(),
      });

      await persistAudit(req, "BOOKING_CANCELLED", `bookings/${bookingId}`, { reason: reason || null }, snap.data());

      res.json({ success: true });
    }),
  );

  app.post(
    "/api/dispatch/assign",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { bookingId, driverId } = parseBody(DriverAssignmentSchema, req.body);
      const database = getAdminDb();
      const bookingRef = database.collection("bookings").doc(bookingId);
      const driverRef = database.collection("drivers").doc(driverId);

      const result = await database.runTransaction(async (transaction) => {
        const [bookingSnap, driverSnap] = await Promise.all([
          transaction.get(bookingRef),
          transaction.get(driverRef),
        ]);
        if (!bookingSnap.exists) throw new HttpError(404, "We couldn’t find that booking.");
        if (!driverSnap.exists) throw new HttpError(404, "We couldn’t find that driver.");

        const booking = bookingSnap.data() || {};
        const driver = driverSnap.data() || {};
        if (!["Paid", "Confirmed", "Dispatched", "InTransit"].includes(String(booking.status))) {
          throw new HttpError(409, "A driver can only be assigned after the booking is paid.");
        }
        if (["suspended", "rejected"].includes(String(driver.onboarding?.state || "").toLowerCase())) {
          throw new HttpError(409, "This driver hasn’t been approved yet.");
        }

        const previousDriverId = String(booking.assignedDriverId || booking.driverId || "");
        const previousDriverRef = previousDriverId && previousDriverId !== driverId
          ? database.collection("drivers").doc(previousDriverId)
          : null;
        const previousDriverSnap = previousDriverRef ? await transaction.get(previousDriverRef) : null;
        transaction.update(bookingRef, {
          assignedDriverId: driverId,
          driverId,
          status: booking.status === "Paid" ? "Confirmed" : booking.status,
          updatedAt: FieldValue.serverTimestamp(),
          "lifecycle.lastEvent": "dispatch.manually_assigned",
          "lifecycle.assignedAt": FieldValue.serverTimestamp(),
        });
        transaction.update(driverRef, {
          assignedJobs: FieldValue.arrayUnion(bookingId),
          "availability.state": "assigned",
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (previousDriverRef && previousDriverSnap?.exists) {
          transaction.update(previousDriverRef, {
            assignedJobs: FieldValue.arrayRemove(bookingId),
            "availability.state": "available",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        return { booking, driver, previousDriverId };
      });

      await database.collection("booking_events").add({
        bookingId,
        type: "dispatch.manually_assigned",
        actorId: req.auth!.uid,
        actorRole: req.auth!.role,
        metadata: { driverId, previousDriverId: result.previousDriverId || null },
        createdAt: FieldValue.serverTimestamp(),
      });
      const phone = String(result.driver.phone || "");
      if (phone) {
        await queueNotification({
          channel: "sms",
          to: phone,
          body: `New BLM trip ${result.booking.trackingId || bookingId}: from ${result.booking.pickup || "pickup"} to ${result.booking.destination || "destination"}, ${result.booking.date || ""} ${result.booking.time || ""}. Open the driver app for details.`,
          template: "driver_dispatch_alert",
          metadata: { bookingId, driverId },
        });
      }
      await persistAudit(req, "DRIVER_ASSIGNED", `bookings/${bookingId}`, { driverId, previousDriverId: result.previousDriverId || null });
      res.json({ bookingId, driverId });
    }),
  );

  app.post(
    "/api/dispatch/auto-assign",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { bookingId } = parseBody(z.object({ bookingId: z.string().trim().min(3).max(160) }), req.body);
      const { ref, booking } = await loadBooking(bookingId, req.auth!, ["dispatcher"]);
      const drivers = await getAdminDb().collection("drivers").where("availability.state", "==", "available").limit(10).get();
      const chosen = drivers.empty ? null : drivers.docs[0];
      if (!chosen) {
        await operationsQueue.enqueue("dispatch.assign", { bookingId, reason: "no_available_driver" });
        throw new HttpError(409, "No drivers are available right now. We’ll assign one as soon as someone is free.");
      }

      await ref.update({
        assignedDriverId: chosen.id,
        driverId: chosen.id,
        status: "Confirmed",
        updatedAt: FieldValue.serverTimestamp(),
        "lifecycle.confirmedAt": FieldValue.serverTimestamp(),
        "lifecycle.lastEvent": "dispatch.auto_assigned",
      });
      await chosen.ref.update({
        assignedJobs: FieldValue.arrayUnion(bookingId),
        "availability.state": "assigned",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await persistAudit(req, "DRIVER_AUTO_ASSIGNED", `bookings/${bookingId}`, { driverId: chosen.id });
      res.json({ bookingId, driverId: chosen.id });
    }),
  );

  app.post(
    "/api/bookings/checkpoint",
    authenticate,
    requireRoles("dispatcher", "customer_support_agent"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const update = parseBody(CheckpointUpdateSchema, req.body);
      const { ref, booking } = await loadBooking(update.bookingId, req.auth!, ["dispatcher", "customer_support_agent"]);
      const event = {
        id: crypto.randomUUID(),
        type: update.status,
        createdAt: new Date().toISOString(),
        location: update.location,
        notes: update.notes || `Checkpoint updated: ${update.location}`,
      };
      await ref.update({
        currentCheckpoint: update.location,
        status: update.status,
        events: FieldValue.arrayUnion(event),
        "lifecycle.lastEvent": "booking.checkpoint_updated",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await getAdminDb().collection("booking_events").add({
        bookingId: update.bookingId,
        type: "booking.checkpoint_updated",
        actorId: req.auth!.uid,
        actorRole: req.auth!.role,
        metadata: { location: update.location, status: update.status, notes: update.notes || null },
        createdAt: FieldValue.serverTimestamp(),
      });
      await queueCustomerStatusNotifications(update.bookingId, { ...booking, currentCheckpoint: update.location }, update.status);
      await persistAudit(req, "BOOKING_CHECKPOINT_UPDATED", `bookings/${update.bookingId}`, { location: update.location, status: update.status });
      res.json({ success: true, event });
    }),
  );

  app.post(
    "/api/drivers/onboard",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const driver = parseBody(DriverOnboardingSchema, req.body);
      const firebaseUser = await findAuthUser(driver.account);
      const adminRecord = await getAdminDb().collection("admins").doc(firebaseUser.uid).get();
      if (adminRecord.exists) throw new HttpError(409, "This person is a staff member, so they can’t also be a driver.");

      const ref = getAdminDb().collection("drivers").doc(firebaseUser.uid);
      const existing = await ref.get();
      if (existing.exists) throw new HttpError(409, "This person is already a driver.");

      await ref.set({
        authUid: firebaseUser.uid,
        profile: {
          name: driver.name,
          phone: driver.phone,
          email: firebaseUser.email || null,
        },
        name: driver.name,
        phone: driver.phone,
        email: firebaseUser.email || null,
        onboarding: {
          state: "pending_review",
          submittedAt: FieldValue.serverTimestamp(),
        },
        kyc: {
          status: "pending",
          licenseNumber: driver.license,
          licenseVerification: "pending",
        },
        vehicleId: driver.vehicleId || null,
        availability: {
          state: "offline",
          updatedAt: FieldValue.serverTimestamp(),
        },
        status: "Pending Approval",
        ratings: { average: null, count: 0 },
        payoutHistory: [],
        assignedJobs: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await getAdminDb().collection("users").doc(firebaseUser.uid).set({
        uid: firebaseUser.uid,
        email: firebaseUser.email || null,
        fullName: driver.name,
        role: "driver",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      await getFirebaseAuth().setCustomUserClaims(firebaseUser.uid, {
        ...(firebaseUser.customClaims || {}),
        role: "driver",
      });
      await persistAudit(req, "DRIVER_ONBOARDED", `drivers/${ref.id}`, { driverId: ref.id });
      res.json({ id: ref.id });
    }),
  );

  app.post(
    "/api/drivers/location",
    authenticate,
    requireRoles("driver"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const location = parseBody(DriverLocationSchema, req.body);
      const driver = await resolveDriverForUser(req.auth!.uid);
      if (!driver) throw new HttpError(404, "Your account isn’t set up as a driver yet. Please contact BLM.");
      if (location.bookingId) {
        const booking = await getAdminDb().collection("bookings").doc(location.bookingId).get();
        if (!booking.exists || booking.data()?.assignedDriverId !== driver.id) {
          throw new HttpError(403, "This trip isn’t assigned to you.");
        }
      }
      const ref = getAdminDb().collection("driver_locations").doc(driver.id);
      await ref.set(
        {
          driverId: driver.id,
          ...location,
          heartbeatAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      res.json({ success: true });
    }),
  );

  app.get(
    "/api/drivers/me/jobs",
    authenticate,
    requireRoles("driver"),
    asyncHandler(async (req, res) => {
      const driver = await resolveDriverForUser(req.auth!.uid);
      if (!driver) throw new HttpError(404, "Your account isn’t set up as a driver yet. Please contact BLM.");
      const jobs = await getAdminDb().collection("bookings")
        .where("assignedDriverId", "==", driver.id)
        .where("status", "in", ["Paid", "Confirmed", "Dispatched", "InTransit"])
        .limit(30)
        .get();
      res.json({
        driver: { id: driver.id, ...(driver.data() || {}) },
        jobs: jobs.docs.map((job) => {
          const data = job.data();
          return {
            id: job.id,
            trackingId: data.trackingId || job.id,
            serviceType: data.serviceType || "Transport service",
            pickup: data.pickup || null,
            destination: data.destination || null,
            date: data.date || null,
            time: data.time || null,
            status: data.status || "Confirmed",
            customerName: data.customerName || "Customer",
          };
        }),
      });
    }),
  );

  app.post(
    "/api/drivers/me/availability",
    authenticate,
    requireRoles("driver"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { state } = parseBody(DriverAvailabilitySchema, req.body);
      const driver = await resolveDriverForUser(req.auth!.uid);
      if (!driver) throw new HttpError(404, "Your account isn’t set up as a driver yet. Please contact BLM.");
      if (state === "available" && driver.data()?.onboarding?.state !== "approved") {
        throw new HttpError(409, "Your driver account is waiting for approval from BLM.");
      }
      await driver.ref.update({ "availability.state": state, "availability.updatedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      await persistAudit(req, "DRIVER_AVAILABILITY_UPDATED", `drivers/${driver.id}`, { state });
      res.json({ success: true, state });
    }),
  );

  app.post(
    "/api/drivers/jobs/action",
    authenticate,
    requireRoles("driver"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { bookingId, action, note } = parseBody(DriverJobActionSchema, req.body);
      const driver = await resolveDriverForUser(req.auth!.uid);
      if (!driver) throw new HttpError(404, "Your account isn’t set up as a driver yet. Please contact BLM.");
      const bookingRef = getAdminDb().collection("bookings").doc(bookingId);
      const bookingSnap = await bookingRef.get();
      if (!bookingSnap.exists || bookingSnap.data()?.assignedDriverId !== driver.id) {
        throw new HttpError(403, "This trip isn’t assigned to you.");
      }
      const booking = bookingSnap.data() || {};
      const statusByAction: Record<string, string> = { accept: "Confirmed", arrived: "Dispatched", in_transit: "InTransit", completed: "Completed" };

      if (action === "reject") {
        await bookingRef.update({
          assignedDriverId: FieldValue.delete(),
          status: "Paid",
          driverRejections: FieldValue.arrayUnion({ driverId: driver.id, note: note || null, at: new Date().toISOString() }),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await driver.ref.update({ assignedJobs: FieldValue.arrayRemove(bookingId), "availability.state": "available", updatedAt: FieldValue.serverTimestamp() });
        await operationsQueue.enqueue("dispatch.assign", { bookingId, rejectedDriverId: driver.id });
        await persistAudit(req, "DRIVER_JOB_REJECTED", `bookings/${bookingId}`, { driverId: driver.id, note: note || null });
        return res.json({ success: true, status: "Paid" });
      }

      const status = statusByAction[action];
      await bookingRef.update({
        status,
        currentCheckpoint: action === "arrived" ? booking.pickup || "Pickup point" : booking.currentCheckpoint || booking.pickup || null,
        [`lifecycle.${status.toLowerCase()}At`]: FieldValue.serverTimestamp(),
        "lifecycle.lastEvent": `driver.${action}`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await getAdminDb().collection("booking_events").add({
        bookingId,
        type: `driver.${action}`,
        actorId: req.auth!.uid,
        actorRole: "driver",
        metadata: { driverId: driver.id, note: note || null },
        createdAt: FieldValue.serverTimestamp(),
      });
      if (action === "completed") {
        await driver.ref.update({ assignedJobs: FieldValue.arrayRemove(bookingId), "availability.state": "available", updatedAt: FieldValue.serverTimestamp() });
      } else {
        await driver.ref.update({ "availability.state": "assigned", updatedAt: FieldValue.serverTimestamp() });
      }
      await queueCustomerStatusNotifications(bookingId, booking, status);
      await persistAudit(req, "DRIVER_JOB_STATUS_UPDATED", `bookings/${bookingId}`, { driverId: driver.id, action, status });
      res.json({ success: true, status });
    }),
  );

  app.post(
    "/api/admin/users/role",
    authenticate,
    requireRoles("super_admin"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { account, role } = parseBody(PromoteAdminSchema, req.body);
      const user = await findAuthUser(account);
      const driver = await getAdminDb().collection("drivers").doc(user.uid).get();
      if (driver.exists) throw new HttpError(409, "This person is a driver, so they can’t also be given staff access.");
      await getAdminDb().collection("admins").doc(user.uid).set(
        {
          role,
          email: user.email || null,
          displayName: user.displayName || null,
          promotedBy: req.auth!.email,
          promotedByUid: req.auth!.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await getFirebaseAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role });
      await persistAudit(req, "ADMIN_ROLE_GRANTED", `admins/${user.uid}`, { role, email: user.email || null });
      res.json({ success: true, uid: user.uid, email: user.email, role });
    }),
  );

  app.delete(
    "/api/admin/users/role/:uid",
    authenticate,
    requireRoles("super_admin"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const uid = z.string().trim().min(3).max(160).parse(req.params.uid);
      if (uid === req.auth!.uid) throw new HttpError(409, "You can’t remove your own access.");
      const ref = getAdminDb().collection("admins").doc(uid);
      const before = await ref.get();
      if (!before.exists) throw new HttpError(404, "We couldn’t find that staff member.");
      if (before.data()?.role === "super_admin") {
        const supers = await getAdminDb().collection("admins").where("role", "==", "super_admin").get();
        if (supers.size <= 1) throw new HttpError(409, "You need at least one person with full access.");
      }
      await ref.delete();
      const user = await getFirebaseAuth().getUser(uid).catch(() => null);
      if (user) {
        const claims = { ...(user.customClaims || {}) };
        delete claims.role;
        await getFirebaseAuth().setCustomUserClaims(uid, claims);
        await getFirebaseAuth().revokeRefreshTokens(uid);
      }
      await persistAudit(req, "ADMIN_ROLE_REVOKED", `admins/${uid}`, {}, before.data());
      res.json({ success: true });
    }),
  );

  app.post(
    "/api/admin/reviews/:id/status",
    authenticate,
    requireRoles("customer_support_agent", "dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = z.string().trim().min(3).max(160).parse(req.params.id);
      const { status } = parseBody(ReviewStatusSchema, req.body);
      const ref = getAdminDb().collection("reviews").doc(id);
      const before = await ref.get();
      if (!before.exists) throw new HttpError(404, "We couldn’t find that review.");
      await ref.update({ status, moderatedBy: req.auth!.uid, updatedAt: FieldValue.serverTimestamp() });
      await persistAudit(req, "REVIEW_MODERATED", `reviews/${id}`, { status }, before.data());
      res.json({ success: true, status });
    }),
  );

  app.post(
    "/api/admin/drivers/:id/status",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = z.string().trim().min(3).max(160).parse(req.params.id);
      const { state, reason } = parseBody(DriverStatusSchema, req.body);
      const ref = getAdminDb().collection("drivers").doc(id);
      const before = await ref.get();
      if (!before.exists) throw new HttpError(404, "We couldn’t find that driver.");
      const labels = { approved: "Approved", suspended: "Suspended", rejected: "Rejected", pending_review: "Pending Approval" } as const;
      await ref.update({
        "onboarding.state": state,
        [`onboarding.${state}At`]: FieldValue.serverTimestamp(),
        "kyc.status": state === "approved" ? "verified" : state === "pending_review" ? "pending" : state,
        "kyc.licenseVerification": state === "approved" ? "verified" : "pending",
        status: labels[state],
        statusReason: reason || null,
        ...(state === "approved" ? {} : { "availability.state": "offline" }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await persistAudit(req, "DRIVER_STATUS_UPDATED", `drivers/${id}`, { state, reason: reason || null }, before.data());
      res.json({ success: true, state });
    }),
  );

  app.post(
    "/api/admin/settings/:key",
    authenticate,
    requireRoles("dispatcher", "finance_admin"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const key = AdminSettingKeySchema.parse(req.params.key);
      const { value } = parseBody(AdminSettingUpdateSchema, req.body);
      if (["bank_accounts", "currency_rates", "feature_flags"].includes(key) && !hasRole(req.auth!, ["finance_admin"])) {
        throw new HttpError(403, "Only staff with Payments access can change this.");
      }
      const serialized = JSON.stringify(value);
      if (serialized.length > 500_000) throw new HttpError(413, "This is too much data to save at once.");
      if (["vehicle_types", "touring_packages", "touring_states", "international_tours", "car_hire_options", "tracking_locations"].includes(key) && !Array.isArray(value)) {
        throw new HttpError(400, "This setting is in the wrong format.");
      }
      if (["pricing_rules", "currency_rates", "bank_accounts", "feature_flags"].includes(key) && (!value || typeof value !== "object" || Array.isArray(value))) {
        throw new HttpError(400, "This setting is in the wrong format.");
      }

      const ref = getAdminDb().collection("settings").doc(key);
      const before = await ref.get();
      await ref.set({
        key,
        value,
        updatedBy: req.auth!.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      await persistAudit(req, "ADMIN_SETTING_UPDATED", `settings/${key}`, { key }, before.data(), { value });
      res.json({ success: true, key });
    }),
  );

  app.post(
    "/api/admin/hubs",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const hub = parseBody(HubSchema, req.body);
      const ref = await getAdminDb().collection("hubs").add({
        ...hub,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await persistAudit(req, "HUB_CREATED", `hubs/${ref.id}`, hub);
      res.status(201).json({ id: ref.id, ...hub, active: true });
    }),
  );

  app.delete(
    "/api/admin/hubs/:id",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = z.string().trim().min(3).max(160).parse(req.params.id);
      const { reason } = parseBody(AdminDeleteSchema, req.body);
      const ref = getAdminDb().collection("hubs").doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new HttpError(404, "We couldn’t find that pickup point.");
      await ref.delete();
      await persistAudit(req, "HUB_DELETED", `hubs/${id}`, { reason }, snapshot.data());
      res.json({ success: true });
    }),
  );

  app.post(
    "/api/admin/blocked-dates",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const block = parseBody(BlockedDateSchema, req.body);
      const existing = await getAdminDb().collection("blocked_dates").where("date", "==", block.date).limit(1).get();
      if (!existing.empty) throw new HttpError(409, "That day is already closed.");
      const ref = await getAdminDb().collection("blocked_dates").add({
        ...block,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: req.auth!.uid,
      });
      await persistAudit(req, "SERVICE_DATE_BLOCKED", `blocked_dates/${ref.id}`, block);
      res.status(201).json({ id: ref.id, ...block });
    }),
  );

  app.delete(
    "/api/admin/blocked-dates/:id",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const id = z.string().trim().min(3).max(160).parse(req.params.id);
      const { reason } = parseBody(AdminDeleteSchema, req.body);
      const ref = getAdminDb().collection("blocked_dates").doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new HttpError(404, "We couldn’t find that closed day.");
      await ref.delete();
      await persistAudit(req, "SERVICE_DATE_RESTORED", `blocked_dates/${id}`, { reason }, snapshot.data());
      res.json({ success: true });
    }),
  );

  app.post(
    "/api/admin/payments/reconcile",
    authenticate,
    requireRoles("finance_admin"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const input = parseBody(PaymentReconciliationSchema, req.body);
      const ref = getAdminDb().collection("payments").doc(input.paymentId);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw new HttpError(404, "We couldn’t find that payment.");
      const now = new Date().toISOString();
      await ref.update({
        isReconciled: input.reconciled,
        reconciledAt: input.reconciled ? now : null,
        reconciledBy: input.reconciled ? req.auth!.email : null,
        reconciliationNotes: input.notes || null,
        events: FieldValue.arrayUnion({
          id: crypto.randomUUID(),
          eventType: "RECONCILED",
          actorId: req.auth!.uid,
          actorEmail: req.auth!.email,
          actorRole: req.auth!.role,
          timestamp: now,
          notes: input.notes || (input.reconciled ? "Marked reconciled" : "Reconciliation reopened"),
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await persistAudit(req, input.reconciled ? "PAYMENT_RECONCILED" : "PAYMENT_RECONCILIATION_REOPENED", `payments/${input.paymentId}`, { notes: input.notes || null });
      res.json({ success: true, reconciled: input.reconciled });
    }),
  );

  app.get(
    "/api/admin/maintenance/diagnostics",
    authenticate,
    requireRoles("super_admin"),
    asyncHandler(async (_req, res) => {
      const db = getAdminDb();
      const [bookings, payments, drivers, failedNotifications] = await Promise.all([
        db.collection("bookings").limit(500).get(),
        db.collection("payments").limit(500).get(),
        db.collection("drivers").limit(500).get(),
        db.collection("notification_logs").where("deliveryState", "==", "failed").limit(100).get(),
      ]);
      const bookingRows = bookings.docs.map((doc) => doc.data());
      res.json({
        checkedAt: new Date().toISOString(),
        counts: { bookings: bookings.size, payments: payments.size, drivers: drivers.size, failedNotifications: failedNotifications.size },
        issues: {
          bookingsMissingCustomer: bookingRows.filter((booking) => !booking.customerId || !booking.customerEmail).length,
          bookingsMissingRoute: bookingRows.filter((booking) => !booking.pickup || !booking.destination).length,
          bookingsMissingAmount: bookingRows.filter((booking) => !Number(booking.totalAmount)).length,
        },
      });
    }),
  );

  app.post(
    "/api/admin/maintenance/archive-bookings",
    authenticate,
    requireRoles("super_admin"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const input = parseBody(ArchiveBookingsSchema, req.body);
      const cutoff = Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000;
      const snapshot = await getAdminDb().collection("bookings").orderBy("createdAt", "asc").limit(400).get();
      const eligible = snapshot.docs.filter((bookingDoc) => {
        const booking = bookingDoc.data();
        const createdAt = booking.createdAt?.toDate?.()?.getTime?.() || Date.parse(String(booking.date || booking.createdAt || ""));
        return ["Completed", "Cancelled"].includes(String(booking.status)) && Number.isFinite(createdAt) && createdAt < cutoff;
      }).slice(0, 200);

      if (eligible.length === 0) return res.json({ success: true, archived: 0 });
      const batch = getAdminDb().batch();
      for (const bookingDoc of eligible) {
        batch.set(getAdminDb().collection("archived_bookings").doc(bookingDoc.id), {
          ...bookingDoc.data(),
          sourceBookingId: bookingDoc.id,
          archivedBy: req.auth!.uid,
          archivedReason: input.reason,
          archivedAt: FieldValue.serverTimestamp(),
        });
        batch.delete(bookingDoc.ref);
      }
      await batch.commit();
      await persistAudit(req, "BOOKINGS_ARCHIVED", "bookings", { count: eligible.length, olderThanDays: input.olderThanDays, reason: input.reason });
      res.json({ success: true, archived: eligible.length });
    }),
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Search-engine files built from APP_URL so they always point at the live address.
  const siteUrl = () => (process.env.APP_URL || "").replace(/\/$/, "");
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /driver\nSitemap: ${siteUrl()}/sitemap.xml\n`);
  });
  app.get("/sitemap.xml", (_req, res) => {
    const slugs = company.services.map((service) => service.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    const pages = ["/", "/services", ...slugs.map((slug) => `/services/${slug}`), "/tracking", "/reviews", "/legal"];
    const urls = pages.map((page) => `  <url><loc>${siteUrl()}${page}</loc></url>`).join("\n");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const error = err instanceof HttpError ? err : new HttpError(500, "Something went wrong on our side. Please try again.");
    log(error.status >= 500 ? "error" : "warn", error.message, {
      path: req.path,
      method: req.method,
      status: error.status,
      details: error.details,
      // The customer sees a friendly message; the log keeps the real cause.
      cause: err instanceof HttpError ? undefined : err instanceof Error ? err.stack || err.message : String(err),
    });
    if (error.status >= 500) {
      Sentry.captureException(err, { extra: { path: req.path, method: req.method } });
    }
    res.status(error.status).json({
      error: error.message,
      details: isProduction ? undefined : error.details,
    });
  });

  if (!isProduction) {
    // Vite is only needed while developing; production serves the prebuilt dist folder.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(path.join(distPath, "index.html"))) {
      throw new Error("dist/index.html is missing. Run \"npm run build\" before \"npm start\".");
    }
    // Hashed bundles never change, so browsers may cache them for a year; pages are always revalidated.
    app.use("/assets", express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y" }));
    app.use(express.static(distPath, { maxAge: "1h", index: false }));
    app.get("*", (_req, res) => {
      res.set("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    log("info", "Server running", { url: `http://0.0.0.0:${PORT}` });
  });
}

startServer().catch((error) => {
  log("error", "Server failed to start", { error: error instanceof Error ? error.stack || error.message : String(error) });
  process.exit(1);
});
