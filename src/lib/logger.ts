
/**
 * BLM Motors Centralized Monitoring
 * In a production environment, this would integrate with Sentry, LogRocket, or Axiom.
 */

export const logger = {
  info: (message: string, context?: any) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, context || '');
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, context || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error || '');
    
    // Example: Transmit to an error tracking endpoint
    // fetch('/api/logs/error', { method: 'POST', body: JSON.stringify({ message, error }) });
  },
  audit: (userId: string, action: string, details: any) => {
    console.log(`[AUDIT] User:${userId} Action:${action}`, details);
  }
};
