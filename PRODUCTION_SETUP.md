# Production Setup

The live site runs on **Vercel** (project `blm-v1`, address `https://blm-v1.vercel.app`). Every push to the `main` branch on GitHub deploys automatically within a few minutes. Vercel serves the pages and runs the server for every `/api/...` address, so nothing else needs hosting. Railway also works if you ever move (see the end of this checklist).

## Go-live checklist (do these in order)

### 1. Firebase console — project `gen-lang-client-0039054423`
- [ ] **Authentication → Sign-in method:** turn on **Email/Password** (and Google/Apple if you want them). Sign-in fails until this is on.
- [ ] **Authentication → Settings → Authorized domains:** make sure `blm-v1.vercel.app` is listed, plus any custom domain you add later (e.g. `blmmotors.ng`).
- [ ] **Project settings → Service accounts → Generate new private key.** A `.json` file downloads. Keep it private — it gives full access to your database. You paste it into Vercel in step 2.
- [ ] **Publish the security rules.** In **Firestore Database**, pick the database named `ai-studio-fbcf9fac-61d8-4d66-a684-eee2d681f685` from the dropdown at the top (**not** `(default)`). Open the **Rules** tab, replace everything with the contents of `firestore.rules` from this folder, and click **Publish**. Do the same under **Storage → Rules** with `storage.rules`.
  (Or, with the Firebase CLI: `npm i -g firebase-tools`, `firebase login`, then `firebase deploy --only firestore:rules,storage`. `firebase.json` already targets the right database.)

### 2. Vercel — project `blm-v1`
- [ ] **Settings → Environment Variables:** add `FIREBASE_SERVICE_ACCOUNT_JSON`. For the value, open the downloaded `.json` file in Notepad, copy **all** of it and paste it in. Tick **Production** (and **Preview** if you want preview links to work).
- [ ] That is the only required setting. `APP_URL` and `CORS_ORIGINS` fill themselves in from the Vercel address; set them only when you add a custom domain (e.g. `APP_URL` = `https://blmmotors.ng`, `CORS_ORIGINS` = `https://blmmotors.ng`).
- [ ] Add the payment, email, SMS and Maps keys from `.env.example` for the features you want. Anything left out is hidden, not broken.
- [ ] **Deployments → latest → ⋯ → Redeploy.** New settings only take effect after a redeploy.
- [ ] Open `https://blm-v1.vercel.app/api/health`. You want `"ok": true` and `"firebaseAdmin": "configured"`. If it says “Online booking is temporarily unavailable”, the key is missing or was pasted incompletely.
- [ ] **Custom domain (optional):** Settings → Domains → add it and follow Vercel’s DNS instructions, then add it to Firebase’s Authorized domains and set `APP_URL` / `CORS_ORIGINS` as above.

### 3. First admin
- [ ] Sign up on the live site and confirm your email.
- [ ] In Firebase **Authentication → Users**, copy your **User UID**.
- [ ] In **Firestore**, in the same `ai-studio-…` database, create a collection `admins` with a document whose ID is your UID and two fields: `role` = `super_admin`, `email` = your email.
- [ ] Sign out and back in, then open `/admin`. Add other staff and drivers from there by email.

### 4. Payments (use test keys first)
- [ ] **Stripe:** add a webhook for `https://blm-v1.vercel.app/api/webhooks/stripe` (events: `payment_intent.*`, `charge.dispute.created`) and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] **Paystack:** set the webhook URL to `https://blm-v1.vercel.app/api/webhooks/paystack`.
- [ ] Book a trip yourself and pay with each method in test mode. Check that the booking turns **Paid** in the admin panel. Then switch to live keys.
- [ ] **Bank transfer:** enter the bank details in Admin → Settings → Bank account.

(Use your custom domain in these webhook addresses if you add one.)

### 5. Final checks
- [ ] Register a new account, confirm the email, sign in and out.
- [ ] Open a service, enter a route, and check that a price appears.
- [ ] In Admin, change a price and confirm the public page shows it.
- [ ] In Vercel → your project → **Logs**, look for warnings that say a feature “is not set” and decide whether you need it.

### Moving to Railway instead (optional)
Railway runs the website and server as one always-on app. New project → **Deploy from GitHub repo** → choose this repository (Railway reads `railway.json`). Add `NODE_ENV` = `production`, `APP_URL`, `CORS_ORIGINS` and `FIREBASE_SERVICE_ACCOUNT_JSON`, then point your domain at Railway and disconnect the Vercel project so the two don’t compete. Railway is worth it if you add Redis for background jobs (`REDIS_URL`); on Vercel jobs always run straight away inside each request.

## Google Search setup

1. Make sure `APP_URL` (or `VITE_SITE_URL`, if you want a different address in search results) is your final HTTPS domain **before building**. The build writes ready-made pages for every public page, plus `sitemap.xml` and `robots.txt`, using that address. Page titles and descriptions live in `src/lib/seo.ts`.
2. Create a Google Search Console Domain property for the final domain and complete the DNS verification step.
3. If Google asks for an HTML meta tag, set `VITE_GOOGLE_SITE_VERIFICATION` to its content value and redeploy.
4. Submit `https://YOUR_DOMAIN/sitemap.xml` in Search Console.
5. Use URL Inspection to request indexing for the home page, `/services/cross-border-trips`, and each page under `/corridors/`.
6. Check again after Google has crawled the site. Search results and rankings take time and aren’t guaranteed.

## How hosting works

**Vercel (current):** `vercel.json` builds with `npm run build` and serves the pages from `dist/`, including the pre-built public pages, `robots.txt` and `sitemap.xml`. Every `/api/...` request goes to `api/index.ts`, which runs the same server code (`createApp` in `server.ts`) as a Vercel function. On Vercel, `APP_URL` and `CORS_ORIGINS` default to the project’s own address and background jobs run straight away.

**Railway (alternative):** builds with `npm ci --include=dev && npm run build`, starts with `npm start`, and checks `/api/health`. The server serves the website from `dist/` itself and sets security headers that allow only Firebase, Stripe, Google Fonts/Maps and Sentry.

On Vercel only the Firebase service account is required; on Railway, `APP_URL`, `CORS_ORIGINS` and the service account are required. Every other key switches on one feature; missing or placeholder values turn that feature off and log a warning instead of stopping the server.

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

Create restricted production keys, keep secret keys only in your host’s environment variables (Vercel or Railway), and run test-mode payments before switching provider dashboards to live mode.

### Messaging and monitoring

- Redis/BullMQ: `REDIS_URL`
- Resend: `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, `SUPPORT_ALERT_EMAIL`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WHATSAPP_FROM`
- Google Maps: `GOOGLE_MAPS_PLATFORM_KEY` for server distance calculations and `VITE_GOOGLE_MAPS_PLATFORM_KEY` for the browser map
- Sentry: `SENTRY_DSN`, `VITE_SENTRY_DSN`, optional `SENTRY_TRACES_SAMPLE_RATE`

Restrict the browser Maps key by website referrer and API. Restrict the server key by API and hosting egress IP where the provider supports it.

### Where to obtain each value

- Firebase browser values: Firebase Console > Project settings > General > Your apps > Web app configuration. Create the Admin service account under Project settings > Service accounts and store its JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` in your host’s environment variables (Vercel: Settings → Environment Variables).
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
