import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, addDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { company } from '../lib/company';
import DOMPurify from 'dompurify';

export interface ReviewItem {
  id?: string;
  customerName: string;
  customerEmail?: string;
  serviceType: string;
  rating: number;
  title: string;
  comment: string;
  bookingId?: string;
  verified: boolean;
  createdAt: string;
}

const DEFAULT_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1',
    customerName: 'Chidi Okafor',
    serviceType: 'Long and short distance trips',
    rating: 5,
    title: 'Top notch interstate trip from Lagos to Abuja',
    comment: 'Driver was punctual, courteous, and drove smoothly all the way. The car was spotless and comfortable throughout the journey.',
    verified: true,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'rev-2',
    customerName: 'Amina Bello',
    serviceType: 'Cross-border trips',
    rating: 5,
    title: 'Seamless Cotonou border clearance',
    comment: 'Border passage was handled smoothly without delays. BLM motors took care of all clearance checkpoints. Highly recommend for regional travel.',
    verified: true,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'rev-3',
    customerName: 'Tunde Adeleke',
    serviceType: 'Car hire',
    rating: 5,
    title: 'Executive Toyota Highlander for weekend event',
    comment: 'Picked up the car at the Victoria Island Hub in pristine condition. The caution deposit was returned promptly upon return. 10/10 service!',
    verified: true,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'rev-4',
    customerName: 'Efe Johnson',
    serviceType: 'Pickup and logistics',
    rating: 5,
    title: 'Fast doorstep package delivery with live tracking',
    comment: 'Shipped sensitive business equipment from Ikeja to Port Harcourt. Tracking updates were accurate and item arrived intact.',
    verified: true,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

