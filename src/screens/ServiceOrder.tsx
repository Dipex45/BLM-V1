import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { company, defaultVehicles } from '../lib/company';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DOMPurify from 'dompurify';
import { logAudit, AuditAction } from '../lib/audit';
import { BookingSchema } from '../lib/schemas';

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const fieldVariant = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export default function ServiceOrder() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatPrice, displayCurrency } = useCurrency();

  const service = company.services.find((s) => slugify(s.title) === slug);
  const is247Transport = slug === '24-7-transport-services' || slug === 'long-and-short-distance-trips';
  const isCarHire = slug === 'car-hire';
  const isTouring = slug === 'touring';
  const isCrossBorder = slug === 'cross-border-trips';
  const isLogistics = slug === 'pickup-and-logistics';

  // Admin dynamic state
  const [vehicles, setVehicles] = useState<any[]>(defaultVehicles);
  const [carHireOptions, setCarHireOptions] = useState<any[]>(company.carHireOptions);
  const [touringStates, setTouringStates] = useState<any[]>(company.touringStates);
  const [internationalTours, setInternationalTours] = useState<any[]>(company.internationalTours);
  const [hubs, setHubs] = useState<any[]>(company.hubs);
  const [pricingRules, setPricingRules] = useState(company.pricingRules);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    pickup: '',
    destination: '',
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
    notes: '',
    // 24/7 Service:
    vehicleClass: 'Economy',
    isReturn: false,
    // Car Hire:
    selectedCarId: company.carHireOptions[0]?.id || 'toyota-corolla',
    hireDurationDays: 1,
    withDriver: true,
    cautionFeeConsent: false,
    // Touring:
    touringPackage: 'Touring Bronze',
    touringState: 'Lagos',
    touringSpots: 2,
    tourGuideNeeded: true,
    // Cross-Border:
    crossBorderCountry: 'Benin Republic',
    passengerCount: 1,
    borderClearanceHelp: true,
    // Logistics:
    packageType: 'Document / Parcel',
    cargoWeightKg: 'Under 5kg',
    packageWeightKg: 1,
    logisticsDetails: '',
  });

  useEffect(() => {
    const fetchAdminSettings = async () => {
      try {
        const vehicleSnap = await getDoc(doc(db, 'settings', 'vehicle_types'));
        if (vehicleSnap.exists() && Array.isArray(vehicleSnap.data().value) && vehicleSnap.data().value.length > 0) {
          setVehicles(vehicleSnap.data().value);
        }
      } catch (e) {
        console.warn('Using default vehicle types');
      }

      try {
        const carSnap = await getDoc(doc(db, 'settings', 'car_hire_options'));
        if (carSnap.exists() && Array.isArray(carSnap.data().value) && carSnap.data().value.length > 0) {
          setCarHireOptions(carSnap.data().value);
        }
      } catch (e) {
        console.warn('Using default car hire options');
      }

      try {
        const tourSnap = await getDoc(doc(db, 'settings', 'touring_states'));
        if (tourSnap.exists() && Array.isArray(tourSnap.data().value) && tourSnap.data().value.length > 0) {
          setTouringStates(tourSnap.data().value);
        }
      } catch (e) {
        console.warn('Using default touring states');
      }

      try {
        const intlSnap = await getDoc(doc(db, 'settings', 'international_tours'));
        if (intlSnap.exists() && Array.isArray(intlSnap.data().value) && intlSnap.data().value.length > 0) {
          setInternationalTours(intlSnap.data().value);
        }
      } catch (e) {
        console.warn('Using default international tours');
      }

      try {
        const rulesSnap = await getDoc(doc(db, 'settings', 'pricing_rules'));
        if (rulesSnap.exists() && rulesSnap.data().value) {
          setPricingRules({ ...company.pricingRules, ...rulesSnap.data().value });
        }
      } catch (e) {
        console.warn('Using default pricing rules');
      }

      try {
        const hubsSnap = await getDocs(collection(db, 'hubs'));
        const hData = hubsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (hData.length > 0) {
          setHubs(hData);
          setFormData((prev) => ({
            ...prev,
            pickup: prev.pickup || hData[0].name,
            destination: prev.destination || hData[1]?.name || hData[0].name,
          }));
        }
      } catch (e) {
        console.warn('Using default hubs');
      }

      try {
        const blockedSnap = await getDocs(collection(db, 'blocked_dates'));
        setBlockedDates(blockedSnap.docs.map((d) => d.data().date));
      } catch (e) {
        console.warn('Using default blocked dates');
      }
    };

    fetchAdminSettings();
  }, []);

  // Pre-fill user profile if logged in
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.displayName || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  if (!service) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md text-center">
          <span className="material-symbols-outlined mb-6 text-6xl text-on-surface-variant">search_off</span>
          <h1 className="mb-3 text-3xl font-bold text-on-surface">Service not found</h1>
          <p className="mb-8 text-on-surface-variant">The service you're looking for doesn't exist or may have been moved.</p>
          <Link to="/services" className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-white">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to services
          </Link>
        </motion.div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Price Calculation tailored per service
  const calculatePrice = () => {
    if (is247Transport) {
      const selected = vehicles.find((v) => v.title === formData.vehicleClass) || vehicles[0];
      const base = Number(selected?.price || 25000);
      const mult = formData.isReturn ? Number(pricingRules.returnMultiplier || 2) : 1;
      const fee = Number(pricingRules.standardServiceFee || 4500);
      return {
        basePrice: base,
        extraFee: fee,
        feeLabel: 'Standard Service Fee',
        total: Math.round(base * mult + fee),
        vehicleClass: selected?.title || 'Economy',
      };
    }

    if (isCarHire) {
      const selectedCar = carHireOptions.find((c) => c.id === formData.selectedCarId) || carHireOptions[0];
      const carHireVehicleObj = vehicles.find((v) => v.title.toLowerCase().includes('car hire')) || { price: 70000 };
      const basePerDay = Number(carHireVehicleObj.price || 70000);
      const days = Math.max(Number(formData.hireDurationDays) || 1, 1);
      const caution = Number(pricingRules.carHireCautionFee || 25000);
      const driverFee = formData.withDriver ? 10000 * days : 0;
      return {
        basePrice: basePerDay * days,
        extraFee: caution + driverFee,
        feeLabel: `Caution Deposit (${formatPrice(caution)}) ${driverFee > 0 ? `+ Chauffeur (${formatPrice(driverFee)})` : ''}`,
        total: Math.round(basePerDay * days + caution + driverFee),
        vehicleClass: 'Car Hire',
      };
    }

    if (isTouring) {
      const tourObj = vehicles.find((v) => v.title === formData.touringPackage) || vehicles.find((v) => v.title.includes('Touring')) || { price: 90000 };
      const base = Number(tourObj.price || 90000);
      const stateFactor = touringStates.find((s) => s.name === formData.touringState)?.factor || 1;
      const spots = Math.min(Math.max(Number(formData.touringSpots) || 1, 1), 20);
      const locationFee = Math.round(spots * Number(pricingRules.touringPerLocation || 15000) * stateFactor);
      return {
        basePrice: base,
        extraFee: locationFee,
        feeLabel: `${spots} Locations in ${formData.touringState} (${stateFactor}x)`,
        total: Math.round(base + locationFee),
        vehicleClass: formData.touringPackage,
      };
    }

    if (isCrossBorder) {
      const crossObj = vehicles.find((v) => v.title.toLowerCase().includes('cross-border')) || { price: 180000 };
      const base = Number(crossObj.price || 180000);
      const countryObj = internationalTours.find((c) => c.name === formData.crossBorderCountry);
      const countryFactor = countryObj?.factor || 1.1;
      const clearanceFee = formData.borderClearanceHelp ? Number(pricingRules.crossBorderProcessingFee || 30000) : 0;
      return {
        basePrice: Math.round(base * countryFactor),
        extraFee: clearanceFee,
        feeLabel: `Border Clearance & Transit to ${formData.crossBorderCountry}`,
        total: Math.round(base * countryFactor + clearanceFee),
        vehicleClass: 'Cross-Border transit',
      };
    }

    if (isLogistics) {
      const logObj = vehicles.find((v) => v.title.toLowerCase().includes('pickup') || v.title.toLowerCase().includes('logistics')) || { price: 65000 };
      const base = Number(logObj.price || 65000);
      const handlingFee = Number(pricingRules.pickupLogisticsFee || 22000);
      const weightKg = Math.max(Number(formData.packageWeightKg) || 1, 1);
      const weightFee = Math.round(weightKg * Number(pricingRules.pricePerKg || 0));
      return {
        basePrice: base,
        extraFee: handlingFee + weightFee,
        feeLabel: `Handling + ${weightKg}kg cargo weight`,
        total: Math.round(base + handlingFee + weightFee),
        vehicleClass: 'Pickup & Logistics',
      };
    }

    // Default Fallback
    const def = vehicles[0] || { price: 25000, title: 'Economy' };
    return {
      basePrice: Number(def.price || 25000),
      extraFee: 4500,
      feeLabel: 'Service Fee',
      total: Number(def.price || 25000) + 4500,
      vehicleClass: def.title,
    };
  };

  const calculatedQuote = calculatePrice();

  // WhatsApp Order message builder
  const buildWhatsAppMessage = (): string => {
    const lines = [
      `Good day BLM, I want to book your services.`,
      ``,
      `*Service Category:* ${service.title}`,
      `*Vehicle / Class:* ${calculatedQuote.vehicleClass}`,
      `*Calculated Total Price:* ${formatPrice(calculatedQuote.total)} (NGN ${calculatedQuote.total})`,
      formData.fullName && `*Customer Name:* ${formData.fullName}`,
      formData.phone && `*Phone Number:* ${formData.phone}`,
      formData.email && `*Email Address:* ${formData.email}`,
      `*Pickup Location:* ${formData.pickup}`,
      `*Destination:* ${formData.destination}`,
      `*Date:* ${formData.date}`,
      `*Time:* ${formData.time}`,
      is247Transport && `*Trip Type:* ${formData.isReturn ? 'Round Trip (Return)' : 'One Way'}`,
      isCarHire && `*Selected Vehicle:* ${carHireOptions.find((c) => c.id === formData.selectedCarId)?.name || 'Standard Sedan'}`,
      isCarHire && `*Duration:* ${formData.hireDurationDays} day(s)`,
      isCarHire && `*Chauffeur:* ${formData.withDriver ? 'With BLM Driver' : 'Self Drive'}`,
      isTouring && `*Touring State:* ${formData.touringState}`,
      isTouring && `*Sightseeing Locations:* ${formData.touringSpots} locations`,
      isCrossBorder && `*Destination Country:* ${formData.crossBorderCountry}`,
      isCrossBorder && `*Passengers:* ${formData.passengerCount}`,
      isLogistics && `*Cargo Category:* ${formData.packageType}`,
      isLogistics && `*Weight Tier:* ${formData.cargoWeightKg}`,
      isLogistics && `*Declared Weight:* ${formData.packageWeightKg}kg`,
      formData.notes && `*Special Notes:* ${formData.notes}`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleWhatsAppOrder = (e: FormEvent) => {
    e.preventDefault();
    if (isCarHire && !formData.cautionFeeConsent) {
      setOrderError('Please consent to the refundable caution fee terms to book Car Hire.');
      return;
    }
    const message = buildWhatsAppMessage();
    const url = `https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Online Booking -> Creates DB booking doc and navigates directly to /checkout/:bookingId payment page
  const handleBookOnline = async (e: FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    if (!user) {
      // Store draft in sessionStorage and redirect to login
      sessionStorage.setItem('pending_booking_slug', slug || '');
      navigate('/login');
      return;
    }

    if (blockedDates.includes(formData.date)) {
      setOrderError('Selected date is currently blocked for maintenance/schedules. Please select another date.');
      return;
    }

    if (isCarHire && !formData.cautionFeeConsent) {
      setOrderError('Please accept the car hire caution fee consent to proceed.');
      return;
    }

    if (isLogistics && !formData.logisticsDetails.trim()) {
      setOrderError('Please describe package contents and handling instructions.');
      return;
    }

    setSubmitting(true);
    try {
      const quote = calculatedQuote;
      const bookingPayload = {
        customerId: user.uid,
        customerName: DOMPurify.sanitize(formData.fullName.trim() || user.displayName || user.email || 'Customer'),
        customerEmail: DOMPurify.sanitize(formData.email.trim() || user.email || 'customer@blmmotors.com'),
        pickup: DOMPurify.sanitize(formData.pickup.trim() || 'Nigeria Hub'),
        destination: DOMPurify.sanitize(formData.destination.trim() || 'Operations Hub'),
        vehicleClass: DOMPurify.sanitize(quote.vehicleClass),
        date: formData.date,
        time: formData.time,
        totalAmount: quote.total,
        currency: 'NGN',
        displayCurrency,
        isReturn: formData.isReturn,
        notes: DOMPurify.sanitize(formData.notes),
        status: 'Quoted',
        serviceType: service.title,
        touringSpots: formData.touringSpots,
        touringState: formData.touringState,
        internationalCountry: formData.crossBorderCountry,
        logisticsDetails: DOMPurify.sanitize(formData.logisticsDetails),
        packageWeightKg: formData.packageWeightKg,
        carHireVehicle: formData.selectedCarId,
        pricingSnapshot: {
          basePrice: quote.basePrice,
          extraFee: quote.extraFee,
          feeLabel: quote.feeLabel,
          total: quote.total,
        },
        createdAt: new Date().toISOString(),
      };

      const validated = BookingSchema.parse(bookingPayload);
      const docRef = await addDoc(collection(db, 'bookings'), validated);

      await logAudit(user.uid, user.email || 'unknown', AuditAction.CREATE_BOOKING, {
        bookingId: docRef.id,
        service: service.title,
        amount: quote.total,
      });

      // Direct navigation to the payment checkout page!
      navigate(`/checkout/${encodeURIComponent(docRef.id)}`);
    } catch (err: any) {
      console.error('Booking online failed:', err);
      setOrderError(err.message || 'Unable to place booking right now. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses =
    'w-full rounded-xl border border-outline bg-surface-container px-4 py-3.5 text-sm font-medium text-on-surface transition-all duration-200 placeholder:text-on-surface-variant/50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15';

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-secondary px-4 pb-16 pt-10 text-white sm:px-6 md:px-8 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(212,0,0,0.18),transparent_60%)]" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <Link
              to="/services"
              className="mb-8 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white/80 backdrop-blur transition-all hover:bg-white/20 hover:text-white"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to all services
            </Link>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/30 sm:h-24 sm:w-24">
                <span className="material-symbols-outlined text-4xl sm:text-5xl">{service.icon}</span>
              </div>
              <div>
                <h1 className="text-3xl font-black leading-tight sm:text-4xl md:text-5xl">{service.title}</h1>
                <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-white/80 md:text-lg">
                  {service.desc}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Order & Booking Container */}
      <section className="bg-white px-4 py-16 sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Order Form */}
          <motion.form
            onSubmit={handleBookOnline}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="order-2 space-y-8 lg:order-1"
          >
            <div>
              <h2 className="text-2xl font-bold text-on-surface sm:text-3xl">
                {is247Transport && '24/7 Transport Service Booking'}
                {isCarHire && 'Car Hire Reservation'}
                {isTouring && 'Touring Package & Itinerary'}
                {isCrossBorder && 'Cross-Border Travel Booking'}
                {isLogistics && 'Pickup & Logistics Request'}
                {!is247Transport && !isCarHire && !isTouring && !isCrossBorder && !isLogistics && 'Booking Details'}
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Fill in your travel details. View your price breakdown and proceed directly to payment or order via WhatsApp.
              </p>
            </div>

            {orderError && (
              <div className="rounded-xl border border-error/20 bg-error-container p-4 text-sm font-bold text-on-error-container">
                {orderError}
              </div>
            )}

            {/* 1. 24/7 TRANSPORT CLASS SELECTION */}
            {is247Transport && (
              <motion.div variants={fieldVariant} className="rounded-2xl border border-outline bg-surface-container/30 p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-primary">directions_car</span>
                  <h3 className="text-lg font-bold text-on-surface">Choose Vehicle Class & Pricing</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {vehicles.filter(v => !v.title.toLowerCase().includes('touring') && !v.title.toLowerCase().includes('logistics') && !v.title.toLowerCase().includes('car hire')).map((veh) => (
                    <label
                      key={veh.title}
                      className={`cursor-pointer rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                        formData.vehicleClass === veh.title
                          ? 'border-primary bg-white shadow-md ring-2 ring-primary/20'
                          : 'border-outline bg-white/70 hover:border-primary/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="vehicleClass"
                        value={veh.title}
                        checked={formData.vehicleClass === veh.title}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-on-surface">{veh.title}</span>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                            {formatPrice(veh.price)}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">{veh.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <label className="flex items-center gap-3 pt-2 text-sm font-semibold text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    name="isReturn"
                    checked={formData.isReturn}
                    onChange={handleChange}
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                  <span>Round Trip / Return Journey (+{formatPrice(calculatedQuote.basePrice)})</span>
                </label>
              </motion.div>
            )}

            {/* 2. CAR HIRE FLEET SELECTION */}
            {isCarHire && (
              <motion.div variants={fieldVariant} className="rounded-2xl border border-outline bg-surface-container/30 p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-primary">car_rental</span>
                  <h3 className="text-lg font-bold text-on-surface">Select Car Model & Rental Plan</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {carHireOptions.map((car) => (
                    <label
                      key={car.id}
                      className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all ${
                        formData.selectedCarId === car.id
                          ? 'border-primary bg-white shadow-md ring-2 ring-primary/20'
                          : 'border-outline bg-white/70 hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedCarId"
                        value={car.id}
                        checked={formData.selectedCarId === car.id}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      {car.image && (
                        <img src={car.image} alt={car.name} className="h-24 w-full rounded-lg object-cover mb-3" />
                      )}
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-sm text-on-surface">{car.name}</p>
                          <span className="rounded-md bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                            {car.seats} seats
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant">{car.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Rental Duration (Days)
                    </label>
                    <input
                      type="number"
                      name="hireDurationDays"
                      min={1}
                      max={30}
                      value={formData.hireDurationDays}
                      onChange={handleChange}
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Chauffeur Service
                    </label>
                    <select
                      name="withDriver"
                      value={formData.withDriver ? 'yes' : 'no'}
                      onChange={(e) => setFormData({ ...formData, withDriver: e.target.value === 'yes' })}
                      className={inputClasses}
                    >
                      <option value="yes">With Professional BLM Driver (+{formatPrice(10000)}/day)</option>
                      <option value="no">Self-Drive</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs font-semibold text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    name="cautionFeeConsent"
                    checked={formData.cautionFeeConsent}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                  <span>
                    I consent to the BLM Motors car hire caution deposit ({formatPrice(pricingRules.carHireCautionFee)} refundable upon safe vehicle return) and accept responsibility for vehicle care.
                  </span>
                </label>
              </motion.div>
            )}

            {/* 3. TOURING SELECTION */}
            {isTouring && (
              <motion.div variants={fieldVariant} className="rounded-2xl border border-outline bg-surface-container/30 p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-primary">explore</span>
                  <h3 className="text-lg font-bold text-on-surface">Select Touring Package & Destination</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {vehicles.filter(v => v.title.toLowerCase().includes('touring')).map((pkg) => (
                    <label
                      key={pkg.title}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                        formData.touringPackage === pkg.title
                          ? 'border-primary bg-white shadow-md ring-2 ring-primary/20'
                          : 'border-outline bg-white/70 hover:border-primary/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="touringPackage"
                        value={pkg.title}
                        checked={formData.touringPackage === pkg.title}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-on-surface">{pkg.title}</span>
                        <span className="text-xs font-bold text-primary">{formatPrice(pkg.price)}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant">{pkg.desc}</p>
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Touring State (Admin Managed)
                    </label>
                    <select
                      name="touringState"
                      value={formData.touringState}
                      onChange={handleChange}
                      className={inputClasses}
                    >
                      {touringStates.map((st) => (
                        <option key={st.name} value={st.name}>
                          {st.name} ({st.factor}x Factor)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Number of Sightseeing Stops
                    </label>
                    <input
                      type="number"
                      name="touringSpots"
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
                      className={inputClasses}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* 4. CROSS-BORDER TRIPS */}
            {isCrossBorder && (
              <motion.div variants={fieldVariant} className="rounded-2xl border border-outline bg-surface-container/30 p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-primary">public</span>
                  <h3 className="text-lg font-bold text-on-surface">International Route & Border Clearance</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Destination Country
                    </label>
                    <select
                      name="crossBorderCountry"
                      value={formData.crossBorderCountry}
                      onChange={handleChange}
                      className={inputClasses}
                    >
                      {internationalTours.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} (Multiplier {c.factor}x)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Passenger Count
                    </label>
                    <input
                      type="number"
                      name="passengerCount"
                      min={1}
                      max={18}
                      value={formData.passengerCount}
                      onChange={handleChange}
                      className={inputClasses}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 text-sm font-semibold text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    name="borderClearanceHelp"
                    checked={formData.borderClearanceHelp}
                    onChange={handleChange}
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                  <span>Assisted Border Clearance & Priority Passage (+{formatPrice(pricingRules.crossBorderProcessingFee)})</span>
                </label>
              </motion.div>
            )}

            {/* 5. LOGISTICS & PICKUP */}
            {isLogistics && (
              <motion.div variants={fieldVariant} className="rounded-2xl border border-outline bg-surface-container/30 p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-primary">local_shipping</span>
                  <h3 className="text-lg font-bold text-on-surface">Cargo & Package Information</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Package Category
                    </label>
                    <select
                      name="packageType"
                      value={formData.packageType}
                      onChange={handleChange}
                      className={inputClasses}
                    >
                      <option value="Document / Parcel">Document / Envelope</option>
                      <option value="Box / Commercial Goods">Box / Commercial Goods</option>
                      <option value="Retail & Electronics">Retail & Electronics</option>
                      <option value="Heavy Equipment / Freight">Heavy Equipment / Freight</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Weight Tier
                    </label>
                    <select
                      name="cargoWeightKg"
                      value={formData.cargoWeightKg}
                      onChange={handleChange}
                      className={inputClasses}
                    >
                      <option value="Under 5kg">Under 5kg</option>
                      <option value="5kg - 25kg">5kg - 25kg</option>
                      <option value="25kg - 100kg">25kg - 100kg</option>
                      <option value="Over 100kg (Freight)">Over 100kg (Freight)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Declared Weight (kg)
                  </label>
                  <input
                    type="number"
                    name="packageWeightKg"
                    min={1}
                    max={10000}
                    value={formData.packageWeightKg}
                    onChange={(e) => setFormData({ ...formData, packageWeightKg: Math.max(Number(e.target.value) || 1, 1) })}
                    className={inputClasses}
                  />
                  <p className="mt-2 text-xs font-medium text-on-surface-variant">
                    Weight is charged at {formatPrice(pricingRules.pricePerKg || 0)} per kg and can be changed by an admin.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Package Description & Handling Notes
                  </label>
                  <textarea
                    name="logisticsDetails"
                    required
                    value={formData.logisticsDetails}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Describe items, dimensions, fragility, receiver details..."
                    className={`${inputClasses} resize-none`}
                  />
                </div>
              </motion.div>
            )}

            {/* General Contact & Route Fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-on-surface">Customer Contact & Route Details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
                <motion.div variants={fieldVariant}>
                  <label className="mb-2 block text-sm font-bold text-on-surface-variant">Full name</label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className={inputClasses}
                  />
                </motion.div>

                <motion.div variants={fieldVariant}>
                  <label className="mb-2 block text-sm font-bold text-on-surface-variant">Phone number</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+234..."
                    className={inputClasses}
                  />
                </motion.div>

                <motion.div variants={fieldVariant}>
                  <label className="mb-2 block text-sm font-bold text-on-surface-variant">Email address</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@email.com"
                    className={inputClasses}
                  />
                </motion.div>

                <motion.div variants={fieldVariant}>
                  <label className="mb-2 block text-sm font-bold text-on-surface-variant">
                    Pickup Location (Admin Managed Hubs)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="pickup"
                      required
                      list="hubs-list"
                      value={formData.pickup}
                      onChange={handleChange}
                      placeholder="Enter pickup address or choose hub"
                      className={inputClasses}
                    />
                    <datalist id="hubs-list">
                      {hubs.map((h) => (
                        <option key={h.name} value={h.name} />
                      ))}
                    </datalist>
                  </div>
                </motion.div>

                <motion.div variants={fieldVariant}>
                  <label className="mb-2 block text-sm font-bold text-on-surface-variant">Destination address</label>
                  <input
                    type="text"
                    name="destination"
                    required
                    value={formData.destination}
                    onChange={handleChange}
                    placeholder="Drop-off address or city"
                    className={inputClasses}
                  />
                </motion.div>

                <motion.div variants={fieldVariant}>
                  <label className="mb-2 block text-sm font-bold text-on-surface-variant">Travel Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    value={formData.date}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </motion.div>

                <motion.div variants={fieldVariant} className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-on-surface-variant">Preferred Time</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </motion.div>
              </div>

              <motion.div variants={fieldVariant}>
                <label className="mb-2 block text-sm font-bold text-on-surface-variant">Special instructions / requests</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Extra luggage, child seat, specific route preferences..."
                  className={`${inputClasses} resize-none`}
                />
              </motion.div>
            </div>

            {/* Action Buttons */}
            <motion.div variants={fieldVariant} className="flex flex-col gap-4 sm:flex-row pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">credit_card</span>
                    <span>Continue to secure payment</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleWhatsAppOrder}
                className="inline-flex flex-1 items-center justify-center gap-3 rounded-xl bg-[#25D366] px-8 py-4 text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-lg">chat</span>
                <span>Send WhatsApp order</span>
              </button>
            </motion.div>
          </motion.form>

          {/* Right Live Price Summary Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="order-1 space-y-6 lg:order-2"
          >
            <div className="sticky top-28 space-y-6">
              {/* Dynamic Live Price Card */}
              <div className="rounded-3xl border border-outline bg-white p-7 shadow-lg shadow-black/5">
                <div className="flex items-center justify-between pb-6 border-b border-outline">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-2xl">{service.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface">{service.title}</h3>
                      <p className="text-xs text-on-surface-variant">{calculatedQuote.vehicleClass}</p>
                    </div>
                  </div>
                </div>

                <div className="py-6 space-y-4 text-sm">
                  <div className="flex justify-between items-center text-on-surface-variant font-medium">
                    <span>Base Service Fare</span>
                    <span className="font-bold text-on-surface">{formatPrice(calculatedQuote.basePrice)}</span>
                  </div>

                  <div className="flex justify-between items-center text-on-surface-variant font-medium">
                    <span>{calculatedQuote.feeLabel}</span>
                    <span className="font-bold text-on-surface">{formatPrice(calculatedQuote.extraFee)}</span>
                  </div>

                  <div className="flex justify-between items-center text-on-surface-variant font-medium">
                    <span>Safety & Passenger Insurance</span>
                    <span className="font-bold text-green-600">Included</span>
                  </div>

                  <div className="pt-4 border-t border-outline flex justify-between items-baseline">
                    <span className="font-bold text-base text-on-surface">Total Payable</span>
                    <span className="text-3xl font-black text-primary">
                      {formatPrice(calculatedQuote.total)}
                    </span>
                  </div>
                  <p className="text-[11px] text-right text-on-surface-variant">Live conversion in {displayCurrency}</p>
                </div>

                <button
                  type="button"
                  onClick={handleBookOnline}
                  disabled={submitting}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] hover:bg-primary-container disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg">payment</span>
                  <span>Proceed to Payment</span>
                </button>
              </div>

              {/* Service Guarantees */}
              <div className="rounded-3xl border border-outline bg-surface-container-lowest p-7 shadow-sm">
                <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-on-surface">Service Guarantees</h4>
                <ul className="space-y-3">
                  {[
                    'Instant card & bank transfer payments with Paystack/Stripe',
                    'Official booking invoice & tracking reference',
                    '24/7 dedicated dispatch & support channel',
                    'Verified, insured vehicles & licensed drivers',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-xs font-semibold text-on-surface-variant">
                      <span className="material-symbols-outlined mt-0.5 text-base text-primary">check_circle</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.aside>
        </div>
      </section>
    </div>
  );
}
