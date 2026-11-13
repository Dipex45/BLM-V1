import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../hooks/useCatalog';
import {
  convertFromNgn,
  DEFAULT_CURRENCY_RATES,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '../lib/catalog';

export type { SupportedCurrency };

export const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string }> = {
  NGN: { name: 'Nigerian Naira', symbol: '₦' },
  XOF: { name: 'West African CFA Franc', symbol: 'CFA' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵' },
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
};

interface CurrencyContextType {
  displayCurrency: SupportedCurrency;
  setDisplayCurrency: (currency: SupportedCurrency) => void;
  /** Rates published by the server: the same ones used to charge card payments. */
  rates: Record<SupportedCurrency, number>;
  formatPrice: (amountInNgn: number, currency?: SupportedCurrency) => string;
  convertPrice: (amountInNgn: number, currency?: SupportedCurrency) => number;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const isSupported = (value: unknown): value is SupportedCurrency =>
  typeof value === 'string' && SUPPORTED_CURRENCIES.includes(value as SupportedCurrency);

function detectCurrency(): SupportedCurrency {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byZone: Record<string, SupportedCurrency> = {
      'Africa/Lagos': 'NGN',
      'Africa/Porto-Novo': 'XOF',
      'Africa/Lome': 'XOF',
      'Africa/Accra': 'GHS',
      'Europe/London': 'GBP',
    };
    if (byZone[zone]) return byZone[zone];
    if (zone.startsWith('Europe/')) return 'EUR';
    if (zone.startsWith('America/')) return 'USD';
  } catch {
    // fall through to NGN
  }
  return 'NGN';
}

function readSavedCurrency(): SupportedCurrency | null {
  try {
    const saved = localStorage.getItem('blm-currency');
    return isSupported(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { catalog } = useCatalog();
  const [displayCurrency, setCurrency] = useState<SupportedCurrency>(() => readSavedCurrency() || detectCurrency());
  const rates = catalog?.currencyRates || DEFAULT_CURRENCY_RATES;

  useEffect(() => {
    document.documentElement.dataset.currency = displayCurrency;
  }, [displayCurrency]);

  const setDisplayCurrency = useCallback((currency: SupportedCurrency) => {
    setCurrency(currency);
    try {
      localStorage.setItem('blm-currency', currency);
    } catch {
      // preference simply won't persist
    }
  }, []);

  const convertPrice = useCallback(
    (amount: number, currency: SupportedCurrency = displayCurrency) =>
      Number.isFinite(amount) ? convertFromNgn(amount, currency, rates) : 0,
    [displayCurrency, rates],
  );

  const formatPrice = useCallback(
    (amount: number, currency: SupportedCurrency = displayCurrency) => {
      const converted = convertPrice(amount, currency);
      const decimals = currency === 'NGN' || currency === 'XOF' ? 0 : 2;
      try {
        return new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency,
          currencyDisplay: 'narrowSymbol',
          maximumFractionDigits: decimals,
          minimumFractionDigits: decimals,
        }).format(converted);
      } catch {
        return `${CURRENCY_CONFIG[currency].symbol}${converted.toLocaleString('en-NG', { maximumFractionDigits: decimals })}`;
      }
    },
    [convertPrice, displayCurrency],
  );

  const value = useMemo(
    () => ({ displayCurrency, setDisplayCurrency, rates, formatPrice, convertPrice }),
    [displayCurrency, setDisplayCurrency, rates, formatPrice, convertPrice],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
}
