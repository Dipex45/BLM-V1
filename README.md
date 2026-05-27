# BLM MOTORS - Integrated Logistics Platform

A modern, high-performance logistics and transport management system built with React, Express, and Firebase.

## Features
- **Booking Hub**: Smart route selection and vehicle class allocation.
- **Real-time Tracking**: Monitor logistics vectors across the grid.
- **Integrated Payments**: Secure clearance via Stripe and Paystack.
- **Enterprise Admin**: Deep analytics, fleet management, and operational controls.
- **Audit Logging**: Comprehensive system transparency and compliance records.
- **AI-Powered**: Smart route explanations and logistical insights.

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, Recharts.
- **Backend**: Express.js, TypeScript.
- **Database/Auth**: Firebase Firestore, Firebase Authentication.
- **Integrations**: Stripe, Paystack, Google Gemini AI.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Firebase Project with Firestore and Auth enabled.
- Stripe and/or Paystack accounts.

### Setup Instructions
1. **Clone the repo** and install dependencies:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your credentials:
   - `GEMINI_API_KEY`: Obtain from Google AI Studio.
   - `VITE_STRIPE_PUBLISHABLE_KEY` & `STRIPE_SECRET_KEY`: From Stripe Dashboard.
   - `VITE_PAYSTACK_PUBLIC_KEY` & `PAYSTACK_SECRET_KEY`: From Paystack Dashboard.
   - `APP_URL`: Your local or hosted application URL.

3. **Firebase Configuration**:
   The application expects `firebase-applet-config.json` in the root (created automatically in AI Studio). If running locally, obtain your web config from Firebase Console.

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

## Administrative Access
To access the Admin Panel:
1. Register an account via `/register`.
2. Locate your UID in the Firebase Console or User Profile.
3. Add your UID to the `admins` collection in Firestore.

## Testing
Run unit tests with Jest:
```bash
npm test
```

## Security
- **Server-Side Validation**: Critical booking data is validated via Zod on the backend.
- **Firestore Rules**: Hardened ABAC security rules protect records at the database level.
- **Audit Logs**: All administrative actions are recorded in an immutable ledger.

---
© 2026 BLM MOTORS. All Vectors Authorized.
