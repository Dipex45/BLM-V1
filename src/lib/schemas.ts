import { z } from 'zod';

export const RoleSchema = z.enum([
  'super_admin',
  'dispatcher',
  'finance_admin',
  'customer_support_agent',
  'driver',
  'customer',
]);

export const BookingStatusSchema = z.enum([
  'Quoted',
  'Booked',
  'Paid',
  'Confirmed',
  'Dispatched',
  'InTransit',
  'Completed',
  'Cancelled',
]);

export const VerificationStatusSchema = z.enum(['pending', 'verified', 'rejected', 'suspended']);
export const PaymentStatusSchema = z.enum([
  'initialized',
  'requires_action',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'disputed',
]);

export const BookingSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  customerName: z.string().min(2, "Name must be at least 2 characters").max(100),
  customerEmail: z.string().email("Invalid email address"),
  pickup: z.string().min(1, "Pickup location is required"),
  destination: z.string().min(1, "Destination is required"),
  vehicleClass: z.string().min(1, "Vehicle class is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  totalAmount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3).default('USD'),
  status: BookingStatusSchema.default('Quoted'),
  isRecurring: z.boolean().optional().default(false),
  recurringFrequency: z.enum(['None', 'Weekly', 'Monthly']).optional().default('None'),
  reviewId: z.string().optional(),
  assignedDriverId: z.string().optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  paymentProvider: z.enum(['stripe', 'paystack']).optional(),
  routeMetadata: z.object({
    distanceMeters: z.number().nonnegative().optional(),
    durationSeconds: z.number().nonnegative().optional(),
    polyline: z.string().optional(),
    geocodedPickup: z.record(z.string(), z.unknown()).optional(),
    geocodedDestination: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  etaHistory: z.array(z.object({
    eta: z.string(),
    source: z.string(),
    recordedAt: z.string(),
  })).optional(),
  lifecycle: z.record(z.string(), z.unknown()).optional(),
  cancellationHistory: z.array(z.object({
    at: z.string(),
    by: z.string(),
    reason: z.string(),
    previousStatus: z.string().nullable().optional(),
  })).optional(),
  createdAt: z.string(),
});

export const CustomerSchema = z.object({
  profile: z.object({
    fullName: z.string().min(2).max(160),
    email: z.string().email(),
    phone: z.string().max(40).optional(),
  }),
  role: z.literal('customer').default('customer'),
  verificationStatus: VerificationStatusSchema.default('pending'),
  bookingHistory: z.array(z.string()).default([]),
  paymentHistory: z.array(z.string()).default([]),
  fraudFlags: z.array(z.object({
    code: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    createdAt: z.string(),
  })).default([]),
  deviceTracking: z.array(z.object({
    deviceId: z.string(),
    userAgent: z.string(),
    ip: z.string(),
    lastSeenAt: z.string(),
  })).default([]),
  loginHistory: z.array(z.object({
    ip: z.string(),
    userAgent: z.string(),
    at: z.string(),
  })).default([]),
});

export const DriverSchema = z.object({
  profile: z.object({
    name: z.string().min(2).max(160),
    email: z.string().email().optional(),
    phone: z.string().min(5).max(40),
  }),
  onboarding: z.object({
    state: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'suspended']),
    submittedAt: z.string().optional(),
    approvedAt: z.string().optional(),
  }),
  kyc: z.object({
    status: VerificationStatusSchema,
    licenseNumber: z.string(),
    licenseVerification: VerificationStatusSchema,
    vehicleVerification: VerificationStatusSchema.optional(),
  }),
  liveLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    heading: z.number().min(0).max(360).optional(),
    heartbeatAt: z.string(),
  }).optional(),
  availability: z.object({
    state: z.enum(['offline', 'available', 'assigned', 'on_trip', 'on_break']),
    updatedAt: z.string(),
  }),
  ratings: z.object({ average: z.number().min(0).max(5).nullable(), count: z.number().nonnegative() }),
  payoutHistory: z.array(z.string()).default([]),
  assignedJobs: z.array(z.string()).default([]),
});

export const VehicleSchema = z.object({
  category: z.string().min(1).max(80),
  capacity: z.object({
    passengers: z.number().int().nonnegative().optional(),
    weightKg: z.number().nonnegative().optional(),
    volumeM3: z.number().nonnegative().optional(),
  }),
  vin: z.string().min(5).max(40),
  maintenanceStatus: z.enum(['active', 'due', 'in_service', 'out_of_service']),
  registrationExpiry: z.string(),
  insuranceExpiry: z.string(),
  assignedDriverId: z.string().optional(),
});

export const PaymentSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  provider: z.enum(['stripe', 'paystack']),
  amount: z.number().positive(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  status: PaymentStatusSchema,
  providerPaymentId: z.string().optional(),
  providerReference: z.string().optional(),
  webhookEventIds: z.array(z.string()).default([]),
  refunds: z.array(z.string()).default([]),
  disputes: z.array(z.string()).default([]),
  payoutStatus: z.enum(['not_applicable', 'pending', 'paid', 'failed']).default('not_applicable'),
  reconciliation: z.object({
    required: z.boolean(),
    source: z.string(),
    reconciledAt: z.string().optional(),
  }),
  fraud: z.object({
    duplicateCheck: z.string(),
    riskLevel: z.enum(['pending', 'low', 'medium', 'high']),
  }),
});

export const AuditLogSchema = z.object({
  actorId: z.string(),
  actorEmail: z.string().nullable().optional(),
  actorRole: z.string(),
  action: z.string(),
  resource: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  ip: z.string(),
  userAgent: z.string(),
  timestamp: z.string().optional(),
  rollback: z.object({
    supported: z.boolean(),
    reason: z.string().optional(),
    rollbackRef: z.string().optional(),
  }).optional(),
});

export const SupportTicketSchema = z.object({
  customerId: z.string().nullable().optional(),
  customerEmail: z.string().email().nullable().optional(),
  state: z.enum(['open', 'pending_customer', 'escalated', 'resolved', 'closed']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  conversationId: z.string().optional(),
  escalation: z.object({
    source: z.string(),
    reason: z.string(),
    escalatedAt: z.string().optional(),
  }).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const NotificationSchema = z.object({
  channel: z.enum(['email', 'sms']),
  to: z.string().min(3),
  subject: z.string().optional(),
  body: z.string().min(1),
  template: z.string(),
  provider: z.enum(['resend', 'twilio', 'sendgrid', 'postmark', 'aws_ses', 'aws_sns']).optional(),
  status: z.enum(['queued', 'processing', 'sent', 'delivered', 'failed', 'provider_not_configured']),
  deliveryState: z.enum(['pending', 'accepted', 'delivered', 'bounced', 'failed', 'blocked']).default('pending'),
  attempts: z.number().int().nonnegative().default(0),
});

export const ReviewSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(500),
  createdAt: z.string(),
});

export type BookingInput = z.infer<typeof BookingSchema>;
export type ReviewInput = z.infer<typeof ReviewSchema>;
export type CustomerInput = z.infer<typeof CustomerSchema>;
export type DriverInput = z.infer<typeof DriverSchema>;
export type VehicleInput = z.infer<typeof VehicleSchema>;
export type PaymentInput = z.infer<typeof PaymentSchema>;
export type AuditLogInput = z.infer<typeof AuditLogSchema>;
export type SupportTicketInput = z.infer<typeof SupportTicketSchema>;
export type NotificationInput = z.infer<typeof NotificationSchema>;

export const HubSchema = z.object({
  name: z.string().min(2).max(50),
  active: z.boolean(),
});
