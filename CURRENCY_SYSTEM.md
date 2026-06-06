# Currency System Documentation

## Overview
The BLM Motors application now features a comprehensive multi-currency system with automatic detection, manual switching, base currency storage, and dynamic conversion.

## Key Features

### 1. **Auto-Detection**
- Detects user's country/location automatically on first load
- Uses timezone information and browser locale
- Defaults to Nigerian Naira (NGN) if detection fails
- Detection happens on app initialization

### 2. **Manual Currency Switching**
- Users can manually select their preferred display currency
- Selection is persisted to localStorage
- Available currencies:
  - NGN (Nigerian Naira) - ₦
  - XOF (West African CFA Franc) - CFA
  - GHS (Ghanaian Cedi) - GH₵
  - USD (US Dollar) - $
  - EUR (Euro) - €
  - GBP (British Pound) - £

### 3. **Base Currency Storage**
- All prices are stored in the database in Nigerian Naira (NGN)
- No price duplication or inconsistency
- Single source of truth for pricing

### 4. **Dynamic Conversion**
- Real-time conversion rates applied for display
- Conversion rates in `src/contexts/CurrencyContext.tsx`:
  - NGN: 1.0 (base)
  - XOF: 0.41
  - GHS: 0.0097
  - USD: 0.00067
  - EUR: 0.00062
  - GBP: 0.00053

### 5. **Checkout Currency Selection**
- Users can select payment currency at checkout
- Selected currency used for payment processing
- Amount converted from NGN to chosen currency
- Both Stripe and Paystack support selected currency

## Implementation Files

### Context Layer
**`src/contexts/CurrencyContext.tsx`**
- Provides `CurrencyProvider` component
- Exports `useCurrencyContext()` hook
- Exports `useCurrency()` hook (backward compatible)
- Manages currency state and localStorage persistence

### Components
**`src/components/CurrencySelector.tsx`**
- Reusable currency selector component
- Two modes:
  - `compact={false}` (default): Full grid selector with descriptions
  - `compact={true}`: Dropdown selector for navbar
- Shows auto-detected currency status

### Hooks
**`src/hooks/useCurrency.ts`**
- Re-exports from `CurrencyContext.tsx`
- Maintains backward compatibility
- Provides:
  - `currency`: Current display currency
  - `formatPrice()`: Format prices in selected currency
  - `convertPrice()`: Convert NGN to any currency
  - `symbol`: Currency symbol

### Pages Updated
1. **`src/screens/About.tsx`**
   - Added currency selector section
   - Prices display in selected currency

2. **`src/screens/Checkout.tsx`**
   - Currency selection UI at checkout
   - Shows amount in selected currency
   - Passes currency to payment methods
   - Stores checkout currency in booking

3. **`src/components/Navbar.tsx`**
   - Compact currency selector in nav
   - Quick access to change currency

### App Setup
**`src/App.tsx`**
- Wraps app with `CurrencyProvider`
- All routes have access to currency context

## Usage Examples

### Using Currency in Components
```tsx
import { useCurrency } from '../hooks/useCurrency';

export function MyComponent() {
  const { formatPrice, currency, symbol } = useCurrency();
  
  return (
    <div>
      <p>Current currency: {currency}</p>
      <p>Price: {formatPrice(25000)}</p>
      <p>Symbol: {symbol}</p>
    </div>
  );
}
```

### Programmatic Currency Conversion
```tsx
import { useCurrencyContext } from '../contexts/CurrencyContext';

export function CheckPrice() {
  const { convertPrice, displayCurrency } = useCurrencyContext();
  
  // Convert 100,000 NGN to selected currency
  const amount = convertPrice(100000); // e.g., 41 XOF
  
  return <p>Amount: {amount.toFixed(2)} {displayCurrency}</p>;
}
```

### Manual Currency Switching
```tsx
import CurrencySelector from '../components/CurrencySelector';

export function Settings() {
  return (
    <div>
      <h2>Currency Settings</h2>
      <CurrencySelector compact={false} />
    </div>
  );
}
```

