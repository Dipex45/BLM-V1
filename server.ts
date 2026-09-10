import "dotenv/config";
import crypto from "node:crypto";
import express, { NextFunction, Request, Response } from "express";
import { createServer as createViteServer } from "vite";
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

type RealtimeEvent = {
  id: string;
  type: string;
  audience?: "admin" | "all";
  userIds?: string[];
  payload: Record<string, unknown>;
  createdAt: string;
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

const productionEnvironmentKeys = [
  "APP_URL",
  "CORS_ORIGINS",
  "FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "REDIS_URL",
  "VITE_STRIPE_PUBLISHABLE_KEY",
  "PAYSTACK_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "NOTIFICATION_EMAIL_FROM",
  "SUPPORT_ALERT_EMAIL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "TWILIO_WHATSAPP_FROM",
  "GOOGLE_MAPS_PLATFORM_KEY",
  "SENTRY_DSN",
];

function validateEnvironment() {
  const missing = productionEnvironmentKeys.filter((key) => !process.env[key]?.trim());
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() && !process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    missing.push("FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS");
  }
  if (isProduction && missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  return missing;
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
  pricingSnapshot: z.record(z.string(), z.unknown()).optional(),
}).omit({ totalAmount: true });

const SupportedCurrencySchema = z.enum(["NGN", "XOF", "GHS", "USD", "EUR", "GBP"]);
const CURRENCY_RATES_FROM_NGN: Record<z.infer<typeof SupportedCurrencySchema>, number> = {
  NGN: 1,
  XOF: 0.41,
  GHS: 0.0097,
  USD: 0.00067,
  EUR: 0.00062,
  GBP: 0.00053,
};

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

const DriverNotifySchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  driverId: z.string().trim().min(1).max(160).optional(),
  driverPhone: z.string().trim().min(5).max(40).optional(),
  driverName: z.string().trim().max(160).optional(),
  pickup: z.string().trim().max(200).optional(),
  destination: z.string().trim().max(200).optional(),
});

const PromoteAdminSchema = z.object({
  uid: z.string().trim().min(3).max(160),
  role: z.enum(["super_admin", "dispatcher", "finance_admin", "customer_support_agent"]).default("dispatcher"),
});

const DriverOnboardingSchema = z.object({
  name: z.string().trim().min(2).max(160),
  license: z.string().trim().min(3).max(80),
  phone: z.string().trim().min(5).max(40),
  authUid: z.string().trim().min(3).max(160),
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
]);

const AdminSettingUpdateSchema = z.object({ value: z.unknown() });

const PaymentReconciliationSchema = z.object({
  paymentId: z.string().trim().min(3).max(160),
  reconciled: z.boolean(),
  notes: z.string().trim().max(500).optional(),
});

