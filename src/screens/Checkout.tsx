import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../hooks/useCurrency';
import { paymentService } from '../lib/payments/paymentService';
import { BankAccountConfig, PaymentRecord } from '../lib/payments/types';
import { DEFAULT_BANK_CONFIG } from '../lib/payments/manualBankTransfer';

export default function Checkout() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const { formatPrice, displayCurrency } = useCurrency();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord | null>(null);
  const [bankConfig, setBankConfig] = useState<BankAccountConfig>(DEFAULT_BANK_CONFIG);
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'bank_transfer' | 'card' | 'paystack' | 'ussd' | 'wallet'>('bank_transfer');
  const [unavailableNotice, setUnavailableNotice] = useState<string | null>(null);

  const handleSelectPaymentMethod = (methodKey: 'bank_transfer' | 'card' | 'paystack' | 'ussd' | 'wallet', methodName: string) => {
    if (methodKey === 'bank_transfer') {
      setSelectedMethod('bank_transfer');
      setUnavailableNotice(null);
    } else {
      setSelectedMethod(methodKey);
      setUnavailableNotice(`${methodName} is currently unavailable. Please proceed with Direct Bank Transfer to complete your order seamlessly.`);
    }
  };

  // Upload Proof Form State
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Fetch Booking and Bank Details
  useEffect(() => {
    if (!bookingId) return;

    let unsubscribePayment: (() => void) | null = null;

    const initCheckout = async () => {
      try {
        setLoading(true);
        // 1. Fetch booking
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);
        
        if (!bookingSnap.exists()) {
          setLoading(false);
          return;
        }

        const bData = { id: bookingSnap.id, ...bookingSnap.data() };
        setBooking(bData);

        // 2. Fetch Bank Settings
        try {
          const bankSnap = await getDoc(doc(db, 'settings', 'bank_accounts'));
          if (bankSnap.exists() && bankSnap.data()?.value) {
            setBankConfig({ ...DEFAULT_BANK_CONFIG, ...bankSnap.data().value });
          }
        } catch (e) {
          console.warn('Using default bank config', e);
        }

        // 3. Ensure authoritative payment record is initialized
        let payment = await paymentService.getPaymentByBookingId(bookingId);
        if (!payment) {
          const initRes = await paymentService.initializePayment(bData, user);
          payment = await paymentService.getPaymentByBookingId(bookingId);
        }
        setPaymentRecord(payment);

        // 4. Real-time listener on payment record for instant admin approval updates
        if (payment?.id) {
          unsubscribePayment = onSnapshot(doc(db, 'payments', payment.id), (snap) => {
            if (snap.exists()) {
              setPaymentRecord({ ...snap.data(), id: snap.id } as PaymentRecord);
            }
          });
        }
      } catch (err) {
        console.error('Checkout init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initCheckout();

    return () => {
      if (unsubscribePayment) unsubscribePayment();
    };
  }, [bookingId, user]);

  const handleCopyAccount = () => {
    if (!bankConfig.accountNumber) return;
    navigator.clipboard.writeText(bankConfig.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyReference = () => {
    const ref = paymentRecord?.paymentReference || booking?.paymentReference;
    if (!ref) return;
    navigator.clipboard.writeText(ref);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2500);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds 5MB limit. Please upload a smaller image or PDF document.');
      return;
    }

    // Validate type (JPG, PNG, PDF)
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload a JPG, PNG image, or PDF document.');
      return;
    }

    setProofFile(file);

    // Generate preview for image files
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setProofPreview('/brand/pdf-icon.png');
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentRecord || !proofFile) {
      setUploadError('Please select a payment receipt file (image or PDF) to submit.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // Convert file to Base64 Data URL for secure internal storage
      const reader = new FileReader();
      reader.readAsDataURL(proofFile);
      reader.onload = async () => {
        try {
          const proofUrl = reader.result as string;
          await paymentService.submitProof(
            {
              paymentId: paymentRecord.id,
              customerNote: customerNote.trim(),
              proofOfPaymentUrl: proofUrl,
              proofFileName: proofFile.name,
            },
            user?.uid || 'guest'
          );
          setUploadSuccess(true);
        } catch (err: any) {
          setUploadError(err.message || 'Failed to submit proof. Please try again.');
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        setUploadError('Failed to read uploaded file.');
        setUploading(false);
      };
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload payment proof.');
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-bold text-on-surface-variant">Securing payment gateway & instructions...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-background px-4 text-center">
        <span className="material-symbols-outlined mb-4 text-6xl text-on-surface-variant">receipt_long</span>
        <h1 className="text-2xl font-bold text-on-surface">Booking Not Found</h1>
        <p className="mt-2 text-sm text-on-surface-variant">The requested booking reference could not be located.</p>
        <Link to="/services" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white">
          Explore Services
        </Link>
      </div>
    );
  }

  const paymentRef = paymentRecord?.paymentReference || booking.paymentReference || `BLM-${new Date().getFullYear()}-${booking.id.substring(0, 6).toUpperCase()}`;
  const trackingId = paymentRecord?.trackingId || booking.trackingId;
  const isPaid = paymentRecord?.status === 'PAID' || booking.status === 'Confirmed' || booking.status === 'Paid';
  const isUnderReview = paymentRecord?.status === 'UNDER_REVIEW' || uploadSuccess;
  const isRejected = paymentRecord?.status === 'PAYMENT_REJECTED';

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        {/* Header Breadcrumbs */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 rounded-lg border border-outline bg-white px-4 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Services
          </Link>

          {trackingId && (
            <Link
              to={`/tracking?booking=${encodeURIComponent(trackingId)}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              <span className="material-symbols-outlined text-base">location_searching</span>
              Live Track Booking
            </Link>
          )}
        </div>

        {/* Status Banner */}
        <div className="mb-8">
          {isPaid && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <span className="material-symbols-outlined text-2xl">verified</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-green-900">Payment Verified & Booking Confirmed!</h2>
                  <p className="text-xs font-medium text-green-700 mt-1">
                    Your transfer has been verified by the finance department. Your tracking ID is <span className="font-bold font-mono">{trackingId}</span>.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {isUnderReview && !isPaid && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <span className="material-symbols-outlined text-2xl">hourglass_top</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-amber-900">Payment Submitted For Verification</h2>
                  <p className="text-xs font-medium text-amber-700 mt-1">
                    Your proof of transfer has been received and is currently under review by our finance team. You will receive real-time status updates.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {isRejected && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-error/20 bg-error-container p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-error text-white">
                  <span className="material-symbols-outlined text-2xl">error</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-on-error-container">Payment Verification Failed</h2>
                  <p className="text-xs font-medium text-on-error-container/80 mt-1">
                    Reason: {paymentRecord?.rejectionReason || 'Transfer not found or incorrect amount.'}. Please re-verify the bank details and upload a valid receipt below.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left Column: Payment Methods & Bank Account Details */}
          <div className="space-y-6">
            {/* Payment Method Selector Card */}
            <div className="rounded-3xl border border-outline bg-white p-7 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Payment Channels</span>
                  <h3 className="text-xl font-bold text-on-surface">Select Payment Method</h3>
                </div>
                <span className="text-xs font-semibold text-on-surface-variant">1 Active Method</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Direct Bank Transfer (Available) */}
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod('bank_transfer', 'Direct Bank Transfer')}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    selectedMethod === 'bank_transfer'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-outline hover:border-primary/50'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                    <span className="material-symbols-outlined text-xl">account_balance</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <p className="font-bold text-xs text-on-surface">Direct Bank Transfer</p>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold uppercase text-green-700">Active</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium">
                      Official bank account transfer with manual receipt verification.
                    </p>
                  </div>
                </button>

                {/* Option 2: Debit / Credit Card (Currently unavailable) */}
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod('card', 'Debit / Credit Card')}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    selectedMethod === 'card'
                      ? 'border-amber-400 bg-amber-50/50 shadow-sm'
                      : 'border-outline/70 bg-surface-container/20 opacity-85 hover:border-outline'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">credit_card</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <p className="font-bold text-xs text-on-surface">Debit / Credit Card</p>
                      <span className="rounded-full bg-surface-container px-2 py-0.5 text-[9px] font-bold text-on-surface-variant">Currently unavailable</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium">
                      Mastercard, Visa & Verve online card gateway.
                    </p>
                  </div>
                </button>

                {/* Option 3: Paystack / Flutterwave Online (Currently unavailable) */}
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod('paystack', 'Paystack / Online Gateway')}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    selectedMethod === 'paystack'
                      ? 'border-amber-400 bg-amber-50/50 shadow-sm'
                      : 'border-outline/70 bg-surface-container/20 opacity-85 hover:border-outline'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <p className="font-bold text-xs text-on-surface">Paystack / Online</p>
                      <span className="rounded-full bg-surface-container px-2 py-0.5 text-[9px] font-bold text-on-surface-variant">Currently unavailable</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium">
                      Instant online checkout gateway integration.
                    </p>
                  </div>
                </button>

                {/* Option 4: USSD / Bank QR (Currently unavailable) */}
                <button
                  type="button"
                  onClick={() => handleSelectPaymentMethod('ussd', 'USSD & Bank QR')}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    selectedMethod === 'ussd'
                      ? 'border-amber-400 bg-amber-50/50 shadow-sm'
                      : 'border-outline/70 bg-surface-container/20 opacity-85 hover:border-outline'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
                    <span className="material-symbols-outlined text-xl">dialpad</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <p className="font-bold text-xs text-on-surface">USSD / Bank QR</p>
                      <span className="rounded-full bg-surface-container px-2 py-0.5 text-[9px] font-bold text-on-surface-variant">Currently unavailable</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium">
                      Fast bank USSD code dial and QR scanning.
                    </p>
                  </div>
                </button>
              </div>

              {/* Informative Unavailable Notice Banner */}
              {unavailableNotice && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-amber-600 text-lg">info</span>
                    <span>{unavailableNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('bank_transfer', 'Direct Bank Transfer')}
                    className="shrink-0 rounded-lg bg-amber-200/80 px-3 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-300 transition-colors"
                  >
                    Use Bank Transfer
                  </button>
                </motion.div>
              )}
            </div>

            <div className="rounded-3xl border border-outline bg-white p-7 shadow-sm">
              <div className="flex items-center justify-between border-b border-outline pb-6">
                <div>
                  <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-2">
                    Official Bank Transfer
                  </span>
                  <h2 className="text-2xl font-bold text-on-surface">Payment Instructions</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-on-surface-variant font-medium">Total Amount Due</p>
                  <p className="text-2xl font-black text-primary">{formatPrice(booking.totalAmount)}</p>
                </div>
              </div>

              {/* Unique Payment Reference Box */}
              <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Your Payment Reference</p>
                    <p className="mt-1 font-mono text-xl font-black text-on-surface tracking-wider">{paymentRef}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReference}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-primary-container"
                  >
                    <span className="material-symbols-outlined text-sm">{copiedRef ? 'check' : 'content_copy'}</span>
                    <span>{copiedRef ? 'Copied!' : 'Copy Reference'}</span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant font-medium">
                  ⚠️ <span className="font-semibold text-on-surface">Important:</span> Include this reference code as your transfer remark or narration for instant matching.
                </p>
              </div>

              {/* Bank Account Details Grid */}
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-outline bg-surface-container/30 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-outline/60">
                    <span className="text-xs font-bold text-on-surface-variant">Bank Name</span>
                    <span className="text-sm font-bold text-on-surface">{bankConfig.bankName}</span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b border-outline/60">
                    <span className="text-xs font-bold text-on-surface-variant">Account Name</span>
                    <span className="text-sm font-bold text-on-surface">{bankConfig.accountName}</span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b border-outline/60 flex-wrap gap-2">
                    <span className="text-xs font-bold text-on-surface-variant">Account Number</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-black text-primary tracking-wider">{bankConfig.accountNumber}</span>
                      <button
                        type="button"
                        onClick={handleCopyAccount}
                        className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                        title="Copy Account Number"
                      >
                        <span className="material-symbols-outlined text-base">{copied ? 'check' : 'content_copy'}</span>
                      </button>
                    </div>
                  </div>

                  {bankConfig.branchName && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-on-surface-variant">Branch</span>
                      <span className="text-xs font-semibold text-on-surface">{bankConfig.branchName}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-surface-container-lowest border border-outline p-5 text-xs font-medium text-on-surface-variant space-y-2">
                  <p className="font-bold text-on-surface text-sm">Payment Process:</p>
                  <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                    <li>Open your banking app or internet banking portal.</li>
                    <li>Transfer the exact total of <strong className="text-on-surface">{formatPrice(booking.totalAmount)}</strong> to the account above.</li>
                    <li>Set narration to <strong className="font-mono text-primary">{paymentRef}</strong>.</li>
                    <li>Take a screenshot or download the payment receipt.</li>
                    <li>Upload your receipt in the form on the right to complete verification.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Upload Proof & Booking Summary */}
          <div className="space-y-6">
            {/* Upload Proof Form Card */}
            <div className="rounded-3xl border border-outline bg-white p-7 shadow-sm">
              <h3 className="text-lg font-bold text-on-surface mb-2">Upload Proof of Payment</h3>
              <p className="text-xs text-on-surface-variant mb-6 font-medium">
                Upload your transfer receipt or bank transaction slip for verification.
              </p>

              {uploadError && (
                <div className="mb-4 rounded-xl border border-error/20 bg-error-container p-3.5 text-xs font-bold text-on-error-container">
                  {uploadError}
                </div>
              )}

              <form onSubmit={handleSubmitProof} className="space-y-5">
                {/* File Upload Drop Zone */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                    Payment Receipt (JPG, PNG, or PDF)
                  </label>
                  <label className="relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline bg-surface-container/20 p-6 text-center transition-all hover:border-primary hover:bg-primary/5">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                      onChange={handleFileSelect}
                      disabled={uploading || isPaid}
                      className="sr-only"
                    />
                    {proofFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-primary">description</span>
                        <p className="text-xs font-bold text-on-surface">{proofFile.name}</p>
                        <p className="text-[10px] text-on-surface-variant font-medium">
                          {(proofFile.size / 1024).toFixed(1)} KB — Click to change
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
                        <p className="text-xs font-bold text-on-surface">Click to select receipt or drop file here</p>
                        <p className="text-[10px] text-on-surface-variant font-medium">Supported: PNG, JPG, JPEG, PDF up to 5MB</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Customer Note */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                    Transaction Remarks / Bank Sender Name
                  </label>
                  <input
                    type="text"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="e.g. Sent from John Doe / Access Bank"
                    disabled={uploading || isPaid}
                    className="w-full rounded-xl border border-outline bg-surface-container px-4 py-3 text-xs font-medium text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading || !proofFile || isPaid}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      <span>{isUnderReview ? 'Update Payment Receipt' : 'Submit Proof of Transfer'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Booking Summary Card */}
            <div className="rounded-3xl border border-outline bg-white p-7 shadow-sm">
              <h4 className="text-sm font-bold uppercase tracking-wider text-on-surface mb-4">Trip Summary</h4>
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant font-medium">Service Category</dt>
                  <dd className="font-bold text-on-surface">{booking.serviceType || 'Transport Service'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant font-medium">Class / Package</dt>
                  <dd className="font-bold text-on-surface">{booking.vehicleClass}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant font-medium">Pickup Point</dt>
                  <dd className="font-bold text-on-surface text-right max-w-[200px] truncate">{booking.pickup}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant font-medium">Destination</dt>
                  <dd className="font-bold text-on-surface text-right max-w-[200px] truncate">{booking.destination}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant font-medium">Date & Time</dt>
                  <dd className="font-bold text-on-surface">{booking.date} at {booking.time}</dd>
                </div>
                {trackingId && (
                  <div className="flex justify-between border-t border-outline pt-3">
                    <dt className="text-primary font-bold">Live Tracking ID</dt>
                    <dd className="font-mono font-bold text-primary">{trackingId}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
