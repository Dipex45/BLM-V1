import crypto from "node:crypto";
import express, { NextFunction, Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "node:path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Stripe from "stripe";
import axios from "axios";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { DecodedIdToken, getAuth as getAdminAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

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
const DEFAULT_EMAIL_FROM = process.env.NOTIFICATION_EMAIL_FROM || "BLM Motors <operations@blmmotors.com>";
const AI_DAILY_PROMPT_LIMIT = Number(process.env.AI_DAILY_PROMPT_LIMIT || 50);

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
  totalAmount: z.number().positive().max(1_000_000),
});

const StripeIntentSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  email: z.string().email().optional(),
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
});

const StatusUpdateSchema = z.object({
  bookingId: z.string().trim().min(3).max(160),
  status: BookingStatusSchema,
  assignedDriverId: z.string().trim().min(1).max(160).optional(),
  cancellationReason: z.string().trim().max(500).optional(),
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
  vehicleId: z.string().trim().max(160).optional(),
});

const DriverLocationSchema = z.object({
  bookingId: z.string().trim().max(160).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).max(240).optional(),
});

const AIRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(1200),
  context: z.string().trim().max(1000).optional(),
  conversationId: z.string().trim().min(3).max(160).optional(),
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

let genAI: GoogleGenerativeAI | null | undefined;
function getGemini() {
  if (genAI === undefined) {
    genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
  }
  return genAI;
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

async function recordSession(req: Request, auth: AuthenticatedUser) {
  const userAgent = req.get("user-agent") || "unknown";
  const ip = getClientIp(req);
  const sessionId = crypto.createHash("sha256").update(`${auth.uid}:${ip}:${userAgent}`).digest("hex");

  await getAdminDb()
    .collection("user_sessions")
    .doc(sessionId)
    .set(
      {
        userId: auth.uid,
        email: auth.email,
        role: auth.role,
        ip,
        userAgent,
        revoked: false,
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

function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  buildAuthenticatedUser(req, false)
    .then((auth) => {
      req.auth = auth;
      next();
    })
    .catch(() => next());
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
  | "dispatch.assign"
  | "route.recalculate"
  | "analytics.aggregate"
  | "fraud.analyze";

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

  await getAdminDb().collection("queue_jobs").add({
    name,
    data,
    status: "received",
    note: "Processor scaffold is registered; domain algorithm is pending provider implementation.",
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function queueNotification(input: {
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
  template: string;
  metadata?: Record<string, unknown>;
}) {
  const doc = await getAdminDb().collection("notification_logs").add({
    ...input,
    provider: input.channel === "email" ? "resend" : "twilio",
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
        : await sendSmsViaTwilio(String(notification.to), String(notification.body));

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

async function sendSmsViaTwilio(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    log("warn", "Twilio env missing; SMS notification blocked", { to });
    return "provider_not_configured";
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
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
  await db.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) throw new HttpError(404, "Payment record not found");
    const payment = paymentSnap.data() || {};
    const bookingRef = db.collection("bookings").doc(String(payment.bookingId));
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpError(404, "Booking record not found");
    const booking = bookingSnap.data() || {};

    if (payment.status === "succeeded") return;

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
  });
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

const aiQuota = new Map<string, { day: string; count: number }>();
const aiCache = new Map<string, { expiresAt: number; text: string; confidence: number; escalate: boolean }>();

async function consumeAiQuota(key: string) {
  const day = new Date().toISOString().slice(0, 10);
  if (operationsQueue?.connection) {
    const redisKey = `ai-quota:${day}:${key}`;
    const count = await operationsQueue.connection.incr(redisKey);
    if (count === 1) await operationsQueue.connection.expire(redisKey, 36 * 60 * 60);
    return count <= AI_DAILY_PROMPT_LIMIT;
  }

  const current = aiQuota.get(key);
  if (!current || current.day !== day) {
    aiQuota.set(key, { day, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= AI_DAILY_PROMPT_LIMIT;
}

function sanitizePrompt(prompt: string) {
  return prompt.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function looksLikePromptInjection(prompt: string) {
  return /(ignore|override|bypass).{0,30}(previous|system|developer|instruction|policy)/i.test(prompt);
}

function shouldEscalate(prompt: string) {
  return /(human|agent|refund|dispute|complaint|emergency|urgent|police|injur|stolen|fraud|chargeback)/i.test(prompt);
}

async function startServer() {
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
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    keyGenerator: (req) => req.auth?.uid || getClientIp(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI support rate limit exceeded" },
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
      },
    });
  }));

  app.get("/api/security/csrf-token", (_req, res) => {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie("blm_csrf", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: isProduction,
      path: "/",
      maxAge: 2 * 60 * 60 * 1000,
    });
    res.json({ token });
  });

  app.post("/api/auth/session", authenticate, requireCsrf, asyncHandler(async (req, res) => {
    await persistAudit(req, "AUTH_SESSION_SYNC", `users/${req.auth!.uid}`);
    res.json({
      uid: req.auth!.uid,
      email: req.auth!.email,
      role: req.auth!.role,
      emailVerified: req.auth!.emailVerified,
    });
  }));

  app.post("/api/validate-booking", asyncHandler(async (req, res) => {
    const validatedData = parseBody(BookingValidationSchema, req.body);
    res.json({ status: "validated", data: validatedData });
  }));

  app.post(
    "/api/payment/stripe/create-intent",
    paymentLimiter,
    authenticate,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const { bookingId } = parseBody(StripeIntentSchema, req.body);
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

      const currency = String(booking.currency || "USD").toLowerCase();
      const amount = Number(booking.totalAmount || 0);
      if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Booking amount is invalid");

      const paymentRef = getAdminDb().collection("payments").doc();
      const idempotencyKey =
        (req.get("x-idempotency-key") || `stripe-intent:${req.auth!.uid}:${bookingId}:${toMinorUnits(amount, currency)}`).slice(0, 255);
      const paymentIntent = await getStripe().paymentIntents.create(
        {
          amount: toMinorUnits(amount, currency),
          currency,
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
        amount,
        amountMinor: toMinorUnits(amount, currency),
        currency: currency.toUpperCase(),
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
      const { bookingId } = parseBody(PaystackInitializeSchema, req.body);
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

      const currency = String(booking.currency || "NGN").toUpperCase();
      const amount = Number(booking.totalAmount || 0);
      if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Booking amount is invalid");

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

      await queueNotification({
        channel: "email",
        to: String(booking.customerEmail || ""),
        subject: `Booking status update: ${status}`,
        body: `Hello ${booking.customerName || "Customer"}, your booking ${bookingId} is now ${status}.`,
        template: "booking_status_update",
        metadata: { bookingId, status },
      });

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
    "/api/drivers/onboard",
    authenticate,
    requireRoles("dispatcher"),
    requireCsrf,
    asyncHandler(async (req, res) => {
      const driver = parseBody(DriverOnboardingSchema, req.body);
      const ref = await getAdminDb().collection("drivers").add({
        profile: {
          name: driver.name,
          phone: driver.phone,
        },
        name: driver.name,
        phone: driver.phone,
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
      const ref = getAdminDb().collection("driver_locations").doc(req.auth!.uid);
      await ref.set(
        {
          driverId: req.auth!.uid,
          ...location,
          heartbeatAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await publishRealtime({
        type: "driver.location_updated",
        audience: "admin",
        payload: { driverId: req.auth!.uid, ...location },
      });
      res.json({ success: true });
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

  app.post(
    "/api/ai/generate",
    optionalAuthenticate,
    aiLimiter,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const ai = getGemini();
      if (!ai) throw new HttpError(503, "AI service is not configured on server");

      const { prompt, context, conversationId } = parseBody(AIRequestSchema, req.body);
      const sanitizedPrompt = sanitizePrompt(prompt);
      const quotaKey = req.auth?.uid || getClientIp(req);
      const hasQuota = await consumeAiQuota(quotaKey);
      if (!hasQuota) throw new HttpError(429, "AI support daily quota exceeded");

      if (looksLikePromptInjection(sanitizedPrompt)) {
        const fallback = "I cannot follow requests to override safety or support instructions. I can still help with bookings, tracking, payments, or connect this to a human support ticket.";
        return res.json({ text: fallback, confidence: 0.2, escalate: true });
      }

      const cacheKey = crypto.createHash("sha256").update(`${context || ""}:${sanitizedPrompt}`).digest("hex");
      const cached = aiCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json({ ...cached, cached: true });
      }

      const escalate = shouldEscalate(sanitizedPrompt);
      const model = ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
      const result = await model.generateContent([
        `You are the BLM Motors logistics support assistant.
Answer only about bookings, payments, refunds, delivery tracking, dispatch, driver arrival, or account support.
Do not make policy promises, legal claims, or payment confirmations without server records.
Escalate uncertain, emergency, refund, dispute, fraud, or complaint cases to a human.
Current user: ${req.auth?.email || "guest"}.
Context: ${context || "General logistics support"}.
User request: ${sanitizedPrompt}`,
      ]);

      const response = await result.response;
      const text = response.text() || "I could not generate a reliable answer. I can create a support ticket for a human agent.";
      const confidence = escalate ? 0.55 : 0.78;
      const payload = { text, confidence, escalate };
      aiCache.set(cacheKey, { ...payload, expiresAt: Date.now() + 10 * 60 * 1000 });

      const db = getAdminDb();
      const threadId = conversationId || crypto.randomUUID();
      await db.collection("support_conversations").doc(threadId).set(
        {
          userId: req.auth?.uid || null,
          email: req.auth?.email || null,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await db.collection("support_conversations").doc(threadId).collection("messages").add({
        userPrompt: sanitizedPrompt,
        assistantText: text,
        confidence,
        escalate,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (escalate) {
        await db.collection("support_tickets").add({
          conversationId: threadId,
          customerId: req.auth?.uid || null,
          customerEmail: req.auth?.email || null,
          state: "open",
          priority: /emergency|urgent|fraud|stolen|injur/i.test(sanitizedPrompt) ? "high" : "normal",
          escalation: {
            source: "ai_support",
            reason: "low_confidence_or_sensitive_intent",
            escalatedAt: FieldValue.serverTimestamp(),
          },
          lastMessage: sanitizedPrompt,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      await getAdminDb().collection("ai_usage").add({
        userId: req.auth?.uid || null,
        promptLength: sanitizedPrompt.length,
        confidence,
        escalate,
        cached: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      res.json(payload);
    }),
  );

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const error = err instanceof HttpError ? err : new HttpError(500, "Internal server error");
    log(error.status >= 500 ? "error" : "warn", error.message, {
      path: req.path,
      method: req.method,
      status: error.status,
      details: error.details,
    });
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