## Data Flow

### Checkout Currency Selection Flow
1. User selects currency at checkout (`selectedCurrency` state)
2. Payment amount converted from NGN to selected currency
3. Currency passed to payment gateway:
   - Stripe: Included in payment intent
   - Paystack: Included in initialization request
4. Booking saved with `checkoutCurrency` field
5. Payment processed in selected currency
6. Transaction verified with currency confirmation

### Price Calculation Flow
1. Base prices stored in NGN in Firestore
2. Booking.tsx calculates total in NGN
3. Checkout displays in selected currency using conversion
4. User pays in selected currency
5. Server verifies amount matches converted price

## Database Schema Updates

### Bookings Collection
```javascript
{
  // ... existing fields
  checkoutCurrency: "USD",        // Currency used at checkout
  totalAmount: 100000,             // Base amount in NGN
  paidAmount: 67,                  // Amount charged in selected currency
  paymentCurrency: "USD",          // Currency payment was processed in
}
```

## Server-Side Considerations

### Payment Gateway Integration
1. **Stripe**
   - Currency passed to `create-intent` API
   - Payment intent created in selected currency
   - Amount pre-calculated on server

2. **Paystack**
   - Currency passed to `initialize` API
   - Transaction amount calculated on server
   - Verification includes currency check

### API Endpoints to Update
- `POST /api/payment/stripe/create-intent`
  - Add: `currency`, `amountInBaseCurrency`
  - Calculate: converted amount for Stripe

- `POST /api/payment/paystack/initialize`
  - Add: `currency`, `amountInBaseCurrency`
  - Calculate: converted amount for Paystack

## Exchange Rate Updates

### Current Rates
To update exchange rates, modify `CURRENCY_CONFIG` in `src/contexts/CurrencyContext.tsx`:

```typescript
export const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string; rate: number }> = {
  NGN: { name: 'Nigerian Naira', symbol: '₦', rate: 1 },
  XOF: { name: 'West African CFA Franc', symbol: 'CFA', rate: 0.41 },
  // ... update rates as needed
};
```

### Dynamic Rate Updates (Future Enhancement)
Could fetch rates from external API:
1. Add rate update service
2. Call on app initialization
3. Store in context with timestamp
4. Refresh periodically

## LocalStorage Keys
- `blm-currency`: User's selected display currency

## Testing Checklist

- [ ] Auto-detect works on first load
- [ ] Manual currency switching persists
- [ ] Prices display correctly in all currencies
- [ ] Checkout shows amount in selected currency
- [ ] Stripe payment processes in selected currency
- [ ] Paystack payment processes in selected currency
- [ ] Booking stores correct checkout currency
- [ ] Currency selector visible in navbar
- [ ] Currency selector visible on About page
- [ ] Mobile responsiveness of selectors

## Future Enhancements

1. **Dynamic Exchange Rates**
   - Fetch from external API (exchangerate-api.com, etc.)
   - Cache with TTL
   - Automatic updates

2. **Exchange Rate History**
   - Track rates used for each transaction
   - For accounting/reconciliation

3. **Admin Currency Management**
   - Allow admins to set/override rates
   - Rate update history
   - Audit logging

4. **Multi-Currency Pricing**
   - Support base prices in different currencies
   - Per-region pricing
   - Dynamic conversion

5. **Currency Preferences**
   - User settings for preferred currency
   - Remember choice across sessions
   - Default currency per region

## Troubleshooting

### Currency Not Detecting
- Check browser timezone settings
- Verify `Intl.DateTimeFormat()` works
- Check navigator.language

### Prices Not Converting
- Verify rates in CURRENCY_CONFIG
- Check that base prices are in NGN
- Inspect formatPrice calculations

### Payment Amount Mismatch
- Verify server-side calculation matches client
- Check decimal places (NGN: 0, others: 2)
- Ensure currency passed to payment gateway

### localStorage Issues
- Clear browser cache/localStorage
- Check for quota exceeded
- Verify localStorage is enabled
