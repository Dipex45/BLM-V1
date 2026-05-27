# Production Data Model

BLM Motors uses Firebase Authentication plus Firestore for operational records. Server-only writes are performed through Firebase Admin SDK from `server.ts`; Firestore rules intentionally block browser writes for payments, ledgers, notifications, audits, driver onboarding, and admin role changes.

## Identity and Access

### `users/{uid}`
- Customer-facing profile document.
- Fields: `role`, `fullName`, `email`, `verificationStatus`, `fraudFlags`, `paymentHistory`, `bookingHistory`, `deviceTracking`, `loginHistory`.

### `admins/{uid}`
- Server-managed RBAC grant.
- `role`: `super_admin`, `dispatcher`, `finance_admin`, or `customer_support_agent`.
- Created/revoked only through `/api/admin/users/role`.

### `user_sessions/{sessionHash}`
- Server-managed device/session record.
- Fields: `userId`, `email`, `role`, `ip`, `userAgent`, `revoked`, `lastSeenAt`.

## Logistics Core

### `bookings/{bookingId}`
- Persistent booking lifecycle record.
- Fields: `customerId`, `customerName`, `customerEmail`, `pickup`, `destination`, `vehicleClass`, `totalAmount`, `currency`, `status`, `assignedDriverId`, `paymentStatus`, `paymentProvider`, `routeMetadata`, `etaHistory`, `lifecycle`, `cancellationHistory`, `createdAt`, `updatedAt`.
- Statuses: `Quoted`, `Booked`, `Paid`, `Confirmed`, `Dispatched`, `InTransit`, `Completed`, `Cancelled`.

### `booking_events/{eventId}`
- Append-only operational event stream for booking lifecycle, payment success/failure, dispatch, cancellation, and refund events.

### `drivers/{driverId}`
- Server-managed driver profile and onboarding state.
- Fields: `profile`, `onboarding`, `kyc`, `availability`, `ratings`, `payoutHistory`, `assignedJobs`, `vehicleId`.

### `driver_locations/{driverId}`
- Latest driver heartbeat and GPS state.
- Used for live tracking and dispatch monitoring.

### `vehicles/{vehicleId}`
- Fleet asset record.
- Fields: `category`, `capacity`, `vin`, `maintenanceStatus`, `registrationExpiry`, `insuranceExpiry`, `assignedDriverId`.

## Payments and Finance

### `payments/{paymentId}`
- Server-created payment intent/transaction record.
- Fields: `provider`, `providerPaymentId`, `providerReference`, `bookingId`, `customerId`, `amount`, `amountMinor`, `currency`, `status`, `providerStatus`, `webhookEventIds`, `reconciliation`, `fraud`, `createdAt`, `updatedAt`.

### `refunds/{refundId}`
- Refund tracking record.
- Fields: `provider`, `bookingId`, `paymentIntentId`, `requestedBy`, `reason`, `status`, `amount`, `currency`.

### `payment_disputes/{disputeId}`
- Provider dispute/chargeback events.

### `ledger_entries/{entryId}`
- Accounting ledger entry for posted revenue, refunds, fees, and payouts.

### `payment_reconciliation_exceptions/{id}`
- Webhook or verification events that could not be matched to a known payment.

## Support, AI, and Notifications

### `support_conversations/{conversationId}`
- AI/human support thread metadata.
- Subcollection `messages/{messageId}` stores prompts, assistant responses, confidence, escalation flags.

### `support_tickets/{ticketId}`
- Human support work queue.
- Fields: `customerId`, `customerEmail`, `state`, `priority`, `conversationId`, `escalation`, `lastMessage`.

### `notification_logs/{notificationId}`
- Email/SMS delivery log.
- Fields: `channel`, `provider`, `to`, `subject`, `body`, `template`, `status`, `deliveryState`, `attempts`, `retries`, `providerMessageId`.

### `ai_usage/{usageId}`
- AI support metering and abuse monitoring.

## Operations

### `audit_logs/{auditId}`
- Admin/security action history.
- Fields: `actorId`, `actorEmail`, `actorRole`, `action`, `resource`, `metadata`, `before`, `after`, `ip`, `userAgent`, `rollback`, `timestamp`.

### `queue_jobs/{jobId}`
- Queue receipts for scaffolded processors.

### `realtime_events/{eventId}`
- Durable copy of SSE events emitted to operations/customer clients.

### `settings/{settingId}`, `hubs/{hubId}`, `blocked_dates/{dateId}`, `reviews/{reviewId}`
- Existing application collections with tightened rules.
