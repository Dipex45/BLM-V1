# BLM Motors Launch Verification

Status: code complete for staging; provider credentials and live transaction tests are required before production traffic.

## Automated checks

- TypeScript: `npm run lint`
- Unit tests: `npm test -- --runInBand`
- Production bundle: `npm run build`
- Lighthouse budgets: `npx --yes @lhci/cli@0.15.1 autorun`
- Dependency audit: `npm audit --omit=dev --audit-level=high`

GitHub Actions runs all five checks on pushes and pull requests.

The current local verification passes TypeScript, 14 unit/contract tests, production bundling, and the high/critical dependency gate. Browser automation covers home, authentication, the service index, and all five service forms at 390px, 768px, 1024px, and 1440px with no page overflow, clipped text, or broken images.

## Customer journey

- Public routes load directly and after refresh.
- Registration and Google sign-in route customers to `/dashboard`, drivers to `/driver`, and administrators to `/admin`.
- Booking prices are recalculated by the server from admin settings.
- Paystack is the primary online method; Stripe and configured bank transfer are alternatives.
- Webhooks verify provider signatures and update payments, bookings, ledger entries, and notifications.
- WhatsApp booking links compile the selected service details.
- Tracking accepts booking, payment, or tracking references and displays milestones; dispatched jobs can show driver location.
- Reviews require a completed booking owned by the signed-in customer.
- Customers can open persisted support tickets, continue the conversation, and receive staff replies by email or WhatsApp when configured.
- Customers can review and revoke device sessions; signing out everywhere also revokes Firebase refresh tokens.

## Admin and operations

- Vehicle pricing, per-kilometre rates, package weight pricing, tours, hubs, car-hire inventory, tracking labels, bank details, currencies, and provider flags are editable.
- Sensitive settings, payment reconciliation, roles, driver onboarding, booking creation, payment changes, and driver actions use authenticated API routes.
- Driver onboarding links a Firebase Authentication UID to the driver portal.
- Manual transfer approval/rejection, Stripe refund handling, audit history, and notification logs are persisted.
- Support staff can triage, escalate, reply to, and close customer tickets from the role-protected admin workspace.

## Required live checks

- Deploy `firestore.rules` and `storage.rules` to the production Firebase project.
- Complete one low-value Paystack payment and verify webhook, ledger, receipt, and WhatsApp delivery.
- Complete one low-value Stripe payment and one refund.
- Upload and approve one real bank-transfer proof after entering the official company account.
- Assign a driver, accept the job, share location, progress every status, and complete the trip.
- Verify Google sign-in on every production domain and test email verification/password reset.
- Test Chrome on Android over throttled mobile data, Safari on iPhone, tablet, and desktop.
- Confirm Sentry receives frontend and backend test exceptions.
- Verify device-session revocation from a second browser and confirm the revoked browser receives an authentication error.
- Open, escalate, reply to, and close a support ticket while confirming its conversation and notification audit records.

## Accepted dependency risk

- `npm audit` currently reports eight moderate findings in Firebase Admin's transitive Google Cloud dependency chain (`uuid` through `gaxios`, `google-gax`, and Storage). The only npm-proposed forced remediation downgrades Firebase Admin across a breaking boundary, so CI blocks high and critical findings while this upstream chain is monitored.
- The direct `tsx`, `esbuild`, and `qs` advisories have been updated to fixed compatible releases.

## External blockers

- Official bank account details have not been supplied.
- Payment, Resend, Twilio WhatsApp/SMS, Maps, Redis, and Sentry credentials must be installed in hosting.
- Google and Bing search verification codes have not been supplied.
- Firebase MFA requires Identity Platform configuration and a company decision on SMS or TOTP enrollment.
- Provider approval, WhatsApp templates, production webhook delivery, and real-money reconciliation cannot be verified without the live accounts.

## Remaining engineering verification

- The responsive Playwright matrix passes locally, but adding the reusable `@playwright/test` package to CI was deferred after two npm registry TLS failures. Retry the package installation and commit the matrix as a CI suite before the release candidate is tagged.
- Provider-backed integration tests still require staging credentials, Firebase test users, and low-value Stripe/Paystack transactions; the unit and schema suite does not replace those checks.