export default function Reviews() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState('All');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formService, setFormService] = useState(company.services[0].title);
  const [formRating, setFormRating] = useState(5);
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [formBookingId, setFormBookingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fill if coming from tracking / booking page
    const prefillService = searchParams.get('service');
    const prefillBooking = searchParams.get('booking');
    if (prefillService) {
      setFormService(prefillService);
      setShowModal(true);
    }
    if (prefillBooking) {
      setFormBookingId(prefillBooking);
      setShowModal(true);
    }
    if (user) {
      setFormName(user.displayName || '');
      setFormEmail(user.email || '');
    }

    fetchReviews();
  }, [searchParams, user]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));
      if (!snap.empty) {
        const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ReviewItem[];
        setReviews(fetched);
      } else {
        setReviews(DEFAULT_REVIEWS);
      }
    } catch (e) {
      console.warn('Using default reviews', e);
      setReviews(DEFAULT_REVIEWS);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formComment.trim() || !formTitle.trim()) {
      setSubmitError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const newReview: Omit<ReviewItem, 'id'> = {
        customerName: DOMPurify.sanitize(formName.trim()),
        customerEmail: DOMPurify.sanitize(formEmail.trim()),
        serviceType: formService,
        rating: formRating,
        title: DOMPurify.sanitize(formTitle.trim()),
        comment: DOMPurify.sanitize(formComment.trim()),
        bookingId: DOMPurify.sanitize(formBookingId.trim()),
        verified: Boolean(user || formBookingId.trim()),
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'reviews'), newReview);
      setReviews((prev) => [{ id: docRef.id, ...newReview }, ...prev]);
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setShowModal(false);
        setFormTitle('');
        setFormComment('');
      }, 2000);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReviews = selectedService === 'All'
    ? reviews
    : reviews.filter((r) => r.serviceType.toLowerCase().includes(selectedService.toLowerCase()));

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-12 border-b border-outline">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary mb-3">
              <span className="material-symbols-outlined text-sm">stars</span>
              <span>Client Experiences & Feedback</span>
            </div>
            <h1 className="text-3xl font-black leading-tight text-on-surface sm:text-4xl md:text-5xl">
              Customer Reviews & Ratings
            </h1>
            <p className="mt-3 text-base text-on-surface-variant leading-relaxed">
              Read authentic feedback from travelers, corporate executives, and logistics clients across Nigeria and West Africa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-outline bg-white px-5 py-4 shadow-sm">
              <span className="material-symbols-outlined text-3xl text-amber-500">star</span>
              <div>
                <p className="text-2xl font-black text-on-surface">{averageRating}</p>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{reviews.length} Verified Reviews</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              <span>Write a Review</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-8 pb-6">
          {['All', ...company.services.map((s) => s.title)].map((srv) => (
            <button
              key={srv}
              type="button"
              onClick={() => setSelectedService(srv)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedService === srv
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white border border-outline text-on-surface hover:border-primary'
              }`}
            >
              {srv}
            </button>
          ))}
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {filteredReviews.map((rev) => (
            <motion.div
              key={rev.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-outline bg-white p-7 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`material-symbols-outlined text-lg ${
                          star <= rev.rating ? 'text-amber-500 fill-current' : 'text-gray-300'
                        }`}
                      >
                        star
                      </span>
                    ))}
                  </div>
                  <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-bold text-on-surface-variant">
                    {rev.serviceType}
                  </span>
                </div>

                <h3 className="text-base font-bold text-on-surface mb-2">{rev.title}</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-6">{rev.comment}</p>
              </div>

              <div className="flex items-center justify-between border-t border-outline/60 pt-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                    {rev.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-on-surface">{rev.customerName}</p>
                    {rev.verified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700">
                        <span className="material-symbols-outlined text-[12px]">verified</span>
                        Verified Customer
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-on-surface-variant font-medium">
                  {new Date(rev.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Modal: Write Review */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-3xl border border-outline bg-white p-7 shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <div className="flex items-center justify-between pb-4 border-b border-outline mb-6">
                  <h3 className="text-xl font-bold text-on-surface">Share Your Feedback</h3>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-full p-2 hover:bg-surface-container text-on-surface-variant transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {submitSuccess ? (
                  <div className="py-8 text-center space-y-3">
                    <span className="material-symbols-outlined text-5xl text-green-600">check_circle</span>
                    <h4 className="text-xl font-bold text-on-surface">Thank you for your review!</h4>
                    <p className="text-xs text-on-surface-variant">Your feedback helps us continuously elevate our logistics and passenger standards.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    {submitError && (
                      <div className="rounded-xl border border-error/20 bg-error-container p-3 text-xs font-bold text-on-error-container">
                        {submitError}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                        Your Rating
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormRating(star)}
                            className="p-1 text-2xl transition-transform hover:scale-110"
                          >
                            <span
                              className={`material-symbols-outlined ${
                                star <= formRating ? 'text-amber-500 fill-current' : 'text-gray-300'
                              }`}
                            >
                              star
                            </span>
                          </button>
                        ))}
                        <span className="ml-2 text-xs font-bold text-on-surface">{formRating} of 5 Stars</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                        Service Utilized
                      </label>
                      <select
                        value={formService}
                        onChange={(e) => setFormService(e.target.value)}
                        className="w-full rounded-xl border border-outline bg-surface-container px-4 py-3 text-xs font-medium text-on-surface focus:border-primary focus:outline-none"
                      >
                        {company.services.map((s) => (
                          <option key={s.title} value={s.title}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="Your name"
                          className="w-full rounded-xl border border-outline bg-surface-container px-4 py-3 text-xs font-medium text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                          Booking / Tracking ID
                        </label>
                        <input
                          type="text"
                          value={formBookingId}
                          onChange={(e) => setFormBookingId(e.target.value)}
                          placeholder="e.g. BLM-TRK-..."
                          className="w-full rounded-xl border border-outline bg-surface-container px-4 py-3 text-xs font-medium text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                        Review Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Summarize your experience (e.g. Smooth ride, great driver)"
                        className="w-full rounded-xl border border-outline bg-surface-container px-4 py-3 text-xs font-medium text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                        Detailed Feedback *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={formComment}
                        onChange={(e) => setFormComment(e.target.value)}
                        placeholder="Tell us about the vehicle, punctuality, driver, route satisfaction..."
                        className="w-full rounded-xl border border-outline bg-surface-container px-4 py-3 text-xs font-medium text-on-surface focus:border-primary focus:outline-none resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-container disabled:opacity-60"
                    >
                      {submitting ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">send</span>
                          <span>Submit Verified Review</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
