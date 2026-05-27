import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../hooks/useCurrency';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { apiGet, apiPost } from '../lib/api';

const getStripePromise = () => {
  const key = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    return null;
  }
  return loadStripe(key);
};

const stripePromise = getStripePromise();

function StripeForm({ bookingId, onSuccess, onLoading }: { bookingId: string, amount: number, onSuccess: (id: string) => Promise<void> | void, onLoading: (status: boolean) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !user) return;

    onLoading(true);
    setError(null);

    try {
      // 1. Create Payment Intent on server
      const { data } = await apiPost('/api/payment/stripe/create-intent', {
        bookingId,
        email: user.email
      });

      const { clientSecret } = data;

      // 2. Confirm Payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement) as any,
          billing_details: {
            email: user.email || '',
            name: user.displayName || 'Customer'
          },
        },
      });

      if (result.error) {
        setError(result.error.message || 'Payment failed');
      } else {
        if (result.paymentIntent.status === 'succeeded') {
          await apiPost('/api/payment/stripe/reconcile', {
            paymentIntentId: result.paymentIntent.id
          });
          await onSuccess(result.paymentIntent.id);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('An error occurred during payment processing.');
    } finally {
      onLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-surface-container border border-outline rounded-md">
        <CardElement options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#1a1a1a',
              '::placeholder': {
                color: '#666',
              },
            },
          }
        }} />
      </div>
      {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
      <button 
        type="submit" 
        disabled={!stripe || !elements}
        className="w-full py-4 bg-primary text-on-primary font-bold rounded-md hover:bg-primary-container transition-colors flex items-center justify-center gap-3 text-sm"
      >
        Pay with Stripe
        <span className="material-symbols-outlined">verified_user</span>
      </button>
    </form>
  );
}

