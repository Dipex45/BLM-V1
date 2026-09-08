import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './hooks/useAuth';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { LocaleProvider } from './contexts/LocaleContext';

if (import.meta.env.VITE_SENTRY_DSN) {
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 0.15 : 1,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      replaysSessionSampleRate: 0.02,
      replaysOnErrorSampleRate: 1,
    });
  });
}

const root = document.getElementById('root');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

if (!root) {
  throw new Error('Application root element was not found');
}

ReactDOM.createRoot(root).render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      AuthProvider,
      null,
      React.createElement(LocaleProvider, null, React.createElement(CurrencyProvider, null, React.createElement(App))),
    ),
  ),
);
