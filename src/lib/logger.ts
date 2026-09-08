
export const logger = {
  info: (message: string, context?: any) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, context || '');
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, context || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error || '');
    if (import.meta.env.VITE_SENTRY_DSN) {
      void import('@sentry/react').then((Sentry) => {
        Sentry.captureException(error instanceof Error ? error : new Error(message), { extra: { message, error } });
      });
    }
  },
  audit: (userId: string, action: string, details: any) => {
    console.log(`[AUDIT] User:${userId} Action:${action}`, details);
  }
};