export default function Checkout() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paystack'>('stripe');
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Load Paystack Inline JS
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    }
  }, []);

  useEffect(() => {
    async function fetchBooking() {
      if (!bookingId) return;
      try {
        const snap = await getDoc(doc(db, 'bookings', bookingId));
        if (snap.exists()) {
          setBooking(snap.data());
        }
      } catch (error) {
        console.error("Error fetching booking:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBooking();
  }, [bookingId]);

  const handleSuccess = async (_paymentIntentId?: string) => {
    if (!user || !bookingId) return;
    
    try {
      setSuccess(true);
    } catch (error) {
      console.error("Error finalizing booking status:", error);
    }
  };

  const handlePaystackPayment = async () => {
    if (!user || !bookingId || !booking) return;
    setPaying(true);

    try {
      const paystackKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!paystackKey) {
        alert("Paystack Public Key is missing. Please configure it in settings.");
        setPaying(false);
        return;
      }

      // 1. Initialize on server to get transaction details
      const { data } = await apiPost('/api/payment/paystack/initialize', {
        email: user.email,
        bookingId
      });

      const { data: { reference } } = data;

      // 2. Use Paystack Popup
      // @ts-ignore
      const handler = PaystackPop.setup({
        key: paystackKey,
        email: user.email,
        amount: Math.round(booking.totalAmount * 100),
        ref: reference,
        onClose: () => {
          setPaying(false);
        },
        callback: async (response: any) => {
          // 3. Verify on server
          const verify = await apiGet(`/api/payment/paystack/verify/${response.reference}`);
          if (verify.data.status === 'success') {
            await handleSuccess();
          } else {
            alert("Payment verification failed.");
          }
          setPaying(false);
        }
      });
      handler.openIframe();
    } catch (error) {
       console.error("Paystack Error:", error);
       alert("Failed to initialize Paystack payment.");
       setPaying(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="p-8 md:p-12 flex items-center justify-center min-h-[calc(100vh-160px)] bg-background">
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div 
            key="payment-form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-5xl bg-white rounded-lg border border-outline shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-2"
          >
            {/* Summary */}
            <div className="bg-surface-container p-12 border-b lg:border-b-0 lg:border-r border-outline">
               <span className="text-sm font-bold text-primary mb-12 block">Secure booking payment</span>
               <h2 className="text-4xl font-bold mb-4">#{bookingId?.slice(-6).toUpperCase()}</h2>
               <p className="text-sm text-on-surface-variant mb-12 font-medium">Complete payment to confirm this transport booking.</p>
               
               <div className="space-y-8 relative z-10">
                  <div className="flex justify-between items-center">
                     <span className="text-on-surface-variant text-sm font-bold">Vehicle class</span>
                     <span className="font-bold text-sm">{booking?.vehicleClass}</span>
                  </div>
                  <div className="flex justify-between items-start text-xs">
                     <span className="text-on-surface-variant text-sm font-bold">Route</span>
                     <div className="text-right max-w-[200px]">
                        <p className="font-bold text-sm">{booking?.pickup}</p>
                        <p className="text-xs opacity-50 font-bold py-1">to</p>
                        <p className="font-bold text-sm">{booking?.destination}</p>
                     </div>
                  </div>
                  <div className="pt-10 border-t border-outline flex justify-between items-baseline">
                     <span className="font-bold text-sm text-primary">Total amount</span>
                     <div className="flex items-baseline gap-1">
                        <span className="font-bold text-4xl text-on-surface md:text-5xl">{formatPrice(booking?.totalAmount || 0)}</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Payment Fields */}
            <div className="p-12 flex flex-col bg-white">
               <div className="mb-12">
                  <p className="text-sm font-bold text-on-surface-variant mb-6">Payment method</p>
                  <div className="flex gap-4">
                     {[
                       { id: 'stripe', icon: 'credit_card', label: 'Stripe Global' },
                       { id: 'paystack', icon: 'payments', label: 'Paystack Nigeria' }
                     ].map((m: any) => (
                       <button 
                         key={m.id}
                         onClick={() => setPaymentMethod(m.id)}
                         className={`flex-1 flex flex-col items-center gap-3 py-6 rounded-md border transition-all text-sm font-bold ${
                           paymentMethod === m.id 
                             ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20' 
                             : 'bg-surface-container border-outline hover:border-primary text-on-surface-variant'
                         }`}
                       >
                         <span className="material-symbols-outlined text-2xl">{m.icon}</span>
                         {m.label}
                       </button>
                     ))}
                  </div>
               </div>

                <div className="flex-1">
                  {paymentMethod === 'stripe' ? (
                    <div className="space-y-6">
                       <p className="text-sm font-bold text-on-surface-variant mb-4">Secure card payment</p>
                       {stripePromise ? (
                         <Elements stripe={stripePromise}>
                           <StripeForm 
                             bookingId={bookingId || ''} 
                             amount={booking?.totalAmount || 0} 
                             onSuccess={handleSuccess} 
                             onLoading={setPaying}
                           />
                         </Elements>
                       ) : (
                         <div className="p-8 bg-red-50 border border-red-100 rounded-lg text-center">
                            <span className="material-symbols-outlined text-red-500 mb-4">warning</span>
                            <p className="text-sm font-bold text-red-500">Stripe is not configured</p>
                            <p className="text-xs text-red-400 mt-2">Please provide VITE_STRIPE_PUBLISHABLE_KEY in settings.</p>
                         </div>
                       )}
                    </div>
                  ) : (
                   <div className="space-y-8 flex flex-col items-center justify-center py-10 bg-surface-container/30 rounded-lg border border-dashed border-outline">
                      <div className="text-center px-8">
                         <h4 className="text-sm font-bold mb-2">Paystack online</h4>
                         <p className="text-xs text-on-surface-variant font-medium opacity-70">Cards, bank transfers, USSD, and Nigerian payment channels.</p>
                      </div>
                      <button 
                        onClick={handlePaystackPayment}
                        disabled={paying}
                        className="px-10 py-4 bg-[#011b33] text-white font-bold rounded-md hover:bg-[#03284a] transition-colors text-sm"
                      >
                         {paying ? 'Processing...' : 'Pay with Paystack'}
                      </button>
                   </div>
                 )}
               </div>

               <div className="mt-12 flex items-center justify-center gap-2 opacity-30">
                  <span className="material-symbols-outlined text-xs">shield</span>
                  <p className="text-xs font-bold">
                    Secure encrypted checkout
                  </p>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="success-screen"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-white p-12 md:p-20 rounded-lg border border-outline shadow-sm max-w-xl w-full relative overflow-hidden"
          >
             <div className="w-24 h-24 bg-primary/10 text-primary rounded-lg flex items-center justify-center mx-auto mb-10">
                <span className="material-symbols-outlined text-6xl">check_circle</span>
             </div>
             <h2 className="text-4xl font-bold mb-6">Booking confirmed.</h2>
             <p className="text-on-surface-variant font-medium text-sm leading-relaxed mb-12">
               Payment is complete and your booking is active. You can follow updates from your dashboard.
             </p>
             <div className="flex flex-col gap-6">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="py-4 bg-primary text-on-primary font-bold rounded-md text-sm hover:bg-primary-container transition-colors"
                >
                  Return to Dashboard
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
