import { FormEvent, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiErrorMessage, apiPost } from '../../lib/api';
import { Spinner } from '../ui/motion';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function StripeForm({ amountLabel, onPaid }: { amountLabel: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href }, redirect: 'if_required' });
      if (result.error) {
        setError(result.error.message || 'Your card payment didn’t go through.');
      } else if (result.paymentIntent) {
        // The server re-reads the intent from Stripe; the browser result is never trusted.
        await apiPost('/api/payment/stripe/reconcile', { paymentIntentId: result.paymentIntent.id });
        onPaid();
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'We couldn’t confirm the payment yet. Please refresh in a moment.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p role="alert" className="alert-error text-xs">{error}</p>}
      <button type="submit" disabled={!stripe || submitting} className="btn-primary btn-lg w-full">
        {submitting ? <><Spinner /> Paying…</> : `Pay ${amountLabel}`}
      </button>
    </form>
  );
}

export default function StripePaymentForm({ clientSecret, amountLabel, onPaid }: { clientSecret: string; amountLabel: string; onPaid: () => void }) {
  if (!stripePromise) return <p className="alert-error text-xs">Card payments aren’t available right now.</p>;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#c1121f', borderRadius: '12px' } } }}>
      <StripeForm amountLabel={amountLabel} onPaid={onPaid} />
    </Elements>
  );
}
