import React, { createContext, useContext, useState, useEffect } from 'react';

export type SupportedCurrency = 'NGN' | 'XOF' | 'GHS' | 'USD' | 'EUR' | 'GBP';

export const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string; rate: number }> = {
  NGN: { name: 'Nigerian Naira', symbol: '₦', rate: 1 },
  XOF: { name: 'West African CFA Franc', symbol: 'CFA', rate: 0.41 },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵', rate: 0.0097 },
  USD: { name: 'US Dollar', symbol: '$', rate: 0.00067 },
  EUR: { name: 'Euro', symbol: '€', rate: 0.00062 },
  GBP: { name: 'British Pound', symbol: '£', rate: 0.00053 },
};

interface CurrencyContextType {
  baseCurrency: 'NGN'; // All prices stored in NGN
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

  // Auto-detect currency on mount
  useEffect(() => {
    const detected = detectCurrency();
    setDetectedCurrency(detected);
    setDisplayCurrency(detected);
    // Persist user's manual selection to localStorage
    const saved = localStorage.getItem('blm-currency');
    if (saved && isSupportedCurrency(saved)) {
      setDisplayCurrency(saved);
    } else {
      setDisplayCurrency(detected);
    }
  }, []);

  // Save currency preference to localStorage when it changes
  const handleSetDisplayCurrency = (currency: SupportedCurrency) => {
    setDisplayCurrency(currency);
    localStorage.setItem('blm-currency', currency);
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
      const symbol = CURRENCY_CONFIG[displayCurrency]?.symbol || '₦';
      return `${symbol}${converted.toFixed(decimals)}`;
    }
  };

  const convertPrice = (amountInBaseCurrency: number, toCurrency: SupportedCurrency = displayCurrency): number => {
    const rate = CURRENCY_CONFIG[toCurrency]?.rate || 1;
    return amountInBaseCurrency * rate;
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
        symbol: CURRENCY_CONFIG[displayCurrency]?.symbol || '₦',
        rate: CURRENCY_CONFIG[displayCurrency]?.rate || 1,
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

// Keep the old hook for backward compatibility
export function useCurrency() {
  return useCurrencyContext();
}

function detectCurrency(): SupportedCurrency {
  // Try timezone detection first
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
    if (tz && isSupportedCurrency(tzMap[tz])) {
      return tzMap[tz];
    }
  } catch (error) {
    // Continue to locale detection
  }

  // Try locale detection
  try {
    const locale = (navigator.language || '').toUpperCase();
    if (locale.includes('NG') || locale.includes('NGA')) return 'NGN';
    if (locale.includes('BJ') || locale.includes('BEN') || locale.includes('TG') || locale.includes('TGO')) return 'XOF';
    if (locale.includes('GH') || locale.includes('GHA')) return 'GHS';
    if (locale.includes('US') || locale.includes('USA')) return 'USD';
    if (locale.includes('GB') || locale.includes('GBR')) return 'GBP';
    if (['FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'GR', 'FI', 'SE', 'DK', 'LU', 'IE', 'CY', 'MT', 'SK', 'SI'].some(code => locale.includes(code))) {
      return 'EUR';
    }
  } catch (error) {
    // Use default
  }

  return 'NGN'; // Default to Nigerian Naira
}

function isSupportedCurrency(value: any): value is SupportedCurrency {
  return ['NGN', 'XOF', 'GHS', 'USD', 'EUR', 'GBP'].includes(value);
}
