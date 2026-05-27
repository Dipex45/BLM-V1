import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, addDoc } from 'firebase/firestore';
import { useCurrency } from '../hooks/useCurrency';
import { logAudit, AuditAction } from '../lib/audit';
import RouteMap from '../components/RouteMap';
import { apiPost } from '../lib/api';
import { company } from '../lib/company';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; comment: string }>>({});

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bookings');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const stats = [
    { label: 'Active trips', val: bookings.filter(b => ['Paid', 'Confirmed', 'Dispatched', 'InTransit'].includes(b.status)).length.toString().padStart(2, '0'), icon: 'local_taxi', color: 'bg-primary/10 text-primary' },
    { label: 'Total bookings', val: bookings.length.toString().padStart(2, '0'), icon: 'book_online', color: 'bg-primary/10 text-primary' },
    { label: 'Completed trips', val: bookings.filter(b => b.status === 'Completed').length.toString().padStart(2, '0'), icon: 'task_alt', color: 'bg-primary/10 text-primary' },
    { label: 'Reviews sent', val: bookings.filter(b => b.reviewId).length.toString().padStart(2, '0'), icon: 'reviews', color: 'bg-primary/10 text-primary' },
  ];

  const updateReviewDraft = (bookingId: string, patch: Partial<{ rating: number; comment: string }>) => {
    setReviewDrafts(prev => ({
      ...prev,
      [bookingId]: { rating: 0, comment: '', ...(prev[bookingId] || {}), ...patch }
    }));
  };

  const submitReview = async (booking: any) => {
    const draft = reviewDrafts[booking.id];
    if (!draft?.rating || !draft.comment.trim() || submittingReview) return;

    setSubmittingReview(booking.id);
    try {
      const reviewDoc = await addDoc(collection(db, 'reviews'), {
        bookingId: booking.id,
        customerId: user?.uid,
        rating: draft.rating,
        comment: draft.comment.trim(),
        createdAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'bookings', booking.id), { reviewId: reviewDoc.id });
      await logAudit(user?.uid || 'sys', user?.email || 'unknown', AuditAction.UPDATE_BOOKING, {
        bookingId: booking.id,
        action: 'SUBMIT_REVIEW',
        reviewId: reviewDoc.id,
        rating: draft.rating
      });
    } catch (err) {
      console.error(err);
      alert('Review could not be submitted. Please try again.');
    } finally {
      setSubmittingReview(null);
    }
  };

  return (
    <div className="p-4 md:p-12 flex flex-col gap-8 md:gap-12 bg-background min-h-screen">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 border-b border-outline pb-8 md:pb-12 text-center md:text-left">
        <div className="flex flex-col items-center md:items-start">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-primary">Connected</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-sans font-bold leading-none mb-4">My dashboard.</h1>
          <p className="text-on-surface-variant font-semibold text-sm">
            Account ID: {user?.uid?.slice(-8).toUpperCase() || 'ANONYMOUS'} | Nigeria operations desk
          </p>
        </div>
        <div className="flex gap-4">
          <Link to="/booking" className="flex-1 md:flex-none text-center px-8 py-4 bg-primary text-white rounded-md font-bold text-sm hover:bg-primary-container transition-colors">
            Book transport
          </Link>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 md:p-8 rounded-lg border border-outline shadow-sm"
          >
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${stat.color} flex items-center justify-center mb-6 shadow-sm border border-outline/50`}>
              <span className="material-symbols-outlined text-xl md:text-2xl">{stat.icon}</span>
            </div>
            <h3 className="text-xs font-bold text-on-surface-variant mb-1 md:mb-2">{stat.label}</h3>
            <p className="text-2xl md:text-3xl font-bold">{stat.val}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        {/* Progress Visualization */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-outline p-8 md:p-10 shadow-sm flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm md:text-base">explore</span> 
                Active tracking
              </h3>
              {bookings.find(b => b.status === 'Dispatched') && (
                <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-widest border border-green-500/20 animate-pulse">Live Tracking</span>
              )}
            </div>
            
            <div className="flex-1 min-h-[300px]">
              {bookings.length > 0 ? (
                <RouteMap 
                  pickup={bookings[0].pickup} 
                  destination={bookings[0].destination} 
                  height="100%" 
                />
              ) : (
                <div className="w-full h-full bg-surface-container/30 rounded-lg flex flex-col items-center justify-center p-8 text-center border border-outline border-dashed">
                  <span className="material-symbols-outlined text-4xl text-outline mb-4">map</span>
                  <p className="text-sm text-on-surface-variant font-bold">No active delivery found</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-on-surface-variant mb-1">Last known pickup</p>
                <p className="text-sm font-bold">
                  {bookings.length > 0 ? bookings[0].pickup : 'No pickup yet'}
                </p>
              </div>
              <button 
                onClick={() => bookings.length > 0 && navigate(`/tracking?booking=${bookings[0].id}`)}
                className="px-5 py-2 bg-on-surface text-white text-sm font-bold rounded-md hover:bg-black transition-colors"
              >
                View tracking
              </button>
            </div>
        </div>

        <div className="bg-white rounded-lg flex flex-col border border-outline shadow-sm overflow-hidden h-[600px]">
          <div className="p-8 border-b border-outline bg-surface-container/30">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">history</span>
              Recent bookings
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {bookings.length === 0 ? (
               <div className="p-12 text-center">
                  <p className="text-sm text-on-surface-variant">No booking history yet.</p>
               </div>
            ) : bookings.slice(0, 10).map((booking, i) => (
              <div 
                key={booking.id} 
                onClick={() => navigate(`/tracking?booking=${booking.id}`)}
                className="p-8 border-b border-outline last:border-none flex items-center justify-between hover:bg-surface-container transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold text-primary font-mono">#{booking.id.slice(-6)}</span>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                      booking.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
                    } border border-outline/50`}>
                      {booking.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase truncate max-w-[150px]">{booking.destination}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold mb-1">{booking.date}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium">{booking.vehicleClass}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/tracking')} className="p-5 text-sm font-bold text-white bg-primary hover:bg-primary-container transition-colors">
            View tracking page
          </button>
        </div>
      </div>

      {/* Bookings */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-8">
           <h2 className="text-2xl font-bold text-on-surface">Bookings</h2>
           <button 
             onClick={() => navigate('/booking')} 
             className="px-6 py-3 bg-primary text-white text-sm font-bold rounded-md hover:bg-primary-container transition-colors"
           >
             New booking
           </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20 bg-white rounded-lg border border-outline">
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-20 text-center bg-white rounded-lg border border-outline">
             <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-outline text-4xl">local_shipping</span>
             </div>
             <p className="text-on-surface-variant font-semibold text-sm mb-8">No bookings yet.</p>
             <button onClick={() => navigate('/booking')} className="px-8 py-3 border-2 border-primary text-primary font-bold text-sm rounded-md hover:bg-primary hover:text-white transition-colors">
                Book your first trip
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            <AnimatePresence>
              {bookings.map((booking, idx) => (
                <motion.div 
                   key={booking.id}
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: idx * 0.05 }}
                   className="bg-white rounded-lg border border-outline p-8 shadow-sm hover:shadow-md transition-all group overflow-hidden relative"
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 -mr-12 -mt-12 transition-all group-hover:scale-110 pointer-events-none`}>
                     <span className="material-symbols-outlined text-8xl text-primary">receipt_long</span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      booking.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                      booking.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {booking.status}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface-variant font-mono uppercase tracking-widest">#{booking.id.slice(-6).toUpperCase()}</span>
                  </div>

                  {booking.status === 'Completed' && !booking.reviewId && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-2xl overflow-hidden"
                    >
                      <p className="text-xs font-bold text-primary mb-3">Rate this booking</p>
                      <div className="flex gap-2 mb-3">
                         {[1,2,3,4,5].map(star => (
                           <button 
                             key={star}
                             type="button"
                             onClick={() => updateReviewDraft(booking.id, { rating: star })}
                             className="text-primary hover:scale-125 transition-transform"
                             aria-label={`Rate ${star} out of 5`}
                           >
                             <span className="material-symbols-outlined text-sm">
                               {star <= (reviewDrafts[booking.id]?.rating || 0) ? 'star' : 'star_outline'}
                             </span>
                           </button>
                         ))}
                      </div>
                      <textarea
                        value={reviewDrafts[booking.id]?.comment || ''}
                        onChange={(event) => updateReviewDraft(booking.id, { comment: event.target.value })}
                        className="mb-3 min-h-20 w-full rounded-md border border-outline bg-white p-3 text-xs font-medium"
                        placeholder="Tell us how the trip went"
                        maxLength={500}
                      />
                      <button
                        type="button"
                        onClick={() => submitReview(booking)}
                        disabled={submittingReview === booking.id || !reviewDrafts[booking.id]?.rating || !reviewDrafts[booking.id]?.comment?.trim()}
                        className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {submittingReview === booking.id ? 'Submitting...' : 'Submit review'}
                      </button>
                    </motion.div>
                  )}

                  <div className="space-y-6 relative z-10">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div className="w-0.5 h-6 bg-outline" />
                        <div className="w-2 h-2 border-2 border-primary rounded-full" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-on-surface-variant mb-1">Route</p>
                        <p className="text-sm font-bold mb-2 truncate">{booking.pickup}</p>
                        <p className="text-sm font-bold truncate">{booking.destination}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-surface-container/50 rounded-lg border border-outline">
                       <div>
                         <p className="text-xs font-bold text-on-surface-variant mb-1">Date</p>
                         <p className="text-xs font-bold">{booking.date}</p>
                       </div>
                       <div>
                         <p className="text-xs font-bold text-on-surface-variant mb-1">Time</p>
                         <p className="text-xs font-bold">{booking.time}</p>
                       </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-outline flex items-center justify-between relative z-10">
                    <div>
                      <p className="text-xs font-bold text-on-surface-variant mb-1">Booking total</p>
                      <p className="text-lg font-bold text-on-surface">
                        {formatPrice(booking.totalAmount)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                       {booking.status === 'Quoted' && (
                         <button 
                           onClick={() => navigate(`/checkout/${booking.id}`)}
                           className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-110 transition-all"
                         >
                           <span className="material-symbols-outlined text-lg">payment</span>
                         </button>
                       )}
                       <button 
                         onClick={() => navigate(`/tracking?booking=${booking.id}`)}
                         className="w-10 h-10 bg-surface-container border border-outline text-on-surface rounded-xl flex items-center justify-center hover:bg-outline/10 transition-all"
                       >
                         <span className="material-symbols-outlined text-lg">near_me</span>
                       </button>
                       {(booking.status === 'Quoted' || booking.status === 'Booked') && (
                        <button 
                          onClick={async () => {
                            if (!window.confirm("Cancel this booking? This action cannot be undone and will trigger an automatic refund process if paid via Stripe.")) return;
                            try {
                              const isPaid = ['Booked', 'Paid'].includes(booking.status) && booking.paymentIntentId && booking.paymentProvider === 'stripe';
                              
                              if (isPaid) {
                                const refundRes = await apiPost('/api/payment/stripe/refund', {
                                  paymentIntentId: booking.paymentIntentId,
                                  bookingId: booking.id,
                                  reason: 'customer_cancellation'
                                });
                                
                                if (!refundRes.data?.success) throw new Error('Refund processing failed');
                                
                                alert("Refund process started.");
                              } else {
                                await apiPost('/api/bookings/cancel', {
                                  bookingId: booking.id,
                                  reason: 'customer_cancellation'
                                });
                              }

                              await logAudit(user?.uid || 'sys', user?.email || 'unknown', AuditAction.UPDATE_BOOKING, {
                                bookingId: booking.id,
                                action: 'USER_CANCEL',
                                wasRefunded: !!isPaid
                              });
                            } catch (err: any) {
                              console.error(err);
                              alert(`Cancellation error: ${err.message}`);
                            }
                          }}
                          title="Cancel Booking"
                          className="w-10 h-10 bg-red-50 border border-red-100 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all"
                        >
                          <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                       )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        <div className="bg-white rounded-lg border border-outline p-8 md:p-10 shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8">
            <span className="material-symbols-outlined text-outline text-4xl group-hover:text-primary/20 transition-all">shield_lock</span>
          </div>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-primary text-sm">security</span> 
            Account status
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container/30 border border-outline">
              <div>
                <p className="text-sm font-bold mb-1 text-on-surface">Email verification</p>
                <p className="text-xs text-on-surface-variant">{user?.emailVerified ? 'Verified and ready for bookings.' : 'Please verify your email before checkout.'}</p>
              </div>
              <span className={`material-symbols-outlined ${user?.emailVerified ? 'text-green-500' : 'text-primary'}`}>{user?.emailVerified ? 'check_circle' : 'mark_email_unread'}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container/30 border border-outline">
              <div>
                <p className="text-sm font-bold mb-1 text-on-surface">Support line</p>
                <a href={`tel:${company.phone}`} className="text-xs text-on-surface-variant hover:text-primary">{company.phoneDisplay}</a>
              </div>
              <span className="material-symbols-outlined text-primary">call</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-outline p-8 md:p-10 shadow-sm">
           <h3 className="font-bold text-sm flex items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-primary text-sm">manage_accounts</span> 
            Profile
          </h3>
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-surface-container border-2 border-outline rounded-lg flex items-center justify-center text-on-surface-variant text-4xl uppercase font-bold">
              {user?.email?.[0] || 'A'}
            </div>
            <div>
              <p className="text-xl font-bold text-on-surface">{user?.fullName || 'Customer'}</p>
              <p className="text-sm font-semibold text-on-surface-variant">Account type: {user?.role || 'Customer'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
