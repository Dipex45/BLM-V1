# Development Guide

## Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Configure environment variables in `.env` (use `.env.example` as template).
4. Start dev server: `npm run dev`

## Available Scripts
- `npm run dev`: Starts Express server + Vite middleware.
- `npm run build`: Builds the production asset bundle.
- `npm run lint`: Performs type checking.
- `npm test`: Runs units tests with Jest.

## Testing
Unit tests reside next to the source files as `*.test.ts`.
To run tests:
```bash
npm test
```

## Deployment
The app is configured for Cloud Run containers. The entrypoint is `server.ts`.
Make sure `STRIPE_SECRET_KEY` and `PAYSTACK_SECRET_KEY` are provided in the environment.
