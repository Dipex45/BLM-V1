import { FormEvent, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiPost } from '../../lib/api';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function StripeForm({ onPaid }: { onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (result.error) {
      setError(result.error.message || 'Stripe could not complete the payment.');
    } else if (result.paymentIntent) {
      await apiPost('/api/payment/stripe/reconcile', { paymentIntentId: result.paymentIntent.id });
      onPaid();
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p role="alert" className="rounded-md bg-error-container p-3 text-xs font-bold text-on-error-container">{error}</p>}
      <button type="submit" disabled={!stripe || submitting} className="w-full rounded-md bg-primary px-5 py-4 text-sm font-bold text-white disabled:opacity-50">
        {submitting ? 'Confirming payment...' : 'Pay securely with Stripe'}
      </button>
    </form>
  );
}

export default function StripePaymentForm({ clientSecret, onPaid }: { clientSecret: string; onPaid: () => void }) {
  if (!stripePromise) {
    return <p className="rounded-md bg-error-container p-3 text-xs font-bold text-on-error-container">Stripe publishable key is not configured.</p>;
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <StripeForm onPaid={onPaid} />
    </Elements>
  );
}
