import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { company } from '../lib/company';
import { distanceVehicles, effectiveKmRate, serviceSlug } from '../lib/catalog';
import { needsRouteDistance, type BookingQuote } from '../lib/bookingPricing';
import { apiErrorMessage, apiPost } from '../lib/api';
import { useCatalog } from '../hooks/useCatalog';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../contexts/CurrencyContext';
import { AnimatedNumber, easeOutExpo, fadeUp, Spinner } from '../components/ui/motion';

type ServerQuote = BookingQuote & {
  distanceSource: 'google_maps' | 'customer_estimate' | null;
  routeMetadata: { distanceKm: number; durationText: string; distanceText: string } | null;
};

const TIME_SLOTS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const formatSlot = (slot: string) => {
  const hour = Number(slot.slice(0, 2));
  return `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
};

function Section({ step, title, icon, children }: { step: number; title: string; icon: string; children: ReactNode }) {
  return (
    <motion.section variants={fadeUp} className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-white">{step}</span>
        <h2 className="flex items-center gap-2 text-lg font-bold">{title}<span className="material-symbols-outlined text-xl text-primary">{icon}</span></h2>
      </div>
      {children}
    </motion.section>
  );
}

export default function ServiceOrder() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { catalog, error: catalogError, reload } = useCatalog();
  const { formatPrice, displayCurrency } = useCurrency();
  const service = company.services.find((item) => serviceSlug(item.title) === slug);
  const kind = service?.kind || 'distance';
  const usesRoute = needsRouteDistance(kind);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    pickup: '',
    destination: '',
    date: todayIso(),
    time: '08:00',
    notes: '',
    distanceKm: 25,
    vehicleClass: '',
    isReturn: false,
    carHireVehicle: '',
    carHireDurationDays: 1,
    carHireWithDriver: true,
    cautionConsent: false,
    pickupHub: '',
    touringPackage: '',
    touringState: '',
    tourGuideNeeded: true,
    internationalCountry: '',
    passengerCount: 1,
    borderClearanceHelp: true,
    packageType: 'Document / Parcel',
    packageWeightKg: 1,
    logisticsDetails: '',
  });
  const [quote, setQuote] = useState<ServerQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const quoteSeq = useRef(0);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  // Seed selections from the live catalog once it arrives.
  useEffect(() => {
    if (!catalog) return;
    setForm((current) => ({
      ...current,
      vehicleClass: current.vehicleClass || distanceVehicles(catalog.vehicles)[0]?.title || '',
      carHireVehicle: current.carHireVehicle || catalog.carHireOptions.find((car) => car.available)?.id || '',
      pickupHub: current.pickupHub || catalog.hubs[0]?.name || '',
      touringPackage: current.touringPackage || catalog.touringPackages[0]?.id || '',
      touringState: current.touringState || catalog.touringStates[0]?.name || '',
      internationalCountry: current.internationalCountry || catalog.internationalTours[0]?.name || '',
    }));
  }, [catalog]);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      fullName: current.fullName || user.displayName || '',
      email: current.email || user.email || '',
      phone: current.phone || user.phone || '',
    }));
  }, [user]);

  const pricingInput = useMemo(() => ({
    serviceType: service?.title || '',
    vehicleClass: form.vehicleClass,
    pickup: kind === 'car_hire' ? form.pickupHub : form.pickup.trim(),
    destination: kind === 'car_hire' ? `Car hire (${form.pickupHub})` : form.destination.trim(),
    date: form.date,
    time: form.time,
    isReturn: form.isReturn,
    carHireVehicle: form.carHireVehicle || undefined,
    carHireDurationDays: Number(form.carHireDurationDays) || 1,
    carHireWithDriver: form.carHireWithDriver,
    pickupHub: form.pickupHub || undefined,
    touringPackage: form.touringPackage || undefined,
    touringState: form.touringState || undefined,
    tourGuideNeeded: form.tourGuideNeeded,
    internationalCountry: form.internationalCountry || undefined,
    passengerCount: Number(form.passengerCount) || 1,
    borderClearanceHelp: form.borderClearanceHelp,
    packageWeightKg: Number(form.packageWeightKg) || 1,
    distanceKm: usesRoute && !catalog?.mapsEnabled ? Number(form.distanceKm) || 1 : undefined,
  }), [catalog?.mapsEnabled, form, kind, service?.title, usesRoute]);

  const routeReady = !usesRoute || !catalog?.mapsEnabled || (pricingInput.pickup.length >= 3 && pricingInput.destination.length >= 3);
  const selectionsReady = Boolean(catalog) && (kind !== 'distance' || form.vehicleClass) && (kind !== 'car_hire' || form.carHireVehicle) && (kind !== 'touring' || form.touringPackage);

  // Authoritative quote from the server, debounced while the customer types.
  useEffect(() => {
    if (!service || !selectionsReady || !routeReady) {
      setQuote(null);
      return;
    }
    const sequence = ++quoteSeq.current;
    setQuoting(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await apiPost<ServerQuote>('/api/quote', pricingInput);
        if (sequence !== quoteSeq.current) return;
        setQuote(data);
        setQuoteError(null);
      } catch (error) {
        if (sequence !== quoteSeq.current) return;
        setQuote(null);
        setQuoteError(apiErrorMessage(error, 'We couldn’t get a price for this trip.'));
      } finally {
        if (sequence === quoteSeq.current) setQuoting(false);
      }
    }, usesRoute ? 700 : 250);
    return () => window.clearTimeout(timer);
  }, [pricingInput, routeReady, selectionsReady, service, usesRoute]);

  if (!service) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant">search_off</span>
        <h1 className="mt-4 text-3xl font-extrabold">Service not found</h1>
        <Link to="/services" className="btn-primary mt-8">Back to services</Link>
      </div>
    );
  }

  const blocked = catalog?.blockedDates.includes(form.date);
  const selectedCar = catalog?.carHireOptions.find((car) => car.id === form.carHireVehicle);

  const validate = () => {
    if (!quote) return quoteError || 'Please wait for the price to load.';
    if (blocked) return 'We’re not taking bookings on that day. Please pick another.';
    if (form.date < todayIso()) return 'Please pick today or a later date.';
    if (form.fullName.trim().length < 2) return 'Please enter your full name.';
    if (form.phone.trim().length < 5) return 'Please enter a phone number we can call you on.';
    if (kind !== 'car_hire' && (!form.pickup.trim() || !form.destination.trim())) return 'Please enter where you’re going from and to.';
    if (kind === 'car_hire' && !form.cautionConsent) return 'Please tick the box to agree to the refundable deposit.';
    if (kind === 'logistics' && form.logisticsDetails.trim().length < 3) return 'Please tell us what you’re sending.';
    return null;
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setFormError(null);
    if (!user) {
      sessionStorage.setItem('blm-return-to', `/services/${slug}`);
      navigate('/login', { state: { from: `/services/${slug}` } });
      return;
    }
    const problem = validate();
    if (problem) return setFormError(problem);

    setSubmitting(true);
    try {
      const { data } = await apiPost<{ id: string }>('/api/bookings', {
        ...pricingInput,
        vehicleClass: quote!.vehicleClass,
        customerName: form.fullName.trim(),
        customerEmail: (form.email.trim() || user.email || '').toLowerCase(),
        customerPhone: form.phone.trim(),
        notes: form.notes.trim(),
        displayCurrency,
        logisticsDetails: kind === 'logistics' ? `${form.packageType}: ${form.logisticsDetails.trim()}` : undefined,
        distanceKm: usesRoute ? quote!.distanceKm : undefined,
      });
      navigate(`/checkout/${encodeURIComponent(data.id)}`);
    } catch (error) {
      setFormError(apiErrorMessage(error, 'We couldn’t make your booking. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappOrder = () => {
    const lines = [
      'Good day BLM, I want to book your services.',
      '',
      `*Service:* ${service.title}`,
      quote && `*Vehicle / package:* ${quote.vehicleClass}`,
      quote && `*Quoted total:* ${formatPrice(quote.total, 'NGN')}`,
      form.fullName && `*Name:* ${form.fullName}`,
      form.phone && `*Phone:* ${form.phone}`,
      `*Pickup:* ${pricingInput.pickup || 'to confirm'}`,
      kind !== 'car_hire' && `*Destination:* ${pricingInput.destination || 'to confirm'}`,
      `*Date:* ${form.date} at ${form.time}`,
      quote?.distanceKm ? `*Distance:* ${quote.distanceKm} km` : null,
      form.notes && `*Notes:* ${form.notes}`,
    ].filter(Boolean);
    window.open(`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  };

  const option = (active: boolean) => ({ 'data-active': active ? 'true' : 'false' });

  return (
    <div>
      <section className="relative overflow-hidden bg-secondary text-white">
        <div className="hero-grid absolute inset-0" />
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="container-page relative py-12 sm:py-16">
          <Link to="/services" className="inline-flex items-center gap-1 text-sm font-semibold text-white/70 hover:text-white">
            <span className="material-symbols-outlined text-base">arrow_back</span> All services
          </Link>
          <motion.div initial="hidden" animate="show" variants={fadeUp} className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-primary shadow-[var(--shadow-glow)]">
              <span className="material-symbols-outlined text-4xl">{service.icon}</span>
            </span>
            <div>
              <h1 className="text-3xl font-extrabold sm:text-5xl">{service.title}</h1>
              <p className="mt-3 max-w-2xl text-white/75">{service.desc}</p>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_380px]">
        {catalogError && (
          <div className="alert-error lg:col-span-2">
            <span className="material-symbols-outlined">cloud_off</span><span className="flex-1">{catalogError}</span>
            <button type="button" onClick={reload} className="font-bold underline">Retry</button>
          </div>
        )}

        {!catalog ? (
          <div className="space-y-6">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-56 rounded-2xl" />)}</div>
        ) : (
          <motion.form onSubmit={submit} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="space-y-6">
            {kind === 'distance' && (
              <Section step={1} title="Choose your car" icon="directions_car">
                <div className="grid gap-3 sm:grid-cols-3">
                  {distanceVehicles(catalog.vehicles).map((vehicle) => (
                    <button type="button" key={vehicle.title} onClick={() => update('vehicleClass', vehicle.title)} className="option-card text-left" {...option(form.vehicleClass === vehicle.title)}>
                      <span className="material-symbols-outlined text-primary">{vehicle.icon}</span>
                      <p className="mt-3 font-bold">{vehicle.title}</p>
                      <p className="mt-1 text-sm font-bold text-primary">{formatPrice(effectiveKmRate(vehicle, catalog.rules))}/km</p>
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{vehicle.desc}</p>
                    </button>
                  ))}
                </div>
                <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-semibold">
                  <input type="checkbox" checked={form.isReturn} onChange={(e) => update('isReturn', e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  Return trip (we charge the distance ×{catalog.rules.returnMultiplier})
                </label>
              </Section>
            )}

            {kind === 'car_hire' && (
              <Section step={1} title="Choose your car" icon="car_rental">
                <div className="grid gap-3 sm:grid-cols-3">
                  {catalog.carHireOptions.map((car) => (
                    <button type="button" key={car.id} disabled={!car.available} onClick={() => update('carHireVehicle', car.id)} className="option-card overflow-hidden p-0 text-left disabled:cursor-not-allowed disabled:opacity-50" {...option(form.carHireVehicle === car.id)}>
                      <img src={car.image || company.carHireOptions.find((item) => item.id === car.id)?.image || '/brand/car-01.webp'} alt={car.name} loading="lazy" className="h-28 w-full object-cover" />
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-2"><p className="font-bold">{car.name}</p><span className="text-xs text-on-surface-variant">{car.seats} seats</span></div>
                        <p className="mt-1 text-sm font-bold text-primary">{formatPrice(car.pricePerDay)}/day</p>
                        {!car.available && <p className="mt-1 text-xs font-semibold text-on-surface-variant">Currently unavailable</p>}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <label className="sm:col-span-3">
                    <span className="field-label">Pickup point</span>
                    <select className="field" value={form.pickupHub} onChange={(e) => update('pickupHub', e.target.value)}>
                      {catalog.hubs.map((hub) => <option key={hub.name} value={hub.name}>{hub.name} — {hub.address}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Days</span>
                    <input type="number" min={1} max={365} className="field" value={form.carHireDurationDays} onChange={(e) => update('carHireDurationDays', Math.max(1, Number(e.target.value) || 1))} />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="field-label">Driver</span>
                    <select className="field" value={form.carHireWithDriver ? 'yes' : 'no'} onChange={(e) => update('carHireWithDriver', e.target.value === 'yes')}>
                      <option value="yes">With a BLM driver (+{formatPrice(catalog.rules.carHireDriverDailyFee)}/day)</option>
                      <option value="no">I’ll drive myself</option>
                    </select>
                  </label>
                </div>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-primary-soft p-4 text-sm">
                  <input type="checkbox" checked={form.cautionConsent} onChange={(e) => update('cautionConsent', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
                  <span>I agree to a {formatPrice(catalog.rules.carHireCautionFee)} refundable deposit. You get it back when {selectedCar?.name || 'the car'} is returned in good condition.</span>
                </label>
              </Section>
            )}

            {kind === 'touring' && (
              <Section step={1} title="Choose a tour" icon="explore">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {catalog.touringPackages.map((pkg) => (
                    <button type="button" key={pkg.id} onClick={() => update('touringPackage', pkg.id)} className="option-card text-left" {...option(form.touringPackage === pkg.id)}>
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{pkg.title}</p>
                      <p className="mt-1 font-bold">{pkg.name}</p>
                      <p className="mt-2 text-lg font-extrabold text-primary">{formatPrice(pkg.price)}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{pkg.locations} stops · {pkg.days} day{pkg.days === 1 ? '' : 's'}</p>
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{pkg.desc}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="field-label">State</span>
                    <select className="field" value={form.touringState} onChange={(e) => update('touringState', e.target.value)}>
                      {catalog.touringStates.map((state) => <option key={state.name} value={state.name}>{state.name}{state.factor !== 1 ? ` (×${state.factor})` : ''}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Tour guide</span>
                    <select className="field" value={form.tourGuideNeeded ? 'yes' : 'no'} onChange={(e) => update('tourGuideNeeded', e.target.value === 'yes')}>
                      <option value="yes">Add a local guide (+{formatPrice(catalog.rules.tourGuideFee)})</option>
                      <option value="no">No guide</option>
                    </select>
                  </label>
                </div>
              </Section>
            )}

            {kind === 'cross_border' && (
              <Section step={1} title="Where and how many" icon="public">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="field-label">Destination country</span>
                    <select className="field" value={form.internationalCountry} onChange={(e) => update('internationalCountry', e.target.value)}>
                      {catalog.internationalTours.map((country) => <option key={country.name} value={country.name}>{country.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Passengers</span>
                    <input type="number" min={1} max={50} className="field" value={form.passengerCount} onChange={(e) => update('passengerCount', Math.min(50, Math.max(1, Number(e.target.value) || 1)))} />
                  </label>
                </div>
                <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-semibold">
                  <input type="checkbox" checked={form.borderClearanceHelp} onChange={(e) => update('borderClearanceHelp', e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  Help at the border (+{formatPrice(catalog.rules.crossBorderProcessingFee)})
                </label>
              </Section>
            )}

            {kind === 'logistics' && (
              <Section step={1} title="Package details" icon="inventory_2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="field-label">Category</span>
                    <select className="field" value={form.packageType} onChange={(e) => update('packageType', e.target.value)}>
                      {['Document / Parcel', 'Box / Commercial goods', 'Retail & electronics', 'Heavy equipment / Freight'].map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Declared weight (kg)</span>
                    <input type="number" min={1} max={100000} className="field" value={form.packageWeightKg} onChange={(e) => update('packageWeightKg', Math.max(1, Number(e.target.value) || 1))} />
                    <span className="field-hint">{formatPrice(catalog.rules.pricePerKg)} per kg</span>
                  </label>
                  <label className="sm:col-span-2">
                    <span className="field-label">What are you sending?</span>
                    <textarea rows={3} className="field resize-none" value={form.logisticsDetails} onChange={(e) => update('logisticsDetails', e.target.value)} placeholder="What’s inside, size, if it’s fragile, and who will receive it" />
                  </label>
                </div>
                <p className="alert-info mt-5"><span className="material-symbols-outlined">gpp_maybe</span>We may check or refuse any package if we don’t know what’s inside or it isn’t legal.</p>
              </Section>
            )}

            <Section step={2} title={kind === 'car_hire' ? 'When' : 'Where and when'} icon="route">
              <div className="grid gap-4 sm:grid-cols-2">
                {kind !== 'car_hire' && (
                  <>
                    <label>
                      <span className="field-label">{kind === 'logistics' ? 'Pickup address' : 'Pickup'}</span>
                      <input className="field" value={form.pickup} onChange={(e) => update('pickup', e.target.value)} placeholder="Street, area, city" autoComplete="street-address" />
                    </label>
                    <label>
                      <span className="field-label">{kind === 'logistics' ? 'Delivery address' : 'Destination'}</span>
                      <input className="field" value={form.destination} onChange={(e) => update('destination', e.target.value)} placeholder="Street, area, city" />
                    </label>
                  </>
                )}
                {usesRoute && !catalog.mapsEnabled && (
                  <label className="sm:col-span-2">
                    <span className="field-label">About how far? (km)</span>
                    <input type="number" min={1} max={5000} className="field" value={form.distanceKm} onChange={(e) => update('distanceKm', Math.max(1, Number(e.target.value) || 1))} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[15, 50, 120, 300, 600].map((km) => (
                        <button type="button" key={km} className="chip" data-active={form.distanceKm === km} onClick={() => update('distanceKm', km)}>{km} km</button>
                      ))}
                    </div>
                  </label>
                )}
                {usesRoute && catalog.mapsEnabled && quote?.routeMetadata && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-xl bg-surface-container px-4 py-3 text-sm font-semibold sm:col-span-2">
                    <span className="material-symbols-outlined text-primary">alt_route</span>
                    Road distance: {quote.routeMetadata.distanceText} · about {quote.routeMetadata.durationText} drive
                  </motion.p>
                )}
                <label>
                  <span className="field-label">Date</span>
                  <input type="date" min={todayIso()} className="field" value={form.date} onChange={(e) => update('date', e.target.value)} />
                  {blocked && <span className="mt-1.5 block text-xs font-semibold text-primary">We’re not taking bookings on this day. Please pick another.</span>}
                </label>
                <label>
                  <span className="field-label">Time</span>
                  <select className="field" value={form.time} onChange={(e) => update('time', e.target.value)}>
                    {TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{formatSlot(slot)}</option>)}
                  </select>
                </label>
              </div>
            </Section>

            <Section step={3} title="Your details" icon="person">
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="field-label">Full name</span><input className="field" autoComplete="name" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} /></label>
                <label><span className="field-label">Phone</span><input type="tel" className="field" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+234…" /></label>
                <label className="sm:col-span-2"><span className="field-label">Email</span><input type="email" className="field" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
                <label className="sm:col-span-2"><span className="field-label">Anything we should know? <span className="font-normal text-on-surface-variant">(optional)</span></span><textarea rows={2} className="field resize-none" value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Extra luggage, child seat, a preferred route…" /></label>
              </div>
            </Section>
          </motion.form>
        )}

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease: easeOutExpo }} className="card overflow-hidden">
            <div className="border-b border-outline bg-surface-container/60 px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Your price</p>
              <p className="mt-1 truncate font-bold">{quote?.vehicleClass || service.title}</p>
            </div>
            <div className="space-y-3 p-6 text-sm">
              {quote ? (
                <>
                  <Row label="Trip price" value={formatPrice(quote.basePrice)} />
                  {quote.extraFee > 0 && <Row label={quote.feeLabel} value={formatPrice(quote.extraFee)} />}
                  {quote.distanceKm > 0 && <Row label={quote.distanceSource === 'google_maps' ? 'Road distance' : 'Distance'} value={`${quote.distanceKm} km`} />}
                  {quote.weekendSurcharge > 0 && <Row label="Weekend surcharge" value={formatPrice(quote.weekendSurcharge)} />}
                  {quote.nightSurcharge > 0 && <Row label="Night surcharge" value={formatPrice(quote.nightSurcharge)} />}
                  <div className="flex items-baseline justify-between border-t border-outline pt-4">
                    <span className="font-bold">Total</span>
                    <span className={`text-3xl font-extrabold text-primary transition-opacity ${quoting ? 'opacity-50' : ''}`}>
                      <AnimatedNumber value={quote.total} format={(value) => formatPrice(value)} />
                    </span>
                  </div>
                  {displayCurrency !== 'NGN' && <p className="text-right text-xs text-on-surface-variant">That’s {formatPrice(quote.total, 'NGN')} in naira</p>}
                </>
              ) : quoting ? (
                <div className="space-y-3"><div className="skeleton h-4" /><div className="skeleton h-4 w-2/3" /><div className="skeleton mt-4 h-9 w-1/2" /></div>
              ) : (
                <p className="text-on-surface-variant">
                  {quoteError || (usesRoute && catalog?.mapsEnabled ? 'Enter where you’re going from and to, and we’ll show the price.' : 'Pick your options to see the price.')}
                </p>
              )}
              {quoting && quote && <p className="flex items-center gap-2 text-xs text-on-surface-variant"><Spinner className="h-3 w-3" /> Updating price…</p>}
            </div>
            <div className="space-y-3 border-t border-outline p-6">
              <AnimatePresence>{formError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert-error text-xs" role="alert">{formError}</motion.p>}</AnimatePresence>
              <button type="button" onClick={() => void submit()} disabled={submitting || !catalog} className="btn-primary btn-lg w-full">
                {submitting ? <><Spinner /> Creating booking…</> : user ? <>Continue to payment <span className="material-symbols-outlined text-lg">arrow_forward</span></> : 'Sign in to book'}
              </button>
              <button type="button" onClick={whatsappOrder} className="btn w-full bg-[#25D366] text-white hover:brightness-95">
                <span className="material-symbols-outlined text-lg">chat</span> Order on WhatsApp
              </button>
            </div>
          </motion.div>
          <ul className="mt-6 space-y-2 px-2 text-xs text-on-surface-variant">
            {['The price you see is the price you pay', 'You get a tracking number straight away', 'Checked drivers and insured cars'].map((item) => (
              <li key={item} className="flex items-center gap-2"><span className="material-symbols-outlined text-base text-success">verified</span>{item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-on-surface-variant">{label}</span>
      <span className="shrink-0 font-semibold">{value}</span>
    </div>
  );
}
