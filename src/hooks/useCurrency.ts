import { useEffect, useState } from 'react';

const TZ_MAP: Record<string, string> = {
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

const RATES: Record<string, { rate: number; symbol: string }> = {
  NGN: { rate: 1, symbol: '₦' },
  XOF: { rate: 0.41, symbol: 'CFA' },
  GHS: { rate: 0.0097, symbol: 'GH₵' },
  USD: { rate: 0.00067, symbol: '$' },
  EUR: { rate: 0.00062, symbol: '€' },
  GBP: { rate: 0.00053, symbol: '£' },
};

export function useCurrency() {
  const [currency, setCurrency] = useState('NGN');
  const [rate, setRate] = useState(1);

  useEffect(() => {
    async function detectCurrency() {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const mapped = TZ_MAP[tz];
        if (mapped && RATES[mapped]) {
          setCurrency(mapped);
          setRate(RATES[mapped].rate);
          return;
        }
      } catch (error) {
        // Keep the Nigerian default.
      }

      try {
        const locale = navigator.language;
        if (locale.includes('NG')) {
          setCurrency('NGN');
          setRate(1);
          return;
        }
      } catch (error) {
        // Keep the Nigerian default.
      }
    }

    detectCurrency();
  }, []);

  const formatPrice = (amountInNaira: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'NGN' ? 0 : 2,
      }).format(amountInNaira * rate);
    } catch (error) {
      return `${RATES[currency]?.symbol || '₦'}${Math.round(amountInNaira * rate).toLocaleString()}`;
    }
  };

  return { currency, formatPrice, symbol: RATES[currency]?.symbol || '₦' };
}
