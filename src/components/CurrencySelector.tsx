import { useCurrencyContext, CURRENCY_CONFIG, type SupportedCurrency } from '../contexts/CurrencyContext';

export default function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { displayCurrency, setDisplayCurrency, detectedCurrency, symbol } = useCurrencyContext();

  const currencies: SupportedCurrency[] = ['NGN', 'XOF', 'GHS', 'USD', 'EUR', 'GBP'];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-on-surface-variant uppercase">Currency:</span>
        <select
          value={displayCurrency}
          onChange={(e) => setDisplayCurrency(e.target.value as SupportedCurrency)}
          className="px-2 py-1 rounded-md border border-outline bg-white text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20"
        >
          {currencies.map((curr) => (
            <option key={curr} value={curr}>
              {curr} {CURRENCY_CONFIG[curr].symbol}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="bg-white border border-outline rounded-2xl p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-sm font-bold text-on-surface mb-2">Select display currency</h3>
        <p className="text-xs text-on-surface-variant">
          {displayCurrency === detectedCurrency 
            ? `Auto-detected as ${CURRENCY_CONFIG[displayCurrency].name}`
            : `Showing prices in ${CURRENCY_CONFIG[displayCurrency].name} (detected: ${CURRENCY_CONFIG[detectedCurrency].name})`
          }
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {currencies.map((curr) => (
          <button
            key={curr}
            onClick={() => setDisplayCurrency(curr)}
            className={`p-3 rounded-xl border-2 transition-all text-center ${
              displayCurrency === curr
                ? 'border-primary bg-primary/10 shadow-md'
                : 'border-outline bg-surface-container hover:border-primary/50'
            }`}
          >
            <p className="text-sm font-bold text-on-surface">{curr}</p>
            <p className="text-xs text-on-surface-variant mt-1">{CURRENCY_CONFIG[curr].symbol}</p>
            <p className="text-xs text-on-surface-variant mt-1">{CURRENCY_CONFIG[curr].name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
