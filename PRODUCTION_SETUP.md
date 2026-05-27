# BLM Motors Production Setup

## Admin Access

1. Register or sign in with the email that should become the first admin.
2. Copy that Firebase Auth user UID.
3. In Firestore, create `admins/{uid}` with:

```json
{
  "role": "super_admin",
  "createdAt": "2026-05-27T00:00:00.000Z",
  "promotedBy": "bootstrap"
}
```

4. Sign out and sign back in.
5. Open `/admin`.

Supported admin roles are `super_admin`, `dispatcher`, `finance_admin`, and `customer_support_agent`.

## Required API Keys and Secrets

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- `REDIS_URL`
- `VITE_PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `NOTIFICATION_EMAIL_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `VITE_GOOGLE_MAPS_PLATFORM_KEY`
- `GOOGLE_MAPS_PLATFORM_KEY`
- `APP_URL`
- `CORS_ORIGINS`
- `SENTRY_DSN`

## Provider Webhooks

- Stripe webhook URL: `/api/webhooks/stripe`
- Paystack webhook URL: `/api/webhooks/paystack`

Deploy Firestore rules after setting up the project. Payment, notification, audit, driver, and admin records are server-managed and intentionally blocked from direct browser writes.