const ClientAuditSchema = z.object({
  action: z.string().trim().min(2).max(100),
  resource: z.string().trim().min(1).max(240).default("client"),
  details: z.record(z.string(), z.unknown()).default({}),
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

const RouteDistanceSchema = z.object({
  origin: z.string().trim().min(3).max(200),
  destination: z.string().trim().min(3).max(200),
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
    throw new HttpError(403, "Invalid or missing CSRF token");
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
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new HttpError(503, "STRIPE_SECRET_KEY is missing");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0];

  const serviceJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceJson) {
    const serviceAccount = JSON.parse(serviceJson);
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

function getAdminDb() {
  return getFirestore(initializeFirebaseAdmin());
}

const defaultFeatureFlags = {
  paystack: true,
  stripe: true,
  manualBankTransfer: true,
  liveTracking: true,
  whatsappNotifications: true,
  smsNotifications: true,
  french: true,
};

async function getFeatureFlags() {
  const snapshot = await getAdminDb().collection("settings").doc("feature_flags").get();
  const value = snapshot.data()?.value;
  return { ...defaultFeatureFlags, ...(value && typeof value === "object" ? value : {}) };
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
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY;
  if (!key) return null;
  const response = await axios.get("https://maps.googleapis.com/maps/api/distancematrix/json", {
    params: { origins: origin, destinations: destination, mode: "driving", departure_time: "now", key },
    timeout: 12_000,
  });
  const element = response.data?.rows?.[0]?.elements?.[0];
  if (response.data?.status !== "OK" || element?.status !== "OK") {
    throw new HttpError(422, "The route could not be calculated. Check the pickup and destination.");
  }
  return {
    distanceKm: Number((Number(element.distance.value) / 1000).toFixed(1)),
    distanceMeters: Number(element.distance.value),
    durationSeconds: Number(element.duration_in_traffic?.value || element.duration?.value || 0),
    distanceText: String(element.distance.text || ""),
    durationText: String(element.duration_in_traffic?.text || element.duration?.text || ""),
  };
}

async function calculateAuthoritativeQuote(input: z.infer<typeof BookingCreateSchema>) {
  const settings = getAdminDb().collection("settings");
  const [rulesSnap, vehiclesSnap, packagesSnap, statesSnap, countriesSnap, carsSnap, hubsSnap] = await Promise.all([
    settings.doc("pricing_rules").get(),
    settings.doc("vehicle_types").get(),
    settings.doc("touring_packages").get(),
    settings.doc("touring_states").get(),
    settings.doc("international_tours").get(),
    settings.doc("car_hire_options").get(),
    getAdminDb().collection("hubs").get(),
  ]);
  const rules = { pricePerKm: 350, logisticsPricePerKm: 250, standardServiceFee: 4500, pickupLogisticsFee: 22000, pricePerKg: 1200, tourGuideFee: 15000, carHireDriverDailyFee: 10000, carHireCautionFee: 25000, crossBorderProcessingFee: 30000, crossBorderBasePerPassenger: 90000, returnMultiplier: 2, weekendSurchargePercent: 0, nightSurchargePercent: 0, ...(rulesSnap.data()?.value || {}) };
  const vehicles = Array.isArray(vehiclesSnap.data()?.value) ? vehiclesSnap.data()!.value : [];
  const packages = Array.isArray(packagesSnap.data()?.value) ? packagesSnap.data()!.value : [];
  const states = Array.isArray(statesSnap.data()?.value) ? statesSnap.data()!.value : [];
  const countries = Array.isArray(countriesSnap.data()?.value) ? countriesSnap.data()!.value : [];
  const cars = Array.isArray(carsSnap.data()?.value) ? carsSnap.data()!.value : [];
  const hubs = hubsSnap.docs.map((document) => ({ id: document.id, ...document.data() } as Record<string, any>));
  const service = input.serviceType.toLowerCase();
  const snapshot = input.pricingSnapshot || {};
  let basePrice = 0;
  let extraFee = 0;
  let feeLabel = "Service fee";
  let routeMetadata: Awaited<ReturnType<typeof getRouteDistance>> = null;

  if (service.includes("long") || service.includes("short") || service.includes("distance")) {
    const vehicle = vehicles.find((item: any) => String(item.title).toLowerCase() === input.vehicleClass.toLowerCase());
    if (vehicles.length > 0 && !vehicle) throw new HttpError(422, "The selected vehicle class is no longer available");
    routeMetadata = await getRouteDistance(input.pickup, input.destination);
    const distanceKm = routeMetadata?.distanceKm || Math.max(Number(snapshot.distanceKm || 0), 1);
    const kmRate = Number(vehicle?.kmRate || rules.pricePerKm);
    basePrice = Math.round(distanceKm * kmRate * (input.isReturn ? Number(rules.returnMultiplier) : 1));
    extraFee = Number(rules.standardServiceFee);
    feeLabel = `${distanceKm} km at NGN ${kmRate}/km plus service fee`;
  } else if (service.includes("car hire")) {
    const car = cars.find((item: any) => item.id === input.carHireVehicle);
    if (cars.length > 0 && !car) throw new HttpError(422, "The selected hire vehicle is no longer in the fleet catalogue");
    if (car?.available === false) throw new HttpError(409, "The selected hire vehicle is currently unavailable");
    const selectedHub = hubs.find((hub) => hub.name === input.pickupHub || hub.location === input.pickupHub || hub.address === input.pickupHub);
    if (hubs.length > 0 && (!selectedHub || selectedHub.active === false)) {
      throw new HttpError(422, "The selected pickup location is no longer available");
    }
    const genericVehicle = vehicles.find((item: any) => String(item.title).toLowerCase().includes("car hire")) || {};
    const days = Math.max(Number(input.carHireDurationDays || 1), 1);
    basePrice = Number(car?.pricePerDay || genericVehicle.price || 70000) * days;
    extraFee = Number(rules.carHireCautionFee) + (input.carHireWithDriver ? Number(rules.carHireDriverDailyFee) * days : 0);
    feeLabel = "Refundable caution deposit and selected driver fee";
  } else if (service.includes("tour")) {
    const packageFallbacks: Record<string, number> = { "city discovery": 90000, "cultural trail": 140000, "signature escape": 200000, "grand expedition": 280000, "royal journey": 400000 };
    const selectedPackage = packages.find((item: any) => item.id === input.touringPackage || item.name === input.touringPackage || item.title === input.touringPackage) || {};
    const state = states.find((item: any) => item.name === input.touringState) || {};
    if (packages.length > 0 && !Object.keys(selectedPackage).length) throw new HttpError(422, "The selected touring package is no longer available");
    if (states.length > 0 && !Object.keys(state).length) throw new HttpError(422, "The selected touring destination is no longer available");
    const packageKey = String(input.touringPackage || "city discovery").toLowerCase();
    basePrice = Math.round(Number(selectedPackage.price || packageFallbacks[packageKey] || 90000) * Number(state.factor || 1));
    extraFee = input.tourGuideNeeded ? Number(rules.tourGuideFee) : 0;
    feeLabel = `${selectedPackage.locations || snapshot.locations || "Curated"} planned sightseeing stops`;
  } else if (service.includes("cross-border") || service.includes("cross border")) {
    const country = countries.find((item: any) => item.name === input.internationalCountry);
    if (countries.length > 0 && !country) throw new HttpError(422, "The selected international destination is no longer available");
    const passengers = Math.max(Number(input.passengerCount || 1), 1);
    basePrice = Math.round(Number(rules.crossBorderBasePerPassenger) * passengers * Number(country?.factor || 1.1));
    extraFee = input.borderClearanceHelp ? Number(rules.crossBorderProcessingFee) : 0;
    feeLabel = `${passengers} passenger${passengers === 1 ? "" : "s"}${extraFee ? " plus border support" : ""}`;
  } else if (service.includes("pickup") || service.includes("logistics")) {
    const vehicle = vehicles.find((item: any) => String(item.title).toLowerCase().includes("logistics")) || {};
    routeMetadata = await getRouteDistance(input.pickup, input.destination);
    const distanceKm = routeMetadata?.distanceKm || Math.max(Number(snapshot.distanceKm || 0), 1);
    const weightKg = Math.max(Number(input.packageWeightKg || 1), 1);
    basePrice = Number(vehicle.price || 65000) + Math.round(distanceKm * Number(rules.logisticsPricePerKm));
    extraFee = Number(rules.pickupLogisticsFee) + Math.round(weightKg * Number(rules.pricePerKg));
    feeLabel = `${distanceKm} km route, handling and ${weightKg} kg cargo`;
  } else {
    const vehicle = vehicles.find((item: any) => String(item.title).toLowerCase() === input.vehicleClass.toLowerCase()) || {};
    basePrice = Number(vehicle.price || 25000);
    extraFee = Number(rules.standardServiceFee);
  }

  const subtotal = Math.round(basePrice + extraFee);
  const travelDate = new Date(`${input.date}T${input.time}:00`);
  const weekend = [0, 6].includes(travelDate.getDay());
  const night = travelDate.getHours() < 6 || travelDate.getHours() >= 22;
  const weekendSurcharge = weekend ? Math.round(subtotal * Number(rules.weekendSurchargePercent || 0) / 100) : 0;
  const nightSurcharge = night ? Math.round(subtotal * Number(rules.nightSurchargePercent || 0) / 100) : 0;
  return { basePrice, extraFee, feeLabel, weekendSurcharge, nightSurcharge, total: subtotal + weekendSurcharge + nightSurcharge, routeMetadata };
}

function getFirebaseAuth() {
  return getAdminAuth(initializeFirebaseAdmin());
}

const adminRoles: Role[] = ["super_admin", "dispatcher", "finance_admin", "customer_support_agent"];

function hasRole(user: AuthenticatedUser, roles: Role[]) {
  return roles.includes(user.role) || user.role === "super_admin";
}

async function resolveRole(decoded: DecodedIdToken): Promise<Role> {
  const claimRole = decoded.role || decoded.adminRole;
  if (typeof claimRole === "string" && isRole(claimRole)) {
    return normalizeRole(claimRole);
  }

  const db = getAdminDb();
  const adminDoc = await db.collection("admins").doc(decoded.uid).get();
  if (adminDoc.exists) {
    const data = adminDoc.data() || {};
    const storedRole = data.role || data.adminRole;
    if (typeof storedRole === "string" && isRole(storedRole)) {
      return normalizeRole(storedRole);
    }
    return "super_admin";
  }

  const userDoc = await db.collection("users").doc(decoded.uid).get();
  const userRole = userDoc.data()?.role;
  return typeof userRole === "string" && isRole(userRole) ? normalizeRole(userRole) : "customer";
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
  if (existing.data()?.revoked === true) throw new HttpError(401, "This device session has been revoked");

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
    throw new HttpError(401, "Missing bearer token");
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
    throw new HttpError(403, "Email verification is required");
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
    if (!req.auth) throw new HttpError(401, "Authentication required");
    if (!hasRole(req.auth, roles)) {
      throw new HttpError(403, "Insufficient permissions");
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

    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
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

  async enqueue(name: QueueJobName, data: Record<string, unknown>, attempts = 3) {
    if (!this.enabled || !this.queue) {
      await processQueueJob(name, data);
      return { inline: true };
    }

    return this.queue.add(name, data, {
      attempts,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: false,
    });
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
    await publishRealtime({ type: "dispatch.assigned", audience: "admin", userIds: [String(booking.data()?.customerId || ""), chosen.id], payload: { bookingId, driverId: chosen.id } });
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
  const apiKey = process.env.RESEND_API_KEY;
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
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = whatsapp ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_FROM_NUMBER;
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
  const snapshot = await getAdminDb().collection("settings").doc("currency_rates").get();
  const configured = snapshot.data()?.value;
  const configuredRate = configured && typeof configured === "object" ? Number(configured[currency]) : Number.NaN;
  const rate = Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : CURRENCY_RATES_FROM_NGN[currency] || 1;
  return Number((amountInNgn * rate).toFixed(currency === "NGN" || currency === "XOF" ? 0 : 2));
}

async function loadBooking(bookingId: string, auth: AuthenticatedUser, adminAccessRoles: Role[] = adminRoles) {
  const ref = getAdminDb().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Booking not found");
  const booking = snap.data() || {};
  const ownerId = String(booking.customerId || "");
  if (ownerId !== auth.uid && !hasRole(auth, adminAccessRoles)) {
    throw new HttpError(403, "Booking access denied");
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
  const message = `Good day ${customerName}, your BLM booking ${booking.trackingId || bookingId} is now ${status}. Track it at ${(process.env.APP_URL || "").replace(/\/$/, "")}/tracking?booking=${encodeURIComponent(booking.trackingId || bookingId)}`;
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
      subject: `Booking status update: ${status}`,
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
    if (!paymentSnap.exists) throw new HttpError(404, "Payment record not found");
    const payment = paymentSnap.data() || {};
    const bookingRef = db.collection("bookings").doc(String(payment.bookingId));
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpError(404, "Booking record not found");
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
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new HttpError(503, "PAYSTACK_SECRET_KEY is missing");

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

const realtimeClients = new Map<string, { auth: AuthenticatedUser; res: Response }>();

function canReceiveEvent(user: AuthenticatedUser, event: RealtimeEvent) {
  if (event.audience === "all") return true;
  if (event.audience === "admin" && hasRole(user, adminRoles)) return true;
  if (event.userIds?.includes(user.uid)) return true;
  return false;
}

async function publishRealtime(event: Omit<RealtimeEvent, "id" | "createdAt">) {
  const fullEvent: RealtimeEvent = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await getAdminDb().collection("realtime_events").doc(fullEvent.id).set(fullEvent);

  for (const [id, client] of realtimeClients) {
    if (!canReceiveEvent(client.auth, fullEvent)) continue;
    try {
      client.res.write(`event: ${fullEvent.type}\n`);
      client.res.write(`data: ${JSON.stringify(fullEvent)}\n\n`);
    } catch (error) {
      realtimeClients.delete(id);
    }
  }
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
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json", limit: "256kb" }),
    asyncHandler(async (req, res) => {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) throw new HttpError(503, "STRIPE_WEBHOOK_SECRET is missing");

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
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) throw new HttpError(503, "PAYSTACK_SECRET_KEY is missing");

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
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again later" },
  });
  const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many payment attempts, please try again later" },
  });
  app.use("/api", generalLimiter);

  app.get("/api/health", asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      redis: operationsQueue.enabled ? "connected" : "missing",
      queues: operationsQueue.enabled ? "bullmq" : "inline_degraded",
      firebaseAdmin: "configured_lazily",
      providers: {
        resend: Boolean(process.env.RESEND_API_KEY),
        twilio: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
        paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
        whatsapp: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM),
        maps: Boolean(process.env.GOOGLE_MAPS_PLATFORM_KEY),
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
        paystack: Boolean(flags.paystack && process.env.PAYSTACK_SECRET_KEY),
        stripe: Boolean(flags.stripe && process.env.STRIPE_SECRET_KEY),
        manualBankTransfer: Boolean(flags.manualBankTransfer && bank.configured),
      },
      mapsEnabled: Boolean(flags.liveTracking && process.env.GOOGLE_MAPS_PLATFORM_KEY),
    });
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
    await persistAudit(req, "AUTH_SESSION_SYNC", `users/${req.auth!.uid}`);
    res.json({
      uid: req.auth!.uid,
      email: req.auth!.email,
      role: req.auth!.role,
      emailVerified: req.auth!.emailVerified,
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
    if (!snapshot.exists || snapshot.data()?.userId !== req.auth!.uid) throw new HttpError(404, "Session not found");
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

  app.post("/api/audit", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const event = parseBody(ClientAuditSchema, req.body);
    await persistAudit(req, event.action, event.resource, event.details);
    res.status(201).json({ success: true });
  }));

  app.post("/api/payment/manual/initialize", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    const { bookingId } = parseBody(ManualPaymentSchema, req.body);
    const [flags, bank] = await Promise.all([getFeatureFlags(), getBankConfig()]);
    if (!flags.manualBankTransfer || !bank.configured) {
      throw new HttpError(503, "Manual bank transfer is not configured");
    }

    const { ref: bookingRef, booking } = await loadBooking(bookingId, req.auth!, ["finance_admin", "customer_support_agent"]);
    if (!["Quoted", "Booked"].includes(String(booking.status))) {
      throw new HttpError(409, "Booking is not payable in its current state");
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
    if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Booking amount is invalid");

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
    if (!snapshot.exists) throw new HttpError(404, "Payment record not found");
    const payment = snapshot.data() || {};
    if (payment.customerId !== req.auth!.uid && !hasRole(req.auth!, ["finance_admin", "customer_support_agent"])) {
      throw new HttpError(403, "You cannot update this payment");
    }
    if (["PAID", "REFUNDED"].includes(String(payment.status))) throw new HttpError(409, "Payment is already finalized");

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
    if (!paymentSnapshot.exists) throw new HttpError(404, "Payment record not found");
    const payment = paymentSnapshot.data() || {};
    if (payment.provider !== "manual_bank_transfer") throw new HttpError(400, "Payment is not a manual transfer");
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

  app.post("/api/routes/distance", paymentLimiter, requireCsrf, asyncHandler(async (req, res) => {
    const { origin, destination } = parseBody(RouteDistanceSchema, req.body);
    const route = await getRouteDistance(origin, destination);
    if (!route) throw new HttpError(503, "Google Maps distance calculation is not configured");
    res.json(route);
  }));

  app.post("/api/validate-booking", asyncHandler(async (req, res) => {
    const validatedData = parseBody(BookingValidationSchema, req.body);
    res.json({ status: "validated", data: validatedData });
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
    if (String(booking.status) !== "Completed") throw new HttpError(409, "Reviews are available after the booking is completed");
    const existing = await getAdminDb().collection("reviews").where("bookingId", "==", payload.bookingId).limit(1).get();
    if (!existing.empty) throw new HttpError(409, "A review has already been submitted for this booking");
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
      subject: `${input.priority === "urgent" ? "Urgent " : ""}support ticket: ${input.subject}`,
      body: `${req.auth!.email || "A customer"} opened ticket ${ticketRef.id}. ${input.message}`,
      template: "support_ticket_created",
      metadata: { ticketId: ticketRef.id, customerId: req.auth!.uid },
    });
    await persistAudit(req, "SUPPORT_TICKET_CREATED", `support_tickets/${ticketRef.id}`, { category: input.category, priority: input.priority });
    res.status(201).json({ id: ticketRef.id });
  }));

  app.get("/api/support/tickets/:id/messages", authenticate, asyncHandler(async (req, res) => {
    const id = z.string().trim().min(3).max(160).parse(req.params.id);
    const ticket = await getAdminDb().collection("support_tickets").doc(id).get();
    if (!ticket.exists) throw new HttpError(404, "Support ticket not found");
    const data = ticket.data() || {};
    if (data.customerId !== req.auth!.uid && !hasRole(req.auth!, ["customer_support_agent"])) throw new HttpError(403, "Support ticket access denied");
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
    if (!ticket.exists) throw new HttpError(404, "Support ticket not found");
    const data = ticket.data() || {};
    const supportAgent = hasRole(req.auth!, ["customer_support_agent"]);
    if (data.customerId !== req.auth!.uid && !supportAgent) throw new HttpError(403, "Support ticket access denied");
    if (data.status === "closed") throw new HttpError(409, "Closed tickets cannot receive replies");
    const messageRef = database.collection("support_conversations").doc(id).collection("messages").doc();
    const batch = database.batch();
    batch.set(messageRef, { senderId: req.auth!.uid, senderRole: req.auth!.role, message, createdAt: FieldValue.serverTimestamp() });
    batch.update(ticketRef, { status: supportAgent ? "waiting_customer" : "open", lastMessagePreview: message.slice(0, 180), updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
    if (supportAgent && data.customerEmail) {
      await queueNotification({ channel: "email", to: String(data.customerEmail), subject: `BLM support update: ${data.subject}`, body: message, template: "support_ticket_reply", metadata: { ticketId: id } });
    }
    if (supportAgent && data.phone && (await getFeatureFlags()).whatsappNotifications) {
      await queueNotification({ channel: "whatsapp", to: String(data.phone), body: `BLM Support: ${message}`, template: "support_ticket_reply", metadata: { ticketId: id } });
    }
    await persistAudit(req, "SUPPORT_MESSAGE_CREATED", `support_tickets/${id}`, { senderRole: req.auth!.role });
    res.status(201).json({ id: messageRef.id });
  }));

  app.post("/api/support/tickets/:id/status", authenticate, requireRoles("customer_support_agent"), requireCsrf, asyncHandler(async (req, res) => {
    const id = z.string().trim().min(3).max(160).parse(req.params.id);
    const update = parseBody(SupportStatusSchema, req.body);
    const ref = getAdminDb().collection("support_tickets").doc(id);
    const ticket = await ref.get();
    if (!ticket.exists) throw new HttpError(404, "Support ticket not found");
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
    if (!bookingSnap.exists) throw new HttpError(404, "Tracking reference not found");

    const bookingId = bookingSnap.id;
    const booking = bookingSnap.data() || {};
    const eventsSnap = await getAdminDb()
      .collection("booking_events")
      .where("bookingId", "==", bookingId)
      .orderBy("createdAt", "desc")
      .limit(8)
      .get()
      .catch(() => null);

    const events = eventsSnap?.docs.map((doc) => {
      const event = doc.data();
      return {
        id: doc.id,
        type: event.type || "booking.update",
        metadata: event.metadata || {},
        createdAt: event.createdAt?.toDate?.().toISOString?.() || null,
      };
    }) || [];

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
      if (!(await getFeatureFlags()).stripe) throw new HttpError(503, "Stripe payments are disabled");
      const { bookingId, currency: requestedCurrency } = parseBody(StripeIntentSchema, req.body);
      const { booking } = await loadBooking(bookingId, req.auth!, ["finance_admin", "customer_support_agent"]);
      if (!["Quoted", "Booked"].includes(String(booking.status))) {
        throw new HttpError(409, "Booking is not payable in its current state");
      }

      const existing = await findExistingPayment(bookingId, "stripe");
      if (existing?.data.status === "succeeded") {
        throw new HttpError(409, "Booking has already been paid");
      }
      if (existing?.data.clientSecret) {
        return res.json({ clientSecret: existing.data.clientSecret, paymentId: existing.id, reused: true });
      }

      const baseAmount = Number(booking.totalAmount || 0);
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) throw new HttpError(400, "Booking amount is invalid");
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
        subject: "Booking payment started",
        body: `Your payment for booking ${bookingId} has been initialized. We will confirm it after server-side reconciliation.`,
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
      if (!intent.metadata?.bookingId) throw new HttpError(400, "Payment intent is missing booking metadata");
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
        throw new HttpError(403, "Refund access denied");
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
        throw new HttpError(403, "Refund payment intent does not belong to this booking");
      }
      const intentId = payment?.providerPaymentId || booking.paymentIntentId;
      if (!intentId) throw new HttpError(404, "No refundable Stripe payment found for this booking");

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
        subject: "Refund initiated",
        body: `A refund has been initiated for booking ${bookingId}. Status: ${refund.status}.`,
        template: "refund_initiated",
        metadata: { bookingId, refundId: refund.id },
      });

      await publishRealtime({
        type: "booking.refund_created",
        userIds: [String(booking.customerId)],
        audience: "admin",
        payload: { bookingId, refundId: refund.id, status: refund.status },
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
      if (!(await getFeatureFlags()).paystack) throw new HttpError(503, "Paystack payments are disabled");
      const { bookingId, currency: requestedCurrency } = parseBody(PaystackInitializeSchema, req.body);
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) throw new HttpError(503, "PAYSTACK_SECRET_KEY is missing");

      const { booking } = await loadBooking(bookingId, req.auth!, ["finance_admin", "customer_support_agent"]);
      if (!["Quoted", "Booked"].includes(String(booking.status))) {
        throw new HttpError(409, "Booking is not payable in its current state");
      }

      const existing = await findExistingPayment(bookingId, "paystack");
      if (existing?.data.status === "succeeded") {
        throw new HttpError(409, "Booking has already been paid");
      }

      const baseAmount = Number(booking.totalAmount || 0);
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) throw new HttpError(400, "Booking amount is invalid");
      const currency = String(requestedCurrency || booking.checkoutCurrency || booking.displayCurrency || booking.currency || "NGN").toUpperCase() as z.infer<typeof SupportedCurrencySchema>;
      SupportedCurrencySchema.parse(currency);
      if (!["NGN", "GHS"].includes(currency)) {
        throw new HttpError(400, "Paystack checkout is enabled for NGN and GHS only. Use Stripe for this currency.");
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
      if (paymentSnap.empty) throw new HttpError(404, "Paystack payment reference not found");

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
      await publishRealtime({
        type: "booking.status_updated",
        userIds: [String(booking.customerId)],
        audience: "admin",
        payload: { bookingId, status, assignedDriverId: assignedDriverId || null },
      });

      res.json({ success: true });
    }),
  );

  app.post(
    "/api/drivers/notify",
    authenticate,
    requireRoles("dispatcher", "customer_support_agent"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const payload = parseBody(DriverNotifySchema, req.body);
      let driver: Record<string, unknown> = {};
      if (payload.driverId) {
        const driverSnap = await getAdminDb().collection("drivers").doc(payload.driverId).get();
        driver = driverSnap.data() || {};
      }
      const { booking } = await loadBooking(payload.bookingId, req.auth!, ["dispatcher", "customer_support_agent"]);
      const phone = payload.driverPhone || String(driver.phone || "");
      if (!phone) throw new HttpError(400, "Driver phone is required");

      await queueNotification({
        channel: "sms",
        to: phone,
        body: `DISPATCH ALERT: ${payload.driverName || driver.name || "Driver"}, booking ${payload.bookingId}. Route: ${
          payload.pickup || booking.pickup
        } -> ${payload.destination || booking.destination}.`,
        template: "driver_dispatch_alert",
        metadata: { bookingId: payload.bookingId, driverId: payload.driverId || null },
      });

      await persistAudit(req, "DRIVER_NOTIFIED", `bookings/${payload.bookingId}`, { driverId: payload.driverId || null });
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
        throw new HttpError(409, "Booking cannot be cancelled in its current state");
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
      await publishRealtime({
        type: "booking.cancelled",
        userIds: [String(booking.customerId)],
        audience: "admin",
        payload: { bookingId },
      });

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
        if (!bookingSnap.exists) throw new HttpError(404, "Booking not found");
        if (!driverSnap.exists) throw new HttpError(404, "Driver not found");

        const booking = bookingSnap.data() || {};
        const driver = driverSnap.data() || {};
        if (!["Paid", "Confirmed", "Dispatched", "InTransit"].includes(String(booking.status))) {
          throw new HttpError(409, "This booking is not ready for driver assignment");
        }
        if (["suspended", "rejected"].includes(String(driver.onboardingStatus || "").toLowerCase())) {
          throw new HttpError(409, "This driver is not approved for assignments");
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
          body: `DISPATCH ALERT: booking ${bookingId}. Route: ${result.booking.pickup || "Pickup"} -> ${result.booking.destination || "Destination"}.`,
          template: "driver_dispatch_alert",
          metadata: { bookingId, driverId },
        });
      }
      await persistAudit(req, "DRIVER_ASSIGNED", `bookings/${bookingId}`, { driverId, previousDriverId: result.previousDriverId || null });
      await publishRealtime({
        type: "dispatch.assigned",
        audience: "admin",
        userIds: [String(result.booking.customerId || ""), driverId].filter(Boolean),
        payload: { bookingId, driverId },
      });
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
        throw new HttpError(409, "No available driver found");
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
      await publishRealtime({
        type: "dispatch.assigned",
        audience: "admin",
        userIds: [String(booking.customerId), chosen.id],
        payload: { bookingId, driverId: chosen.id },
      });
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
      await publishRealtime({ type: "booking.checkpoint_updated", audience: "admin", userIds: [String(booking.customerId || "")], payload: { bookingId: update.bookingId, location: update.location, status: update.status } });
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
      const firebaseUser = await getFirebaseAuth().getUser(driver.authUid).catch(() => null);
      if (!firebaseUser) throw new HttpError(404, "No Firebase user exists for this driver UID");
      const adminRecord = await getAdminDb().collection("admins").doc(driver.authUid).get();
      if (adminRecord.exists) throw new HttpError(409, "An admin account cannot also be linked as a driver");

      const ref = getAdminDb().collection("drivers").doc(driver.authUid);
      const existing = await ref.get();
      if (existing.exists) throw new HttpError(409, "This Firebase user is already linked to a driver profile");

      await ref.set({
        authUid: driver.authUid,
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
      await getAdminDb().collection("users").doc(driver.authUid).set({
        uid: driver.authUid,
        email: firebaseUser.email || null,
        fullName: driver.name,
        role: "driver",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      await getFirebaseAuth().setCustomUserClaims(driver.authUid, {
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
      if (!driver) throw new HttpError(404, "Driver profile is not linked to this account");
      if (location.bookingId) {
        const booking = await getAdminDb().collection("bookings").doc(location.bookingId).get();
        if (!booking.exists || booking.data()?.assignedDriverId !== driver.id) {
          throw new HttpError(403, "This booking is not assigned to the signed-in driver");
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
      await publishRealtime({
        type: "driver.location_updated",
        audience: "admin",
        payload: { driverId: driver.id, ...location },
      });
      res.json({ success: true });
    }),
  );

  app.get(
    "/api/drivers/me/jobs",
    authenticate,
    requireRoles("driver"),
    asyncHandler(async (req, res) => {
      const driver = await resolveDriverForUser(req.auth!.uid);
      if (!driver) throw new HttpError(404, "Driver profile is not linked to this account");
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
      if (!driver) throw new HttpError(404, "Driver profile is not linked to this account");
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
      if (!driver) throw new HttpError(404, "Driver profile is not linked to this account");
      const bookingRef = getAdminDb().collection("bookings").doc(bookingId);
      const bookingSnap = await bookingRef.get();
      if (!bookingSnap.exists || bookingSnap.data()?.assignedDriverId !== driver.id) {
        throw new HttpError(403, "This booking is not assigned to the signed-in driver");
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
      await publishRealtime({ type: "booking.status_updated", audience: "admin", userIds: [String(booking.customerId || "")], payload: { bookingId, status, driverId: driver.id } });
      res.json({ success: true, status });
    }),
  );

  app.post(
    "/api/admin/users/role",
    authenticate,
    requireRoles("super_admin"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { uid, role } = parseBody(PromoteAdminSchema, req.body);
      await getAdminDb().collection("admins").doc(uid).set(
        {
          role,
          promotedBy: req.auth!.email,
          promotedByUid: req.auth!.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await persistAudit(req, "ADMIN_ROLE_GRANTED", `admins/${uid}`, { role });
      res.json({ success: true });
    }),
  );

  app.delete(
    "/api/admin/users/role/:uid",
    authenticate,
    requireRoles("super_admin"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const uid = z.string().trim().min(3).max(160).parse(req.params.uid);
      await getAdminDb().collection("admins").doc(uid).delete();
      await persistAudit(req, "ADMIN_ROLE_REVOKED", `admins/${uid}`);
      res.json({ success: true });
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
        throw new HttpError(403, "Finance administrator permission is required for this setting");
      }
      const serialized = JSON.stringify(value);
      if (serialized.length > 500_000) throw new HttpError(413, "Setting payload is too large");
      if (["vehicle_types", "touring_packages", "touring_states", "international_tours", "car_hire_options", "tracking_locations"].includes(key) && !Array.isArray(value)) {
        throw new HttpError(400, "This setting must be an array");
      }
      if (["pricing_rules", "currency_rates", "bank_accounts", "feature_flags"].includes(key) && (!value || typeof value !== "object" || Array.isArray(value))) {
        throw new HttpError(400, "This setting must be an object");
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
      if (!snapshot.exists) throw new HttpError(404, "Hub not found");
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
      if (!existing.empty) throw new HttpError(409, "This service date is already blocked");
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
      if (!snapshot.exists) throw new HttpError(404, "Blocked date not found");
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
      if (!snapshot.exists) throw new HttpError(404, "Payment not found");
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

  app.get("/api/realtime/events", authenticate, asyncHandler(async (req, res) => {
    const clientId = crypto.randomUUID();
    realtimeClients.set(clientId, { auth: req.auth!, res });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ clientId, role: req.auth!.role })}\n\n`);

    req.on("close", () => {
      realtimeClients.delete(clientId);
    });
  }));

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const error = err instanceof HttpError ? err : new HttpError(500, "Internal server error");
    log(error.status >= 500 ? "error" : "warn", error.message, {
      path: req.path,
      method: req.method,
      status: error.status,
      details: error.details,
    });
    if (error.status >= 500) {
      Sentry.captureException(err, { extra: { path: req.path, method: req.method } });
    }
    res.status(error.status).json({
      error: error.message,
      details: isProduction ? undefined : error.details,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
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
