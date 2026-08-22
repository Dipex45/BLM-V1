import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './hooks/useAuth';
import { CurrencyProvider } from './contexts/CurrencyContext';

const root = document.getElementById('root');

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
      React.createElement(CurrencyProvider, null, React.createElement(App)),
    ),
  ),
);
