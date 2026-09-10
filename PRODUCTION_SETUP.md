# Production Setup

## Recommended hosting

Use Railway for the Express API, BullMQ workers, SSE endpoint, and optionally the built frontend. Use Vercel for the frontend only when `VITE_API_BASE_URL` points to the Railway HTTPS domain. Set `APP_URL` to the public frontend and `CORS_ORIGINS` to every exact allowed frontend origin, comma separated.

Railway uses `railway.json`, builds with `npm ci && npm run build`, starts with `npm start`, and checks `/api/health`.

## Required credentials

### Firebase

- Browser config: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIRESTORE_DATABASE_ID`
- Server config: `FIREBASE_PROJECT_ID` and either `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- Enable Email/Password and Google in Firebase Authentication.
- Add the Vercel and Railway/custom domains to Authentication > Settings > Authorized domains.
- Deploy rules with `firebase deploy --only firestore:rules,storage` from the production Firebase project.

### Payments

- Stripe: `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Paystack: `PAYSTACK_SECRET_KEY`
- Stripe webhook: `https://YOUR-API-DOMAIN/api/webhooks/stripe`
- Paystack webhook: `https://YOUR-API-DOMAIN/api/webhooks/paystack`

Create restricted production keys, keep secret keys only on Railway, and run test-mode payments before switching provider dashboards to live mode.

### Messaging and monitoring

- Redis/BullMQ: `REDIS_URL`
- Resend: `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, `SUPPORT_ALERT_EMAIL`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WHATSAPP_FROM`
- Google Maps: `GOOGLE_MAPS_PLATFORM_KEY` for server distance calculations and `VITE_GOOGLE_MAPS_PLATFORM_KEY` for the browser map
- Sentry: `SENTRY_DSN`, `VITE_SENTRY_DSN`, optional `SENTRY_TRACES_SAMPLE_RATE`

Restrict the browser Maps key by website referrer and API. Restrict the server key by API and hosting egress IP where the provider supports it.

### Where to obtain each value

- Firebase browser values: Firebase Console > Project settings > General > Your apps > Web app configuration. Create the Admin service account under Project settings > Service accounts and store its JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` in the Railway secret store.
- Stripe: copy the publishable and server key from [Stripe API keys](https://dashboard.stripe.com/apikeys). Create the production endpoint under [Stripe Webhooks](https://dashboard.stripe.com/webhooks) and reveal its separate signing secret.
- Paystack: copy the server secret from Dashboard > Settings > API Keys & Webhooks and register `/api/webhooks/paystack` as the live webhook URL.
- Resend: verify `blmmotors.ng`, create an API key, and use a sender on that verified domain for `NOTIFICATION_EMAIL_FROM`.
- Twilio: copy the Account SID and Auth Token from the Account Dashboard, buy or approve an SMS sender, and complete WhatsApp Self Sign-up for the `TWILIO_WHATSAPP_FROM` number.
- Redis: create a Redis database and copy its TLS TCP connection string. Upstash exposes the compatible `rediss://...` value under Connect > Node/ioredis.
- Google Maps Platform: create separate browser and server keys in Google Cloud Console. Enable Distance Matrix, Directions, Places, Geocoding, and Roads, then apply website-referrer restrictions to the browser key and server/API restrictions to the backend key.
- Sentry: create separate React and Node projects and copy each project's DSN into the browser and server variables.
- Search verification: copy the HTML meta-tag content value from Google Search Console and Bing Webmaster Tools. The Vite build injects each tag only when its corresponding environment value is present.

## First administrator

1. Create and verify the administrator's Firebase Authentication account.
2. Copy its UID from Firebase Console > Authentication > Users.
3. In Firestore, create `admins/{UID}` with `role: "super_admin"` and an `email` field.
4. Sign out and sign in again, then open `/admin`.
5. Create later staff roles from Admin > Administrators. Use `dispatcher`, `finance_admin`, or `customer_support_agent` according to the person's work.

This one-time bootstrap must be done in the trusted Firebase Console. Browser rules intentionally prohibit creating the first administrator.

## Driver access

Create the driver's Firebase Authentication account first. In Admin > Drivers, paste that account UID with the driver's legal name, phone, and licence reference. The API links the driver profile, assigns the `driver` role, and routes the next login to `/driver`.

## Before enabling payments

Enter the official bank account under Admin > Settings. Keep any provider disabled in Operational feature controls until its credentials, webhook, and live settlement have been verified. Confirm the public `/api/health` response reports every required provider as configured.
