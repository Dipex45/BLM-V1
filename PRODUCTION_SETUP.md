# Production Setup

## Go-live checklist (do these in order)

### 1. Firebase console — project `gen-lang-client-0039054423`
- [ ] **Authentication → Sign-in method:** turn on **Email/Password** (and Google/Apple if you want them).
- [ ] **Authentication → Settings → Authorized domains:** add your live domain (e.g. `blmmotors.ng`) and your Railway domain.
- [ ] **Project settings → Service accounts → Generate new private key.** Keep the downloaded JSON safe — you paste it into Railway in step 2.
- [ ] **Deploy the security rules** from this folder (needs the Firebase CLI: `npm i -g firebase-tools`, then `firebase login`):
  `firebase deploy --only firestore:rules,storage`
  `firebase.json` already targets the app’s database (`ai-studio-fbcf9fac-…`).
- [ ] **Create the first admin:** sign up on the live site, confirm your email, copy your UID from Authentication → Users, then in Firestore (database `ai-studio-fbcf9fac-…`) create `admins/{your UID}` with `role: "super_admin"` and `email: "you@…"`. Sign out and back in, then open `/admin`.

### 2. Railway (hosts the website and the server together)
- [ ] New project → **Deploy from GitHub repo** → choose this repository. Railway reads `railway.json` automatically.
- [ ] **Variables** — add at least:
  - `NODE_ENV` = `production`
  - `APP_URL` = `https://your-domain.com` (no trailing slash)
  - `CORS_ORIGINS` = `https://your-domain.com` (add the Railway URL too, comma-separated, if you use it)
  - `FIREBASE_SERVICE_ACCOUNT_JSON` = the whole JSON from step 1, on one line
  - Payment, email, SMS and Maps keys from `.env.example` for the features you want. Anything left out is hidden, not broken.
- [ ] **Settings → Networking:** generate a domain, or add your custom domain and update your DNS.
- [ ] After the deploy, open `https://your-domain.com/api/health`. You want `"ok": true` and `"firebaseAdmin": "configured"`.

> **Do not host on Vercel alone.** Vercel only serves the pages, not the server, so prices, bookings and sign-in would fail. If a Vercel project is connected to this repo, disconnect it (or point the domain at Railway instead).

### 3. Payments (use test keys first)
- [ ] **Stripe:** add a webhook for `https://your-domain.com/api/webhooks/stripe` (events: `payment_intent.*`, `charge.dispute.created`) and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] **Paystack:** set the webhook URL to `https://your-domain.com/api/webhooks/paystack`.
- [ ] Book a trip yourself and pay with each method in test mode. Check that the booking turns **Paid** in the admin panel. Then switch to live keys.
- [ ] **Bank transfer:** enter the bank details in Admin → Settings → Bank account.

### 4. Final checks
- [ ] Register a new account, confirm the email, sign in and out.
- [ ] Open a service, enter a route, and check that a price appears.
- [ ] In Admin, change a price and confirm the public page shows it.
- [ ] Look at Railway’s logs for warnings that say a feature “is not set” and decide whether you need it.

## How hosting works

Railway builds with `npm ci --include=dev && npm run build`, starts with `npm start`, and checks `/api/health`. In production the server serves the built website from `dist/`, `robots.txt` and `sitemap.xml` (both use `APP_URL`), and sets security headers that allow only Firebase, Stripe, Google Fonts/Maps and Sentry.

Only `APP_URL`, `CORS_ORIGINS` and the Firebase service account are required. Every other key switches on one feature; missing or placeholder values turn that feature off and log a warning instead of stopping the server.

## Required credentials

### Firebase

- Browser config: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIRESTORE_DATABASE_ID`
- Server config: either `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`. The service account **must belong to the same project as the browser config**; the server reads the project and Firestore database ID from the `VITE_FIREBASE_*` values (or `firebase-applet-config.json`) so ID tokens verify and both sides read the same database. The server refuses to start Firebase calls if the projects differ.
- In Firebase Console > Authentication > Sign-in method, enable Email/Password, Google, and Apple.
- Add the Vercel and Railway/custom domains to Authentication > Settings > Authorized domains.
- Deploy rules with `firebase deploy --only firestore:rules,storage` from the production Firebase project, targeting the same Firestore database ID the app uses. All writes go through the API; the browser only reads.

#### Apple sign-in configuration

Apple sign-in does not use an application environment variable. Configure it in Firebase Authentication with credentials from the Apple Developer portal:

1. Create a Sign in with Apple Services ID for the production website domain.
2. Register `https://gen-lang-client-0039054423.firebaseapp.com/__/auth/handler` as the return URL in that Services ID.
3. Create a Sign in with Apple key and download its `.p8` private key. Apple permits this file to be downloaded only once.
4. Copy the Apple Team ID, Services ID, Key ID, and private-key contents into Firebase Console > Authentication > Sign-in method > Apple.
5. Test both a normal Apple email and Apple's Hide My Email relay flow on the production domain.

Never commit the `.p8` key or paste it into a frontend environment variable.

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
3. In Firestore (same database ID as the app), create `admins/{UID}` with `role: "super_admin"` and an `email` field.
4. Sign out and sign in again, then open `/admin`.
5. Grant later staff roles from Admin > Roles by entering the person’s account email. Use `dispatcher`, `finance_admin`, or `customer_support_agent` according to the person's work.

This one-time bootstrap must be done in the trusted Firebase Console. Browser rules intentionally prohibit creating the first administrator.

## Driver access

The driver registers on the website first. In Admin > Drivers, enter their account email with legal name, phone, and licence number, then press **Approve**. Only approved drivers can go online or be assigned trips; their next login lands on `/driver`.

## Before enabling payments

Enter the official bank account under Admin > Settings. Keep any provider disabled in Operational feature controls until its credentials, webhook, and live settlement have been verified. Confirm the public `/api/health` response reports every required provider as configured.
