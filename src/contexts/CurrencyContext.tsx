import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type SupportedCurrency = 'NGN' | 'XOF' | 'GHS' | 'USD' | 'EUR' | 'GBP';

export const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string; rate: number }> = {
  NGN: { name: 'Nigerian Naira', symbol: 'NGN', rate: 1 },
  XOF: { name: 'West African CFA Franc', symbol: 'CFA', rate: 0.41 },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GHS', rate: 0.0097 },
  USD: { name: 'US Dollar', symbol: '$', rate: 0.00067 },
  EUR: { name: 'Euro', symbol: 'EUR', rate: 0.00062 },
  GBP: { name: 'British Pound', symbol: 'GBP', rate: 0.00053 },
};

interface CurrencyContextType {
  baseCurrency: 'NGN';
  displayCurrency: SupportedCurrency;
  setDisplayCurrency: (currency: SupportedCurrency) => void;
  detectedCurrency: SupportedCurrency;
  formatPrice: (amountInBaseCurrency: number) => string;
  convertPrice: (amountInBaseCurrency: number, toCurrency?: SupportedCurrency) => number;
  symbol: string;
  rate: number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>('NGN');
  const [detectedCurrency, setDetectedCurrency] = useState<SupportedCurrency>('NGN');
  const [rates, setRates] = useState<Record<SupportedCurrency, number>>({
    NGN: 1,
    XOF: 0.41,
    GHS: 0.0097,
    USD: 0.00067,
    EUR: 0.00062,
    GBP: 0.00053,
  });

  useEffect(() => {
    const detected = detectCurrency();
    const saved = localStorage.getItem('blm-currency');
    const nextCurrency = saved && isSupportedCurrency(saved) ? saved : detected;

    setDetectedCurrency(detected);
    setDisplayCurrency(nextCurrency);

    const loadRates = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'currency_rates'));
        if (snap.exists() && snap.data().value) {
          setRates((prev) => ({ ...prev, ...snap.data().value }));
        }
      } catch (err) {
        console.warn('Using default currency rates');
      }
    };

    loadRates();
  }, []);

  const handleSetDisplayCurrency = (currency: SupportedCurrency) => {
    setDisplayCurrency(currency);
    localStorage.setItem('blm-currency', currency);
  };

  const convertPrice = (amountInBaseCurrency: number, toCurrency: SupportedCurrency = displayCurrency): number => {
    const rate = rates[toCurrency] ?? CURRENCY_CONFIG[toCurrency]?.rate ?? 1;
    return amountInBaseCurrency * rate;
  };

  const formatPrice = (amountInBaseCurrency: number): string => {
    const converted = convertPrice(amountInBaseCurrency, displayCurrency);
    const decimals = displayCurrency === 'NGN' ? 0 : 2;

    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: displayCurrency,
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      }).format(converted);
    } catch (error) {
      const symbol = CURRENCY_CONFIG[displayCurrency]?.symbol || 'NGN';
      return `${symbol} ${converted.toFixed(decimals)}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        baseCurrency: 'NGN',
        displayCurrency,
        setDisplayCurrency: handleSetDisplayCurrency,
        detectedCurrency,
        formatPrice,
        convertPrice,
        symbol: CURRENCY_CONFIG[displayCurrency]?.symbol || 'NGN',
        rate: rates[displayCurrency] ?? CURRENCY_CONFIG[displayCurrency]?.rate ?? 1,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyContext() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrencyContext must be used within CurrencyProvider');
  }
  return context;
}

export function useCurrency() {
  return useCurrencyContext();
}

function detectCurrency(): SupportedCurrency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzMap: Record<string, SupportedCurrency> = {
      'Africa/Lagos': 'NGN',
      'Africa/Porto-Novo': 'XOF',
      'Africa/Lome': 'XOF',
      'Africa/Accra': 'GHS',
      'Europe/London': 'GBP',
      'Europe/Paris': 'EUR',
      'Europe/Berlin': 'EUR',
      'Europe/Madrid': 'EUR',
      'Europe/Rome': 'EUR',
      'Europe/Amsterdam': 'EUR',
      'Europe/Brussels': 'EUR',
      'Europe/Vienna': 'EUR',
    };
    if (tz && isSupportedCurrency(tzMap[tz])) return tzMap[tz];
  } catch (error) {
    // Use locale detection below.
  }

  try {
    const locale = (navigator.language || '').toUpperCase();
    if (locale.includes('NG') || locale.includes('NGA')) return 'NGN';
    if (locale.includes('BJ') || locale.includes('BEN') || locale.includes('TG') || locale.includes('TGO')) return 'XOF';
    if (locale.includes('GH') || locale.includes('GHA')) return 'GHS';
    if (locale.includes('US') || locale.includes('USA')) return 'USD';
    if (locale.includes('GB') || locale.includes('GBR')) return 'GBP';
    if (['FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'GR', 'FI', 'SE', 'DK', 'LU', 'IE', 'CY', 'MT', 'SK', 'SI'].some((code) => locale.includes(code))) {
      return 'EUR';
    }
  } catch (error) {
    // Use default currency.
  }

  return 'NGN';
}

function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === 'string' && ['NGN', 'XOF', 'GHS', 'USD', 'EUR', 'GBP'].includes(value);
}
