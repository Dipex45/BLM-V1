import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import DOMPurify from 'dompurify';
import { logAudit, AuditAction } from '../lib/audit';
import { useCurrency } from '../hooks/useCurrency';
import { BookingSchema } from '../lib/schemas';
import { company, defaultVehicles } from '../lib/company';

export default function Booking() {
  const { user } = useAuth();
  const { formatPrice, displayCurrency } = useCurrency();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [touringStatesList, setTouringStatesList] = useState<any[]>(company.touringStates || []);
  const [internationalTourList, setInternationalTourList] = useState<any[]>(company.internationalTours || []);
  const [carHireOptionsState, setCarHireOptionsState] = useState<any[]>(company.carHireOptions || []);
  const [pricingRules, setPricingRules] = useState(company.pricingRules);
  const [formData, setFormData] = useState({
    pickup: '',
    destination: '',
    date: '',
    time: '',
    vehicleClass: '',
    serviceType: 'Economy',
    touringSpots: 1,
    touringState: 'Lagos',
    internationalCountry: 'Benin Republic',
    logisticsDetails: '',
    packageWeightKg: 1,
    carHireVehicle: 'toyota-corolla',
    carConsent: false,
    isReturn: false,
    isRecurring: false,
    recurringFrequency: 'None' as 'None' | 'Weekly' | 'Monthly',
    notes: ''
  });

  const [searchParams] = useSearchParams();

  const normalizedVehicleSelection = (formData.vehicleClass || '').toLowerCase();
  const isPickupLogistics = normalizedVehicleSelection.includes('pickup') || normalizedVehicleSelection.includes('logistics');
  const isCarHire = normalizedVehicleSelection.includes('car hire');
  const isInternationalTour = normalizedVehicleSelection.includes('international');
  const isTouringService = normalizedVehicleSelection.includes('touring') && !isInternationalTour;

  const loadData = async () => {
    setInitialLoading(true);
    setError(null);
    try {
      // Load Vehicles/Prices
      let availableVehicles = defaultVehicles;
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'vehicle_types'));
        if (settingsSnap.exists() && Array.isArray(settingsSnap.data().value) && settingsSnap.data().value.length > 0) {
          availableVehicles = settingsSnap.data().value;
        }
      } catch (err) {
        console.warn('Unable to load vehicle types from settings', err);
      }

      setVehicles(availableVehicles);

      const requestedService = searchParams.get('service') || searchParams.get('vehicle');
      let selectedClass = availableVehicles[0]?.title || 'Economy';
      if (requestedService) {
        const target = requestedService.toLowerCase();
        const match = availableVehicles.find((v: any) => 
          v.title.toLowerCase().includes(target) || target.includes(v.title.toLowerCase())
        );
        if (match) {
          selectedClass = match.title;
        }
      }

      setFormData(prev => ({ ...prev, vehicleClass: selectedClass, serviceType: selectedClass }));

      // Load Touring States
      try {
        const touringSnap = await getDoc(doc(db, 'settings', 'touring_states'));
        if (touringSnap.exists()) {
          setTouringStatesList(touringSnap.data().value || company.touringStates);
        } else {
          setTouringStatesList(company.touringStates);
        }
      } catch (err) {
        console.warn('Unable to load touring states settings', err);
        setTouringStatesList(company.touringStates);
      }

      // Load International Tours
      try {
        const internationalSnap = await getDoc(doc(db, 'settings', 'international_tours'));
        if (internationalSnap.exists()) {
          setInternationalTourList(internationalSnap.data().value || company.internationalTours);
        } else {
          setInternationalTourList(company.internationalTours);
        }
      } catch (err) {
        console.warn('Unable to load international tour settings', err);
        setInternationalTourList(company.internationalTours);
      }

      // Load Car Hire Options
      try {
        const carHireSnap = await getDoc(doc(db, 'settings', 'car_hire_options'));
        if (carHireSnap.exists()) {
          setCarHireOptionsState(carHireSnap.data().value || company.carHireOptions);
        } else {
          setCarHireOptionsState(company.carHireOptions);
        }
      } catch (err) {
        console.warn('Unable to load car hire options settings', err);
        setCarHireOptionsState(company.carHireOptions);
      }

      // Load Pricing Rules
      try {
        const pricingRulesSnap = await getDoc(doc(db, 'settings', 'pricing_rules'));
        if (pricingRulesSnap.exists()) {
          setPricingRules({ ...company.pricingRules, ...(pricingRulesSnap.data().value || {}) });
        } else {
          setPricingRules(company.pricingRules);
        }
      } catch (err) {
        console.warn('Unable to load pricing rules settings', err);
        setPricingRules(company.pricingRules);
      }

      // Load Hubs
      let resolvedHubs = company.hubs.map((hub, index) => ({ id: `default-${index}`, ...hub }));
      try {
        const hubsSnap = await getDocs(collection(db, 'hubs'));
        const hData = hubsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (hData.length > 0) resolvedHubs = hData;
      } catch (err) {
        console.warn('Unable to load hubs', err);
      }

      setHubs(resolvedHubs);
      if (resolvedHubs.length > 0) {
        setFormData(prev => ({ ...prev, pickup: resolvedHubs[0].name, destination: resolvedHubs[1]?.name || resolvedHubs[0].name }));
      }

      // Load Blocked Dates
      try {
        const blockedSnap = await getDocs(collection(db, 'blocked_dates'));
        setBlockedDates(blockedSnap.docs.map(d => d.data().date));
      } catch (err) {
        console.warn('Unable to load blocked dates', err);
      }
    } catch (err: any) {
      console.error("Error loading booking data:", err);
      setError("Failed to load transport data. Please try again.");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateBookingQuote = () => {
    const selectedVehicle = vehicles.find(v => v.title === formData.vehicleClass);
    const basePrice = Number(selectedVehicle?.price || 0);
    const normalizedClass = (formData.vehicleClass || '').toLowerCase();
    const isPickupLogisticsQuote = normalizedClass.includes('pickup') || normalizedClass.includes('logistics');
    const isCarHireQuote = normalizedClass.includes('car hire');
    const isInternationalTourQuote = normalizedClass.includes('international');
    const isTouringQuote = normalizedClass.includes('touring') && !isInternationalTourQuote;
    const routeFactor = Number(pricingRules.defaultRouteFactor || 1);
    const returnMultiplier = formData.isReturn ? Number(pricingRules.returnMultiplier || 2) : 1;
    const spots = Math.min(
      Math.max(Number(formData.touringSpots) || 1, 1),
      Number(pricingRules.maxTouringLocations || 20)
    );
    const touringStateFactor = touringStatesList.find((state) => state.name === formData.touringState)?.factor || 1;
    const internationalTourFactor = internationalTourList.find((country) => country.name === formData.internationalCountry)?.factor || 1;

    let variableFee = Number(pricingRules.standardServiceFee || 0);
    let variableFeeLabel = 'Service fee';

    if (isInternationalTourQuote) {
      variableFee = Math.round(spots * Number(pricingRules.internationalTourPerLocation || 0) * internationalTourFactor);
      variableFeeLabel = `${spots} international tour location${spots === 1 ? '' : 's'}`;
    } else if (isTouringQuote) {
      variableFee = Math.round(spots * Number(pricingRules.touringPerLocation || 0) * touringStateFactor);
      variableFeeLabel = `${spots} touring location${spots === 1 ? '' : 's'}`;
    } else if (isPickupLogisticsQuote) {
      const weightKg = Math.max(Number(formData.packageWeightKg) || 1, 1);
      variableFee = Number(pricingRules.pickupLogisticsFee || 0) + Math.round(weightKg * Number(pricingRules.pricePerKg || 0));
      variableFeeLabel = `Pickup handling + ${weightKg}kg cargo`;
    } else if (isCarHireQuote) {
      variableFee = Number(pricingRules.carHireCautionFee || 0);
      variableFeeLabel = 'Car hire caution fee';
    } else if (normalizedClass.includes('cross-border transit')) {
      variableFee = Number(pricingRules.crossBorderProcessingFee || 0);
      variableFeeLabel = 'Cross-border processing';
    }

    return {
      basePrice,
      routeFactor,
      returnMultiplier,
      variableFee,
      variableFeeLabel,
      totalAmount: Math.round((basePrice * returnMultiplier * routeFactor) + variableFee),
    };
  };

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
      const normalizedClass = (formData.vehicleClass || '').toLowerCase();
      const isPickupLogistics = normalizedClass.includes('pickup') || normalizedClass.includes('logistics');
      const isCarHire = normalizedClass.includes('car hire');
      const quote = calculateBookingQuote();

      if (isPickupLogistics && !formData.logisticsDetails.trim()) {
        setBookingError('Please describe the package contents or logistics details so we can serve you safely.');
        setLoading(false);
        return;
      }

      if (isCarHire && !formData.carConsent) {
        setBookingError('To book a car hire service you must agree to the consent terms and caution fee policy.');
        setLoading(false);
        return;
      }

      const totalAmount = quote.totalAmount;

      const bookingPayload = {
        pickup: formData.pickup.trim(),
        destination: formData.destination.trim(),
        vehicleClass: formData.vehicleClass,
        date: formData.date,
        time: formData.time,
        totalAmount,
        isReturn: formData.isReturn,
        notes: formData.notes,
        serviceType: formData.vehicleClass,
        touringSpots: formData.touringSpots,
        touringState: formData.touringState,
        internationalCountry: formData.internationalCountry,
        logisticsDetails: formData.logisticsDetails,
        packageWeightKg: formData.packageWeightKg,
        carHireVehicle: formData.carHireVehicle,
      };

      // Server-side validation call
      const validationRes = await fetch('/api/validate-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload)
      });

      if (!validationRes.ok) {
        const responseText = await validationRes.text();
        let errorMessage = "Server-side validation failed.";
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData?.message || errorData?.error || responseText || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
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
        currency: 'NGN',
        displayCurrency,
        isReturn: formData.isReturn,
        isRecurring: formData.isRecurring,
        recurringFrequency: formData.recurringFrequency,
        notes: DOMPurify.sanitize(formData.notes),
        status: 'Quoted',
        serviceType: formData.vehicleClass,
        touringSpots: formData.touringSpots,
        touringState: formData.touringState,
        internationalCountry: formData.internationalCountry,
        logisticsDetails: DOMPurify.sanitize(formData.logisticsDetails),
        packageWeightKg: formData.packageWeightKg,
        carHireVehicle: formData.carHireVehicle,
        pricingSnapshot: {
          basePrice: quote.basePrice,
          routeFactor: quote.routeFactor,
          returnMultiplier: quote.returnMultiplier,
          variableFee: quote.variableFee,
          variableFeeLabel: quote.variableFeeLabel,
          pricingRules,
        },
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

      navigate(`/checkout/${encodeURIComponent(docRef.id)}`);
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

  const quote = calculateBookingQuote();

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto flex flex-col gap-12 bg-background">
      <header className="border-b border-outline pb-10 text-center md:text-left flex flex-col items-center md:items-start">
        <h1 className="text-4xl md:text-5xl font-display font-bold leading-none mb-4">Book BLM Motors.</h1>
        <p className="text-on-surface-variant max-w-2xl font-medium text-sm leading-relaxed mx-auto md:mx-0">
          Schedule transport, touring, car hire, pickup, interstate movement, or cross-border trips from Nigeria.
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
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Return journey?</h4>
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
                  placeholder="Pickup notes, border route, touring stops, luggage, parcel details, etc."
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
                  <label key={v.title} className={`group cursor-pointer flex flex-col gap-5 p-6 rounded-2xl border-2 transition-all sm:flex-row sm:items-center sm:justify-between ${
                    formData.vehicleClass === v.title 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-outline bg-white hover:border-primary/40'
                  }`}>
                    <div className="flex min-w-0 items-center gap-6">
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
                       <div className="min-w-0">
                         <p className="font-bold text-base">{v.title}</p>
                         <p className="safe-text text-xs text-on-surface-variant mt-1 font-medium">{v.desc}</p>
                       </div>
                    </div>
                    <div className="w-full text-left sm:w-auto sm:text-right">
                       <p className="text-2xl font-bold text-primary">{formatPrice(v.price)}</p>
                       <p className="text-[10px] font-bold text-on-surface-variant mt-1 uppercase">Starting at</p>
                    </div>
                  </label>
                ))}
              </div>
           </div>

           {(isTouringService || isInternationalTour) && (
             <div className="space-y-6 rounded-2xl border border-outline bg-surface-container px-6 py-6">
               <div className="grid gap-6 md:grid-cols-2">
                 {isTouringService && (
                   <div>
                     <label htmlFor="touringState" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Touring state</label>
                     <select
                       id="touringState"
                       className="w-full rounded-xl border border-outline bg-white px-4 py-4 text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                       value={formData.touringState}
                       onChange={(e) => setFormData({ ...formData, touringState: e.target.value })}
                     >
                       {touringStatesList.map((state) => (
                         <option key={state.name} value={state.name}>{state.name}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 {isInternationalTour && (
                   <div>
                     <label htmlFor="internationalCountry" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">International tour</label>
                     <select
                       id="internationalCountry"
                       className="w-full rounded-xl border border-outline bg-white px-4 py-4 text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                       value={formData.internationalCountry}
                       onChange={(e) => setFormData({ ...formData, internationalCountry: e.target.value })}
                     >
                       {internationalTourList.map((country) => (
                         <option key={country.name} value={country.name}>{country.name}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 <div>
                   <label htmlFor="touringSpots" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Number of locations</label>
                   <input
                     id="touringSpots"
                     type="number"
                     min={1}
                     max={pricingRules.maxTouringLocations}
                     value={formData.touringSpots}
                     onChange={(e) => setFormData({
                       ...formData,
                       touringSpots: Math.min(
                         Math.max(Number(e.target.value) || 1, 1),
                         Number(pricingRules.maxTouringLocations || 20),
                       ),
                     })}
                     className="w-full rounded-xl border border-outline bg-white px-4 py-4 text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                   />
                 </div>
               </div>
               <p className="text-xs text-on-surface-variant">
                 Touring pricing is calculated by the number of locations and route complexity. Lagos is the most affordable state, and farther routes adjust automatically.
               </p>
             </div>
           )}

           {isPickupLogistics && (
             <div className="space-y-4 rounded-2xl border border-outline bg-surface-container px-6 py-6">
               <div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Pickup & logistics details</p>
                 <p className="text-sm text-on-surface-variant">Describe pickup location, drop-off point, package contents, and any special handling notes.</p>
               </div>
               <div>
                 <label htmlFor="packageWeightKg" className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                   Declared weight (kg)
                 </label>
                 <input
                   id="packageWeightKg"
                   type="number"
                   min={1}
                   max={10000}
                   value={formData.packageWeightKg}
                   onChange={(e) => setFormData({ ...formData, packageWeightKg: Math.max(Number(e.target.value) || 1, 1) })}
                   className="w-full rounded-xl border border-outline bg-white px-4 py-4 text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                 />
                 <p className="mt-2 text-xs text-on-surface-variant">
                   Weight is calculated at {formatPrice(pricingRules.pricePerKg || 0)} per kg.
                 </p>
               </div>
               <textarea
                 rows={4}
                 value={formData.logisticsDetails}
                 onChange={(e) => setFormData({ ...formData, logisticsDetails: e.target.value })}
                 className="w-full rounded-xl border border-outline bg-white px-4 py-4 text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20"
                 placeholder="Package description and drop-off instructions"
               />
               <p className="text-xs text-on-surface-variant">
                 BLM Motors does not carry illegal or prohibited materials. We reserve the right to verify package contents before dispatch.
               </p>
             </div>
           )}

           {isCarHire && (
             <div className="space-y-6 rounded-2xl border border-outline bg-surface-container px-6 py-6">
               <div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Car hire options</p>
                 <p className="text-sm text-on-surface-variant">Select the available car you want and agree to the caution fee consent terms.</p>
               </div>
               <div className="grid gap-4">
                 {carHireOptionsState.map((car) => (
                   <label key={car.id} className={`group flex items-center gap-4 rounded-2xl border p-4 transition-all ${formData.carHireVehicle === car.id ? 'border-primary bg-white shadow-sm' : 'border-outline bg-surface-container'}`}>
                     <input
                       type="radio"
                       name="carHireVehicle"
                       value={car.id}
                       checked={formData.carHireVehicle === car.id}
                       onChange={() => setFormData({ ...formData, carHireVehicle: car.id })}
                       className="h-4 w-4 text-primary"
                     />
                     <div className="flex-1">
                       <div className="flex items-center justify-between gap-4">
                         <p className="font-bold text-on-surface">{car.name}</p>
                         <span className="text-xs uppercase text-on-surface-variant">{car.seats} seats</span>
                       </div>
                       <p className="mt-2 text-sm text-on-surface-variant">{car.desc}</p>
                     </div>
                     {car.image && (
                       <img src={car.image} alt={car.name} className="h-16 w-24 rounded-xl object-cover" />
                     )}
                   </label>
                 ))}
               </div>
               <label className="inline-flex items-start gap-3 text-sm text-on-surface">
                 <input
                   type="checkbox"
                   checked={formData.carConsent}
                   onChange={(e) => setFormData({ ...formData, carConsent: e.target.checked })}
                   className="mt-1 h-4 w-4 text-primary"
                 />
                 <span>
                   I consent to the car hire terms, including payment of a caution fee and responsibility for any damage or misuse of the vehicle.
                 </span>
               </label>
             </div>
           )}

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
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-8">Booking summary</h3>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl font-bold text-on-surface">
                    {formatPrice(quote.basePrice)}
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium border-b border-outline pb-4">
                    <span className="text-on-surface-variant">{quote.variableFeeLabel}</span>
                    <span>{formatPrice(quote.variableFee)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium border-b border-outline pb-4">
                    <span className="text-on-surface-variant">Route multiplier</span>
                    <span>{quote.routeFactor.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium border-b border-outline pb-4">
                    <span className="text-on-surface-variant">Insurance</span>
                    <span className="text-primary font-bold italic">Included</span>
                  </div>
                  <div className="flex flex-col gap-2 pt-4 text-lg font-bold text-on-surface sm:flex-row sm:items-center sm:justify-between">
                    <span>Total Amount</span>
                    <span className="safe-text text-primary text-2xl">
                      {formatPrice(quote.totalAmount)}
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
                 <p className="text-sm font-bold text-on-surface">Secure checkout</p>
                 <p className="text-xs text-on-surface-variant mt-1">Your booking uses server-side payment verification and live pricing in {displayCurrency}.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
