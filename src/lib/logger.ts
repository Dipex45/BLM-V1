
export const logger = {
  info: (message: string, context?: unknown) => {
    if (import.meta.env.DEV) console.info(`[INFO] ${message}`, context || '');
  },
  warn: (message: string, context?: unknown) => {
    if (import.meta.env.DEV) console.warn(`[WARN] ${message}`, context || '');
    if (import.meta.env.VITE_SENTRY_DSN) {
      void import('@sentry/react').then((Sentry) => Sentry.captureMessage(message, { level: 'warning', extra: { context } }));
    }
  },
  error: (message: string, error?: unknown) => {
    if (import.meta.env.DEV) console.error(`[ERROR] ${message}`, error || '');
    if (import.meta.env.VITE_SENTRY_DSN) {
      void import('@sentry/react').then((Sentry) => {
        Sentry.captureException(error instanceof Error ? error : new Error(message), { extra: { message, error } });
      });
    }
  }
};
