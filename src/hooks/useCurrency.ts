import { useState, useEffect } from 'react';

// Common timezone to currency mapping
const TZ_MAP: Record<string, string> = {
  'Africa/Johannesburg': 'ZAR',
  'Europe/London': 'GBP',
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Amsterdam': 'EUR',
  'Europe/Brussels': 'EUR',
  'Europe/Vienna': 'EUR',
  'Africa/Nairobi': 'KES',
  'Africa/Lagos': 'NGN',
  'Africa/Cairo': 'EGP',
};

// Hardcoded rates for the demo
const RATES: Record<string, { rate: number; symbol: string }> = {
  'USD': { rate: 1, symbol: '$' },
  'ZAR': { rate: 18.5, symbol: 'R' },
  'EUR': { rate: 0.92, symbol: '€' },
  'GBP': { rate: 0.79, symbol: '£' },
};

export function useCurrency() {
  const [currency, setCurrency] = useState('USD');
  const [rate, setRate] = useState(1);

  useEffect(() => {
    async function detectCurrency() {
      // 1. Try Timezone detection (fast and local)
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (TZ_MAP[tz]) {
          const code = TZ_MAP[tz];
          setCurrency(code);
          setRate(RATES[code]?.rate || 1);
          return;
        }
      } catch (e) {
        // Silently continue to next check
      }

      // 2. Try Locale detection
      try {
        const locale = navigator.language;
        if (locale.includes('ZA')) {
          setCurrency('ZAR');
          setRate(18.5);
          return;
        } else if (locale.includes('GB')) {
          setCurrency('GBP');
          setRate(0.79);
          return;
        } else if (['FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'AT'].some(c => locale.includes(c))) {
          setCurrency('EUR');
          setRate(0.92);
          return;
        }
      } catch (e) {
        // Silently continue
      }

      // 3. Optional: Try a more stable Fetch API with no-cors or similar if available, 
      // but to avoid the "Failed to fetch" error, we'll wrap it carefully.
      try {
        // Only try fetch if we still have default USD
        const res = await fetch('https://ipapi.co/json/', { 
          // Adding a timeout and signal handling could be good, 
          // but just basic try/catch is usually enough to stop the console spam if handled.
        });
        if (res.ok) {
          const data = await res.json();
          if (data.currency && RATES[data.currency]) {
            setCurrency(data.currency);
            setRate(RATES[data.currency].rate);
          }
        }
      } catch (e) {
        // Silent fail - we already have reasonable defaults from steps 1 & 2 or the initial state
      }
    }
    detectCurrency();
  }, []);

  const formatPrice = (usdAmount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency,
      }).format(usdAmount * rate);
    } catch (e) {
      // Fallback formatting if Intl fails for some currency code
      return `${RATES[currency]?.symbol || '$'}${ (usdAmount * rate).toFixed(2) }`;
    }
  };

  return { currency, formatPrice, symbol: RATES[currency]?.symbol || '$' };
}
