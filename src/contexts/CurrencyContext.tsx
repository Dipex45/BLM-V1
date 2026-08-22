import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

export interface CurrencyContextType {
  baseCurrency: 'NGN';
  displayCurrency: SupportedCurrency;
  setDisplayCurrency: (currency: SupportedCurrency) => void;
  detectedCurrency: SupportedCurrency;
  rates: Record<SupportedCurrency, number>;
  isLiveRates: boolean;
  lastRateUpdate: string | null;
  refreshRates: () => Promise<boolean>;
  formatPrice: (amountInBaseCurrency: number, targetCurrency?: SupportedCurrency) => string;
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
  const [isLiveRates, setIsLiveRates] = useState(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<string | null>(null);

  const fetchLiveRatesFromInternet = useCallback(async (): Promise<boolean> => {
    // Attempt 1: open.er-api.com (free, high-reliability, no key required)
    try {
      const resp = await fetch('https://open.er-api.com/v6/latest/NGN');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.result === 'success' && data.rates) {
          const liveRates: Record<SupportedCurrency, number> = {
            NGN: 1,
            XOF: Number(data.rates.XOF) || 0.41,
            GHS: Number(data.rates.GHS) || 0.0097,
            USD: Number(data.rates.USD) || 0.00067,
            EUR: Number(data.rates.EUR) || 0.00062,
            GBP: Number(data.rates.GBP) || 0.00053,
          };
          setRates(liveRates);
          setIsLiveRates(true);
          const nowStr = new Date().toISOString();
          setLastRateUpdate(nowStr);
          try {
            await setDoc(doc(db, 'settings', 'currency_rates'), { 
              key: 'currency_rates', 
              value: liveRates, 
              lastUpdated: nowStr,
              source: 'open.er-api.com'
            }, { merge: true });
          } catch (e) {}
          return true;
        }
      }
    } catch (err) {
      console.warn('Tier 1 currency rate fetch failed, trying fallback...', err);
    }

    // Attempt 2: exchangerate-api.com open endpoint
    try {
      const resp = await fetch('https://api.exchangerate-api.com/v4/latest/NGN');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.rates) {
          const liveRates: Record<SupportedCurrency, number> = {
            NGN: 1,
            XOF: Number(data.rates.XOF) || 0.41,
            GHS: Number(data.rates.GHS) || 0.0097,
            USD: Number(data.rates.USD) || 0.00067,
            EUR: Number(data.rates.EUR) || 0.00062,
            GBP: Number(data.rates.GBP) || 0.00053,
          };
          setRates(liveRates);
          setIsLiveRates(true);
          const nowStr = new Date().toISOString();
          setLastRateUpdate(nowStr);
          try {
            await setDoc(doc(db, 'settings', 'currency_rates'), { 
              key: 'currency_rates', 
              value: liveRates, 
              lastUpdated: nowStr,
              source: 'api.exchangerate-api.com'
            }, { merge: true });
          } catch (e) {}
          return true;
        }
      }
    } catch (err) {
      console.warn('Tier 2 currency rate fetch failed, trying fallback...', err);
    }

    // Attempt 3: jsdelivr Fawaz Ahmed currency CDN
    try {
      const resp = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/ngn.json');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.ngn) {
          const liveRates: Record<SupportedCurrency, number> = {
            NGN: 1,
            XOF: Number(data.ngn.xof) || 0.41,
            GHS: Number(data.ngn.ghs) || 0.0097,
            USD: Number(data.ngn.usd) || 0.00067,
            EUR: Number(data.ngn.eur) || 0.00062,
            GBP: Number(data.ngn.gbp) || 0.00053,
          };
          setRates(liveRates);
          setIsLiveRates(true);
          const nowStr = new Date().toISOString();
          setLastRateUpdate(nowStr);
          return true;
        }
      }
    } catch (err) {
      console.warn('Tier 3 currency rate fetch failed.', err);
    }

    return false;
  }, []);

  useEffect(() => {
    const detected = detectCurrency();
    const saved = localStorage.getItem('blm-currency');
    const nextCurrency = saved && isSupportedCurrency(saved) ? saved : detected;

    setDetectedCurrency(detected);
    setDisplayCurrency(nextCurrency);

    const loadRates = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'currency_rates'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.value) {
            setRates((prev) => ({ ...prev, ...data.value }));
          }
          if (data.lastUpdated) {
            setLastRateUpdate(data.lastUpdated);
          }
        }
      } catch (err) {
        console.warn('Using default currency rates');
      }
    };

    loadRates().then(() => {
      fetchLiveRatesFromInternet();
    });

    const intervalId = setInterval(() => {
      fetchLiveRatesFromInternet();
    }, 15 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [fetchLiveRatesFromInternet]);

  const handleSetDisplayCurrency = (currency: SupportedCurrency) => {
    setDisplayCurrency(currency);
    localStorage.setItem('blm-currency', currency);
  };

  const convertPrice = (amountInBaseCurrency: number, toCurrency: SupportedCurrency = displayCurrency): number => {
    if (!Number.isFinite(amountInBaseCurrency)) return 0;
    const rate = rates[toCurrency] ?? CURRENCY_CONFIG[toCurrency]?.rate ?? 1;
    return amountInBaseCurrency * rate;
  };

  const formatPrice = (amountInBaseCurrency: number, targetCurrency: SupportedCurrency = displayCurrency): string => {
    if (!Number.isFinite(amountInBaseCurrency)) return '0';
    const converted = convertPrice(amountInBaseCurrency, targetCurrency);
    const decimals = targetCurrency === 'NGN' || targetCurrency === 'XOF' ? 0 : 2;

    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: targetCurrency,
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      }).format(converted);
    } catch (error) {
      const symbol = CURRENCY_CONFIG[targetCurrency]?.symbol || targetCurrency;
      return `${symbol} ${converted.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        baseCurrency: 'NGN',
        displayCurrency,
        setDisplayCurrency: handleSetDisplayCurrency,
        detectedCurrency,
        rates,
        isLiveRates,
        lastRateUpdate,
        refreshRates: fetchLiveRatesFromInternet,
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
