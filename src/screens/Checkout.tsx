import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { apiErrorMessage, apiGet, apiPost } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useCatalog } from '../hooks/useCatalog';
import { useCurrency } from '../contexts/CurrencyContext';
import { useLocale } from '../contexts/LocaleContext';
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '../lib/catalog';
import type { BankAccountConfig, PaymentRecord } from '../lib/payments/types';
import StripePaymentForm from '../components/payments/StripePaymentForm';
import { easeOutExpo, Spinner } from '../components/ui/motion';

type CheckoutData = { booking: Record<string, any>; payments: PaymentRecord[]; bankDetails: BankAccountConfig | null };
type Method = 'paystack' | 'stripe' | 'bank_transfer';

const PAID_STATUSES = ['Paid', 'Confirmed', 'Dispatched', 'InTransit', 'Completed'];

export default function Checkout() {
  const { bookingId = '' } = useParams<{ bookingId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { catalog } = useCatalog();
  const { formatPrice, displayCurrency } = useCurrency();
  const { t } = useLocale();

  const [data, setData] = useState<CheckoutData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeSecret, setStripeSecret] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiGet<CheckoutData>(`/api/bookings/${encodeURIComponent(bookingId)}`);
      setData(response.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'We couldn’t load this booking.'));
    }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);

  // Paystack redirects back with ?reference=…; verify it server-side once.
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) return;
    setBusy('verify');
    apiGet(`/api/payment/paystack/verify/${encodeURIComponent(reference)}`)
      .then(load)
      .catch((err) => setError(apiErrorMessage(err, 'We couldn’t confirm your Paystack payment yet.')))
      .finally(() => {
        setBusy(null);
        setSearchParams({}, { replace: true });
      });
  }, [load, searchParams, setSearchParams]);

  // Live: reload when the booking changes (payment approved, dispatch, etc.).
  useEffect(() => {
    if (!user || !bookingId) return;
    let first = true;
    return onSnapshot(doc(db, 'bookings', bookingId), () => {
      if (first) { first = false; return; }
      void load();
    }, () => undefined);
  }, [bookingId, load, user]);

  const payments = catalog?.payments;
  useEffect(() => {
    if (method || !payments || !data) return;
    const hasTransfer = data.payments.some((payment) => payment.provider === 'manual_bank_transfer');
    setMethod(hasTransfer && payments.manualBankTransfer ? 'bank_transfer' : payments.paystack ? 'paystack' : payments.stripe ? 'stripe' : payments.manualBankTransfer ? 'bank_transfer' : null);
  }, [data, method, payments]);

  if (loadError) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant">receipt_long</span>
        <h1 className="mt-4 text-2xl font-extrabold">Booking not found</h1>
        <p className="mt-2 text-on-surface-variant">{loadError}</p>
        <div className="mt-8 flex gap-3"><button onClick={load} className="btn-outline">Retry</button><Link to="/bookings" className="btn-primary">My bookings</Link></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6"><div className="skeleton h-24" /><div className="skeleton h-72" /></div>
        <div className="skeleton h-96" />
      </div>
    );
  }

  const { booking } = data;
  const manual = data.payments.find((payment) => payment.provider === 'manual_bank_transfer');
  const isPaid = PAID_STATUSES.includes(booking.status);
  const isCancelled = booking.status === 'Cancelled';
  const invoiceCurrency: SupportedCurrency = SUPPORTED_CURRENCIES.includes(booking.displayCurrency) ? booking.displayCurrency : displayCurrency;
  const paystackCurrency: SupportedCurrency = invoiceCurrency === 'GHS' ? 'GHS' : 'NGN';
  const total = Number(booking.totalAmount || 0);
  const snapshot = booking.pricingSnapshot || {};

  const copy = (value: string, key: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const startPaystack = () => run('paystack', async () => {
    const response = await apiPost<{ data?: { authorization_url?: string } }>('/api/payment/paystack/initialize', { bookingId, currency: paystackCurrency });
    const url = response.data?.data?.authorization_url;
    if (!url) throw new Error('Paystack didn’t open. Please try again.');
    window.location.assign(url);
  });

  const startStripe = () => run('stripe', async () => {
    const response = await apiPost<{ clientSecret: string }>('/api/payment/stripe/create-intent', { bookingId, currency: invoiceCurrency });
    setStripeSecret(response.data.clientSecret);
  });

  const startTransfer = () => run('transfer', async () => {
    await apiPost('/api/payment/manual/initialize', { bookingId });
    await load();
  });

  const submitProof = (event: FormEvent) => {
    event.preventDefault();
    if (!proof || !manual || !user) return;
    void run('proof', async () => {
      const safeName = proof.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileRef = storageRef(storage, `payment-proofs/${user.uid}/${manual.id}/${Date.now()}-${safeName}`);
      await uploadBytes(fileRef, proof, { contentType: proof.type });
      await apiPost('/api/payment/manual/proof', {
        paymentId: manual.id,
        proofOfPaymentUrl: await getDownloadURL(fileRef),
        proofFileName: proof.name,
        customerNote: note.trim() || undefined,
      });
      setProof(null);
      await load();
    });
  };

  const pickProof = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('The file is too big. Please keep it under 5 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) return setError('Please upload a photo (JPG, PNG, WEBP) or a PDF.');
    setProof(file);
  };

  const cancelBooking = () => run('cancel', async () => {
    if (!window.confirm('Cancel this booking? You can’t undo this.')) return;
    await apiPost('/api/bookings/cancel', { bookingId, reason: 'Cancelled by customer at checkout' });
    navigate('/bookings', { replace: true });
  });

  const methods: { id: Method; label: string; detail: string; icon: string; enabled: boolean }[] = [
    { id: 'paystack', label: 'Paystack', detail: `Card, bank app or USSD (${paystackCurrency})`, icon: 'bolt', enabled: Boolean(payments?.paystack) },
    { id: 'stripe', label: 'Debit or credit card', detail: `Visa or Mastercard (${invoiceCurrency})`, icon: 'credit_card', enabled: Boolean(payments?.stripe) },
    { id: 'bank_transfer', label: 'Bank transfer', detail: 'Send money to our account and upload the receipt', icon: 'account_balance', enabled: Boolean(payments?.manualBankTransfer) },
  ];

  const steps = ['Booked', 'Pay', 'Done'];
  const stepIndex = isPaid ? 2 : manual?.status === 'UNDER_REVIEW' ? 1 : 1;

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{t('checkout')}</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{isPaid ? 'You’re booked!' : isCancelled ? 'Booking cancelled' : 'Pay for your booking'}</h1>
        </div>
        <ol className="flex items-center gap-2 text-xs font-bold">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <motion.span animate={{ backgroundColor: index <= stepIndex ? '#c1121f' : '#e2e3df', color: index <= stepIndex ? '#fff' : '#555c62' }} className="flex h-7 w-7 items-center justify-center rounded-full">
                {index < stepIndex || (isPaid && index === 2) ? <span className="material-symbols-outlined text-sm">check</span> : index + 1}
              </motion.span>
              <span className={index <= stepIndex ? 'text-on-surface' : 'text-on-surface-variant'}>{step}</span>
              {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-outline" />}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <AnimatePresence>
            {error && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert-error" role="alert"><span className="material-symbols-outlined">error</span>{error}</motion.div>}
          </AnimatePresence>

          {busy === 'verify' && <div className="alert-info"><Spinner /> Checking your Paystack payment…</div>}

          {isPaid && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease: easeOutExpo, duration: 0.6 }} className="card overflow-hidden">
              <div className="flex items-center gap-5 bg-green-50 p-6">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <span className="material-symbols-outlined text-3xl">check</span>
                </motion.span>
                <div>
                  <p className="text-lg font-bold text-green-900">Payment received</p>
                  <p className="text-sm text-green-800">We’ll assign your driver and let you know by SMS and email.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 p-6">
                <Link to={`/tracking?booking=${encodeURIComponent(booking.trackingId || bookingId)}`} className="btn-primary">Track this booking</Link>
                <Link to="/dashboard" className="btn-outline">Go to dashboard</Link>
              </div>
            </motion.div>
          )}

          {isCancelled && <div className="alert-info"><span className="material-symbols-outlined">block</span>This booking was cancelled{booking.refundStatus && booking.refundStatus !== 'N/A' ? ` · refund: ${booking.refundStatus}` : ''}.</div>}

          {!isPaid && !isCancelled && (
            <section className="card p-6 sm:p-8">
              <h2 className="text-lg font-bold">{t('selectPayment')}</h2>
              {!payments ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-24" />)}</div>
              ) : methods.every((item) => !item.enabled) ? (
                <p className="alert-info mt-5">Online payment isn’t available right now. Please message us on WhatsApp to finish your booking.</p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {methods.map((item) => (
                    <button key={item.id} type="button" disabled={!item.enabled} onClick={() => { setMethod(item.id); setError(null); }} className="option-card text-left disabled:cursor-not-allowed disabled:opacity-45" data-active={method === item.id}>
                      <span className="material-symbols-outlined text-primary">{item.icon}</span>
                      <p className="mt-2 text-sm font-bold">{item.label}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{item.enabled ? item.detail : 'Not available right now'}</p>
                    </button>
                  ))}
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div key={method || 'none'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="mt-6">
                  {method === 'paystack' && (
                    <button type="button" onClick={startPaystack} disabled={busy !== null} className="btn-primary btn-lg w-full">
                      {busy === 'paystack' ? <><Spinner /> Opening Paystack…</> : `Pay ${formatPrice(total, paystackCurrency)} with Paystack`}
                    </button>
                  )}
                  {method === 'stripe' && (stripeSecret ? (
                    <StripePaymentForm clientSecret={stripeSecret} amountLabel={formatPrice(total, invoiceCurrency)} onPaid={load} />
                  ) : (
                    <button type="button" onClick={startStripe} disabled={busy !== null} className="btn-primary btn-lg w-full">
                      {busy === 'stripe' ? <><Spinner /> Loading card form…</> : `Pay ${formatPrice(total, invoiceCurrency)} by card`}
                    </button>
                  ))}
                  {method === 'bank_transfer' && !manual && (
                    <button type="button" onClick={startTransfer} disabled={busy !== null} className="btn-primary btn-lg w-full">
                      {busy === 'transfer' ? <><Spinner /> Getting details…</> : 'Show bank details'}
                    </button>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>
          )}

          {!isPaid && !isCancelled && method === 'bank_transfer' && manual && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Transfer {formatPrice(total, 'NGN')}</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Put the reference below in the transfer description{manual.deadline ? `, and pay before ${new Date(manual.deadline).toLocaleString()}` : ''}.</p>
                </div>
                <PaymentStatus status={manual.status} />
              </div>
              {manual.status === 'PAYMENT_REJECTED' && <p className="alert-error mt-4">We couldn’t confirm this payment: {manual.rejectionReason || 'transfer not found'}. Please upload the correct receipt.</p>}
              {data.bankDetails ? (
                <dl className="mt-6 divide-y divide-outline rounded-2xl border border-outline">
                  {[
                    ['Reference', manual.paymentReference, 'ref'],
                    ['Bank', data.bankDetails.bankName],
                    ['Account name', data.bankDetails.accountName],
                    ['Account number', data.bankDetails.accountNumber, 'acct'],
                  ].map(([label, value, key]) => (
                    <div key={label} className="flex items-center justify-between gap-4 px-5 py-4">
                      <dt className="text-sm text-on-surface-variant">{label}</dt>
                      <dd className="flex items-center gap-2 font-mono text-sm font-bold">
                        {value}
                        {key && value && (
                          <button type="button" onClick={() => copy(value, key)} className="flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary-soft" aria-label={`Copy ${label}`}>
                            <span className="material-symbols-outlined text-base">{copied === key ? 'check' : 'content_copy'}</span>
                          </button>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="alert-info mt-6">Our bank details are being updated. Please contact us before you send any money.</p>
              )}
              {data.bankDetails?.instructions && <p className="mt-4 text-sm text-on-surface-variant">{data.bankDetails.instructions}</p>}

              <form onSubmit={submitProof} className="mt-8 space-y-4 border-t border-outline pt-6">
                <h3 className="font-bold">{manual.status === 'UNDER_REVIEW' ? 'We’re checking your receipt — you can replace it if needed' : 'Upload your receipt'}</h3>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline p-8 text-center transition-colors hover:border-primary hover:bg-primary-soft/40">
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pickProof} className="sr-only" />
                  <span className="material-symbols-outlined text-3xl text-primary">{proof ? 'description' : 'upload_file'}</span>
                  <span className="text-sm font-bold">{proof ? proof.name : 'Choose your receipt (photo or PDF, up to 5 MB)'}</span>
                </label>
                <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Name on the account you paid from (optional)" maxLength={500} />
                <button type="submit" disabled={!proof || busy !== null} className="btn-primary w-full">
                  {busy === 'proof' ? <><Spinner /> Uploading…</> : 'Send receipt'}
                </button>
              </form>
            </motion.section>
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-outline bg-secondary px-6 py-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Tracking number</p>
              <p className="mt-1 font-mono text-lg font-bold">{booking.trackingId || bookingId}</p>
            </div>
            <dl className="space-y-3 p-6 text-sm">
              <SummaryRow label="Service" value={booking.serviceType} />
              <SummaryRow label="Car or package" value={booking.vehicleClass} />
              <SummaryRow label="From" value={booking.pickup} />
              <SummaryRow label="To" value={booking.destination} />
              <SummaryRow label="When" value={`${booking.date} · ${booking.time}`} />
              {Number(snapshot.distanceKm) > 0 && <SummaryRow label="Distance" value={`${snapshot.distanceKm} km`} />}
              <div className="border-t border-outline pt-3" />
              <SummaryRow label="Trip price" value={formatPrice(Number(snapshot.basePrice || 0), invoiceCurrency)} />
              {Number(snapshot.extraFee) > 0 && <SummaryRow label={snapshot.feeLabel || 'Fees'} value={formatPrice(Number(snapshot.extraFee), invoiceCurrency)} />}
              {Number(snapshot.weekendSurcharge) > 0 && <SummaryRow label="Weekend surcharge" value={formatPrice(Number(snapshot.weekendSurcharge), invoiceCurrency)} />}
              {Number(snapshot.nightSurcharge) > 0 && <SummaryRow label="Night surcharge" value={formatPrice(Number(snapshot.nightSurcharge), invoiceCurrency)} />}
              <div className="flex items-baseline justify-between border-t border-outline pt-4">
                <dt className="font-bold">Total</dt>
                <dd className="text-2xl font-extrabold text-primary">{formatPrice(total, invoiceCurrency)}</dd>
              </div>
              {invoiceCurrency !== 'NGN' && <p className="text-right text-xs text-on-surface-variant">That’s {formatPrice(total, 'NGN')} in naira</p>}
            </dl>
            {!isPaid && !isCancelled && ['Quoted', 'Booked'].includes(booking.status) && (
              <div className="border-t border-outline p-4">
                <button type="button" onClick={cancelBooking} disabled={busy !== null} className="btn-ghost w-full text-sm text-on-surface-variant">Cancel booking</button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-on-surface-variant">{label}</dt>
      <dd className="text-right font-semibold">{value || '—'}</dd>
    </div>
  );
}

function PaymentStatus({ status }: { status?: string }) {
  const labels: Record<string, [string, string]> = {
    AWAITING_PAYMENT: ['Waiting for payment', 'bg-surface-container text-on-surface'],
    UNDER_REVIEW: ['Checking receipt', 'bg-amber-100 text-amber-900'],
    PAID: ['Paid', 'bg-green-100 text-green-800'],
    PAYMENT_REJECTED: ['Not confirmed', 'bg-red-100 text-red-800'],
  };
  const [label, tone] = labels[status || ''] || [status || 'Pending', 'bg-surface-container text-on-surface'];
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}
