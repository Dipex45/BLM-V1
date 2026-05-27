import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import DOMPurify from 'dompurify';
import { logAudit, AuditAction } from '../lib/audit';

import { useCurrency } from '../hooks/useCurrency';
import { BookingSchema } from '../lib/schemas';

export default function Booking() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    pickup: '',
    destination: '',
    date: '',
    time: '',
    vehicleClass: '',
    isReturn: false,
    isRecurring: false,
    recurringFrequency: 'None' as 'None' | 'Weekly' | 'Monthly',
    notes: ''
  });

  const loadData = async () => {
    setInitialLoading(true);
    setError(null);
    try {
      // Load Vehicles/Prices
      const settingsPath = 'settings/vehicle_types';
      let settingsSnap;
      try {
        settingsSnap = await getDoc(doc(db, 'settings', 'vehicle_types'));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, settingsPath);
      }

      if (settingsSnap && settingsSnap.exists()) {
        const vData = settingsSnap.data().value;
        setVehicles(vData);
        if (vData.length > 0) {
          setFormData(prev => ({ ...prev, vehicleClass: vData[0].title }));
        }
      } else {
        const defaults = [
          { title: 'Economy', desc: 'Standard logistics transit.', price: 120, icon: 'local_shipping' },
          { title: 'Business', desc: 'High-priority transit.', price: 350, icon: 'bolt' },
          { title: 'Cross-Border Bus', desc: 'International transit.', price: 85, icon: 'directions_bus' },
        ];
        setVehicles(defaults);
        setFormData(prev => ({ ...prev, vehicleClass: 'Economy' }));
      }

      // Load Hubs
      const hubsPath = 'hubs';
      let hubsSnap;
      try {
        hubsSnap = await getDocs(collection(db, 'hubs'));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, hubsPath);
      }

      const hData = hubsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHubs(hData);
      if (hData.length > 0) {
        setFormData(prev => ({ ...prev, pickup: hData[0].name, destination: hData[1]?.name || hData[0].name }));
      }

      // Load Blocked Dates
      const blockedSnap = await getDocs(collection(db, 'blocked_dates'));
      setBlockedDates(blockedSnap.docs.map(d => d.data().date));
    } catch (err: any) {
      console.error("Error loading booking data:", err);
      if (err.message.includes('the client is offline')) {
        setError("Network connection issue detected. Please check if Firebase is correctly provisioned or your internet connection.");
      } else {
        setError("Failed to load transport data. Please try again.");
      }
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (blockedDates.includes(formData.date)) {
      setBookingError("Selected date is currently unavailable. Please choose another date.");
      return;
    }

    setLoading(true);
    try {
      const selectedVehicle = vehicles.find(v => v.title === formData.vehicleClass);
      const basePrice = selectedVehicle?.price || 0;
      const totalAmount = (formData.isReturn ? basePrice * 2 : basePrice) + 45;

      const bookingPayload = {
        pickup: formData.pickup.trim(),
        destination: formData.destination.trim(),
        vehicleClass: formData.vehicleClass,
        date: formData.date,
        time: formData.time,
        totalAmount: totalAmount,
        isReturn: formData.isReturn,
        notes: formData.notes
      };

      // Server-side validation call
      const validationRes = await fetch('/api/validate-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload)
      });

      if (!validationRes.ok) {
        const errorData = await validationRes.json();
        throw new Error(errorData.message || "Server-side validation failed.");
      }

      // If validated, proceed with Firestore write
      const rawData = {
        customerId: user.uid,
        customerName: DOMPurify.sanitize(user.displayName || user.email || 'Customer'),
        customerEmail: DOMPurify.sanitize(user.email || 'noreply@blmmotors.com'),
        pickup: DOMPurify.sanitize(formData.pickup.trim()),
        destination: DOMPurify.sanitize(formData.destination.trim()),
        vehicleClass: DOMPurify.sanitize(formData.vehicleClass),
        date: formData.date,
        time: formData.time,
        totalAmount,
        isReturn: formData.isReturn,
        isRecurring: formData.isRecurring,
        recurringFrequency: formData.recurringFrequency,
        notes: DOMPurify.sanitize(formData.notes),
        status: 'Quoted',
        createdAt: new Date().toISOString()
      };

      // Validate schema client-side as well
      const validatedData = BookingSchema.parse(rawData);

      const docRef = await addDoc(collection(db, 'bookings'), validatedData);
      
      // Audit Log
      await logAudit(user.uid, user.email || 'unknown', AuditAction.CREATE_BOOKING, {
        bookingId: docRef.id,
        pickup: rawData.pickup,
        destination: rawData.destination,
        amount: rawData.totalAmount
      });

      navigate(`/checkout/${docRef.id}`);
    } catch (err: any) {
      console.error("Booking failed:", err);
      if (err.name === 'ZodError') {
        setBookingError(err.errors[0].message);
      } else {
        setBookingError(err.message || "We could not confirm this booking. Please review the details and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return (
    <div className="h-[calc(100vh-160px)] flex flex-col items-center justify-center gap-6">
       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
       <p className="text-sm font-bold text-on-surface-variant animate-pulse">Checking fleet availability...</p>
    </div>
  );

  if (error) return (
    <div className="h-[calc(100vh-160px)] flex flex-col items-center justify-center gap-8 p-8 text-center">
       <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl">cloud_off</span>
       </div>
       <div className="max-w-md">
          <h2 className="text-3xl font-bold mb-4">Connection issue</h2>
          <p className="text-on-surface-variant font-medium leading-relaxed mb-8">{error}</p>
          <button 
            onClick={loadData}
            className="px-10 py-4 bg-primary text-white font-bold rounded-xl uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:scale-105 transition-all"
          >
            Try again
          </button>
       </div>
    </div>
  );

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto flex flex-col gap-12 bg-background">
      <header className="border-b border-outline pb-10 text-center md:text-left flex flex-col items-center md:items-start">
        <h1 className="text-4xl md:text-5xl font-display font-bold leading-none mb-4">Book transport.</h1>
        <p className="text-on-surface-variant max-w-2xl font-medium text-sm leading-relaxed mx-auto md:mx-0">
          Schedule your transport or delivery through our reliable network. 
          Choose a vehicle class below to get started.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        <form onSubmit={handleBooking} className="space-y-10 bg-white p-6 md:p-10 rounded-lg border border-outline shadow-sm relative overflow-hidden">
            {bookingError && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                role="alert"
                aria-live="assertive"
                className="p-4 bg-red-50 border border-red-100 rounded-md flex items-center gap-3 text-red-600 text-xs font-bold relative z-20"
              >
                <span className="material-symbols-outlined text-lg">error</span>
                {bookingError}
              </motion.div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div>
                <label htmlFor="pickup" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Pickup Location</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-link text-lg">location_on</span>
                  <select 
                    id="pickup"
                    required
                    aria-required="true"
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface-container border border-outline focus:ring-2 focus:ring-primary/20 text-sm font-medium appearance-none"
                    value={formData.pickup}
                    onChange={(e) => setFormData({...formData, pickup: e.target.value})}
                  >
                    {hubs.map(h => (
                      <option key={h.id} value={h.name}>{h.name}</option>
                    ))}
                    {hubs.length === 0 && <option value="">Loading Hubs...</option>}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="destination" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Destination</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-link text-lg">near_me</span>
                  <select 
                    id="destination"
                    required
                    aria-required="true"
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface-container border border-outline focus:ring-2 focus:ring-primary/20 text-sm font-medium appearance-none"
                    value={formData.destination}
                    onChange={(e) => setFormData({...formData, destination: e.target.value})}
                  >
                    {hubs.map(h => (
                      <option key={h.id} value={h.name}>{h.name}</option>
                    ))}
                    {hubs.length === 0 && <option value="">Loading Hubs...</option>}
                  </select>
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div>
                <label htmlFor="date" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Date</label>
                <input 
                  id="date"
                  type="date" 
                  required
                  aria-required="true"
                  className="w-full px-4 py-4 rounded-xl bg-surface-container border border-outline focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div>
                <label htmlFor="time" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Time</label>
                <input 
                  id="time"
                  type="time" 
                  required
                  aria-required="true"
                  className="w-full px-4 py-4 rounded-xl bg-surface-container border border-outline focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                />
              </div>
           </div>

           <div className="relative z-10 p-6 bg-surface-container/50 border border-outline rounded-2xl mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Return Journey?</h4>
                  <p className="text-xs text-on-surface-variant">Add the return leg to this booking.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, isReturn: !formData.isReturn})}
                  className={`w-14 h-8 rounded-full p-1 transition-all ${formData.isReturn ? 'bg-primary' : 'bg-outline'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full transition-transform ${formData.isReturn ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Recurring booking?</h4>
                  <p className="text-xs text-on-surface-variant">Repeat this booking weekly or monthly.</p>
                </div>
                <div className="flex items-center gap-4">
                   {formData.isRecurring && (
                     <select 
                       className="bg-surface-container border border-outline rounded-lg p-2 text-[10px] font-bold uppercase"
                       value={formData.recurringFrequency}
                       onChange={(e) => setFormData({...formData, recurringFrequency: e.target.value as any})}
                     >
                       <option value="Weekly">Weekly</option>
                       <option value="Monthly">Monthly</option>
                     </select>
                   )}
                   <button 
                     type="button"
                     onClick={() => setFormData({...formData, isRecurring: !formData.isRecurring, recurringFrequency: !formData.isRecurring ? 'Weekly' : 'None'})}
                     className={`w-14 h-8 rounded-full p-1 transition-all ${formData.isRecurring ? 'bg-primary' : 'bg-outline'}`}
                   >
                     <div className={`w-6 h-6 bg-white rounded-full transition-transform ${formData.isRecurring ? 'translate-x-6' : 'translate-x-0'}`} />
                   </button>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Trip notes</label>
                <textarea 
                  className="w-full bg-surface-container border border-outline rounded-xl p-4 text-xs font-medium focus:ring-2 focus:ring-primary/20"
                  placeholder="Special handling instructions, gate codes, etc."
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
           </div>

           <div className="relative z-10" role="radiogroup" aria-labelledby="vehicle-type-label">
              <label id="vehicle-type-label" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Select Vehicle Type</label>
              <div className="grid grid-cols-1 gap-4">
                {vehicles.map((v) => (
                  <label key={v.title} className={`group cursor-pointer flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${
                    formData.vehicleClass === v.title 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-outline bg-white hover:border-primary/40'
                  }`}>
                    <div className="flex items-center gap-6">
                       <input 
                         type="radio" 
                         name="vehicle" 
                         className="sr-only" 
                         aria-checked={formData.vehicleClass === v.title}
                         checked={formData.vehicleClass === v.title}
                         onChange={() => setFormData({...formData, vehicleClass: v.title})}
                       />
                       <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                         formData.vehicleClass === v.title ? 'bg-primary text-white shadow-lg' : 'bg-surface-container text-on-surface-variant group-hover:text-primary border border-outline'
                       }`}>
                         <span className="material-symbols-outlined text-2xl">{v.icon}</span>
                       </div>
                       <div>
                         <p className="font-bold text-base">{v.title}</p>
                         <p className="text-xs text-on-surface-variant mt-1 font-medium">{v.desc}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-bold text-primary">{formatPrice(v.price)}</p>
                       <p className="text-[10px] font-bold text-on-surface-variant mt-1 uppercase">Starting at</p>
                    </div>
                  </label>
                ))}
              </div>
           </div>

           <button 
             type="submit" 
             disabled={loading}
             aria-busy={loading}
             className={`w-full py-5 ${loading ? 'bg-neutral-800' : 'bg-primary'} text-white font-bold rounded-xl shadow-xl shadow-primary/20 hover:bg-primary-container hover:text-on-primary transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest`}
           >
             {loading ? (
               <>
                 <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                 Confirming booking...
               </>
             ) : (
               <>
                 Confirm Booking
                 <span className="material-symbols-outlined text-lg">arrow_forward</span>
               </>
             )}
           </button>
        </form>

        <div className="space-y-8">
           <div className="bg-white rounded-lg p-6 md:p-10 border border-outline shadow-sm relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-8">Booking Summary</h3>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl font-bold text-on-surface">
                    {formatPrice(vehicles.find(v => v.title === formData.vehicleClass)?.price || 0)}
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium border-b border-outline pb-4">
                    <span className="text-on-surface-variant">Service Fee</span>
                    <span>{formatPrice(45)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium border-b border-outline pb-4">
                    <span className="text-on-surface-variant">Insurance</span>
                    <span className="text-primary font-bold italic">Included</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold pt-4 text-on-surface">
                    <span>Total Amount</span>
                    <span className="text-primary text-2xl">
                      {formatPrice((formData.isReturn ? (vehicles.find(v => v.title === formData.vehicleClass)?.price || 0) * 2 : (vehicles.find(v => v.title === formData.vehicleClass)?.price || 0)) + 45)}
                    </span>
                  </div>
                </div>
              </div>
           </div>

           <div className="p-8 bg-white rounded-lg border border-outline flex items-center gap-6 shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                 <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
              <div>
                 <p className="text-sm font-bold text-on-surface">Secure Checkout</p>
                 <p className="text-xs text-on-surface-variant mt-1">Your booking and payment details are handled securely.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
