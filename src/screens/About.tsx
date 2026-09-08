import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { company, defaultVehicles } from '../lib/company';
import { useCurrency } from '../hooks/useCurrency';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';


const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const steps = [
  { title: 'Choose the route', desc: 'Select pickup, destination, travel date, and any notes for the driver or logistics desk.' },
  { title: 'Pick a service', desc: 'Book city transport, interstate movement, cross-border travel, touring, car hire, or pickup logistics.' },
  { title: 'Pay securely', desc: 'Complete checkout with Paystack or Stripe and keep the payment reference attached to your booking.' },
  { title: 'Track the movement', desc: 'Follow booking status, driver assignment, payment state, and updates from your dashboard.' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function About() {
  const { formatPrice } = useCurrency();
  const [vehicles, setVehicles] = useState<any[]>(defaultVehicles);
  const [routes, setRoutes] = useState<string[]>(company.routes);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

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
        const routesSnap = await getDoc(doc(db, 'settings', 'routes'));
        if (routesSnap.exists() && Array.isArray(routesSnap.data().value) && routesSnap.data().value.length > 0) {
          setRoutes(routesSnap.data().value);
        }
      } catch (e) {
        console.warn('Using default routes');
      }
    };

    fetchAdminSettings();
  }, []);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus('loading');
    try {
      await addDoc(collection(db, 'newsletters'), {
        email: newsletterEmail.trim(),
        createdAt: new Date().toISOString(),
        status: 'subscribed',
        forwardToAdmin: company.email,
      });
      setNewsletterStatus('success');
      setNewsletterEmail('');
    } catch (err) {
      console.error('Newsletter subscription error', err);
      setNewsletterStatus('error');
    }
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden bg-black text-white">
        <img
          src={company.heroImage}
          alt="BLM Motors transport fleet"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/35" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 md:px-8 lg:px-12">
          <div className="max-w-3xl pb-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-block"
            >
              <img
                src={company.logo}
                alt="BLM Motors logo"
                className="h-20 w-60 object-contain sm:h-24 sm:w-72 md:h-28 md:w-80 [filter:drop-shadow(0_0_15px_rgba(255,255,255,1))_drop-shadow(0_0_35px_rgba(255,255,255,0.9))_drop-shadow(0_0_60px_rgba(255,255,255,0.6))]"
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-4 text-xs sm:text-sm font-bold uppercase tracking-[0.24em] text-primary"
            >
              Nigerian transport & logistics leader
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-4xl font-black leading-tight text-white sm:text-5xl md:text-7xl"
            >
              Transport, touring, car hire, and cross-border trips.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/90 md:text-lg"
            >
              {company.summary}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <a
                href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`}
                className="inline-flex items-center justify-center gap-3 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:scale-105 hover:bg-primary-container"
              >
                <span className="material-symbols-outlined text-lg">chat</span>
                WhatsApp
              </a>
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/15 px-8 py-4 text-sm font-bold text-white backdrop-blur transition-all hover:scale-105 hover:bg-white hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">event_available</span>
                Book a service
              </Link>
              <Link
                to="/tracking"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/40 px-6 py-4 text-sm font-bold text-white transition-all hover:bg-white/20"
              >
                Track booking
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="grid grid-cols-1 gap-3 border-t border-white/20 pt-6 sm:grid-cols-3"
          >
            {company.qualities.map((quality) => (
              <div key={quality} className="flex items-center gap-3.5 rounded-xl bg-white/10 p-4 backdrop-blur transition-colors hover:bg-white/15">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <span className="material-symbols-outlined text-xl">verified</span>
                </div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white">{quality}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="scroll-mt-24 bg-white px-4 py-20 sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="mb-12 max-w-3xl"
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Our services</p>
            <h2 className="text-3xl font-bold leading-tight text-on-surface sm:text-4xl md:text-5xl">
              More than a ride, built for Nigerian movement.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-on-surface-variant md:text-lg">
              Click any service below to order directly with custom route, date, vehicle, and instant pricing.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {company.services.map((service) => (
              <motion.div key={service.title} variants={itemVariants}>
                <Link
                  to={`/services/${slugify(service.title)}`}
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-outline bg-surface-container-lowest p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary hover:shadow-xl hover:shadow-primary/10"
                >
                  <div>
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                      <span className="material-symbols-outlined text-2xl">{service.icon}</span>
                    </div>
                    <h3 className="text-xl font-bold text-on-surface transition-colors group-hover:text-primary">
                      {service.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{service.desc}</p>
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-sm font-bold text-primary">
                    <span>Order This Service</span>
                    <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Route Overview Section */}
      <section className="bg-surface-container px-4 py-20 sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Cross-border & Interstate</p>
            <h2 className="text-3xl font-bold text-on-surface sm:text-4xl md:text-5xl">
              Nigeria, Benin Republic, Togo, and Ghana.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-on-surface-variant md:text-lg">
              The platform keeps every booking tied to a route, payment status, driver update, and customer record.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {routes.map((route) => (
                <span
                  key={route}
                  className="rounded-xl border border-outline bg-white px-4 py-2.5 text-sm font-bold text-on-surface shadow-sm transition-transform hover:scale-105"
                >
                  {route}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-2xl border border-outline shadow-xl"
          >
            <img
              src={company.transportHeroImage}
              alt="BLM Motors transport vehicle in motion"
              className="min-h-[380px] w-full object-cover object-center transition-transform duration-500 hover:scale-105"
            />
          </motion.div>
        </div>
      </section>




      
      {/* How Booking Works */}
      <section className="bg-white px-4 py-20 sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">How booking works</p>
            <h2 className="text-3xl font-bold text-on-surface sm:text-4xl md:text-5xl">
              A complete record from quote to review.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-on-surface-variant md:text-lg">
              The system records each booking, payment reference, cancellation, driver update, support message, and customer review.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {steps.map((step, index) => (
              <motion.article
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="rounded-2xl border border-outline bg-surface-container-lowest p-6 shadow-sm"
              >
                <p className="mb-4 text-xs font-black text-primary">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="text-lg font-bold text-on-surface">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{step.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Subscription Section */}
      <section className="border-t border-outline bg-surface-container-lowest px-4 py-16 sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-outline bg-white p-8 shadow-xl shadow-black/5 md:p-14">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary mb-4">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  Exclusive offers & touring events
                </span>
                <h2 className="text-3xl font-bold text-on-surface sm:text-4xl">
                  Stay updated on discounts, weekend getaways & cross-border tours.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
                  Subscribe to receive early notifications on special touring bonuses, discount codes, and new vehicle fleet arrivals directly to your inbox.
                </p>
              </div>

              <div>
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email address..."
                    className="flex-1 rounded-xl border border-outline bg-surface-container px-5 py-4 text-sm font-semibold text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === 'loading'}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:bg-primary-container disabled:opacity-50"
                  >
                    {newsletterStatus === 'loading' ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>Subscribe</span>
                        <span className="material-symbols-outlined text-base">send</span>
                      </>
                    )}
                  </button>
                </form>

                {newsletterStatus === 'success' && (
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 text-sm font-bold text-green-600">
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    You're subscribed! We've registered your email for upcoming bonuses and events.
                  </motion.p>
                )}

                {newsletterStatus === 'error' && (
                  <p className="mt-3 flex items-center gap-2 text-sm font-bold text-primary">
                    <span className="material-symbols-outlined text-lg">error</span>
                    Unable to subscribe at the moment. Please try again.
                  </p>
                )}
                <p className="mt-3 text-xs text-on-surface-variant">We respect your privacy. Unsubscribe at any time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ready to Move CTA */}
      <section className="bg-primary px-4 py-20 text-white sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">Ready to move?</h2>
            <p className="mt-4 text-base leading-relaxed text-white/90 md:text-lg">
              Call{' '}
              <a href={`tel:${company.phone}`} className="font-bold text-white underline decoration-white/50 hover:decoration-white">
                {company.phoneDisplay}
              </a>{' '}
              or message us on WhatsApp.
            </p>
          </div>
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
            <a
              href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/10 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              WhatsApp
            </a>
            <Link
              to="/services"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-bold text-primary transition-all hover:bg-surface-container"
            >
              View services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
