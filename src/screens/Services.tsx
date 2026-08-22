import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { company, defaultVehicles } from '../lib/company';
import { useCurrency } from '../hooks/useCurrency';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function Services() {
  const { formatPrice } = useCurrency();
  const [vehicles, setVehicles] = useState<any[]>(defaultVehicles);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'vehicle_types'));
        if (snap.exists() && Array.isArray(snap.data().value) && snap.data().value.length > 0) {
          setVehicles(snap.data().value);
        }
      } catch (e) {
        console.warn('Using default vehicles');
      }
    };
    fetchPrices();
  }, []);

  const getServiceStartingPrice = (serviceTitle: string, defaultVehicleClass?: string) => {
    const target = (defaultVehicleClass || serviceTitle).toLowerCase();
    const matched = vehicles.find((v) => v.title.toLowerCase().includes(target) || target.includes(v.title.toLowerCase()));
    if (matched) return formatPrice(matched.price);
    if (target.includes('cross-border')) return formatPrice(180000);
    if (target.includes('touring')) return formatPrice(90000);
    if (target.includes('car hire')) return formatPrice(70000);
    if (target.includes('pickup') || target.includes('logistics')) return formatPrice(65000);
    return formatPrice(25000);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-secondary px-4 pb-20 pt-12 text-white sm:px-6 md:px-8 lg:px-12">
        <img
          src={company.servicesImage}
          alt="BLM Motors transport service vehicle"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/45" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="max-w-3xl"
          >
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Our services & fleet
            </p>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl md:text-6xl">
              Everything you need to move across Nigeria and beyond.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/80 md:text-lg">
              {company.summary}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Link
              to="/services/long-and-short-distance-trips"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-lg">event_available</span>
              Start secure booking
            </Link>
            <a
              href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-8 py-4 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <span className="material-symbols-outlined text-lg">chat</span>
              WhatsApp Us
            </a>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="bg-white px-4 py-20 sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="mb-14 max-w-2xl"
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Choose a service</p>
            <h2 className="text-3xl font-bold leading-tight text-on-surface sm:text-4xl">
              Select your service to view options and pricing.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
              Every service includes its live price breakdown, customizable route options, and instant payment checkout.
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
              <motion.div key={service.title} variants={cardVariants}>
                <Link
                  to={`/services/${slugify(service.title)}`}
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-outline bg-surface-container-lowest p-7 shadow-sm transition-colors duration-200 hover:border-primary"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 mb-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-white">
                        <span className="material-symbols-outlined text-2xl">{service.icon}</span>
                      </div>
                      <span className="max-w-full rounded-full bg-primary/10 px-3.5 py-1 text-center text-xs font-bold leading-relaxed text-primary">
                        From {getServiceStartingPrice(service.title, (service as any).vehicleClass)}
                      </span>
                    </div>
                    <h3 className="break-words text-xl font-bold leading-tight text-on-surface transition-colors group-hover:text-primary">
                      {service.title}
                    </h3>
                    <p className="mt-3 break-words text-sm leading-relaxed text-on-surface-variant">{service.desc}</p>
                  </div>
                  <div className="mt-8 flex min-w-0 items-center gap-2 text-sm font-bold text-primary">
                    <span className="break-words">Order This Service</span>
                    <span className="material-symbols-outlined text-base transition-transform duration-300 group-hover:translate-x-1.5">
                      arrow_forward
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Routes Coverage */}
      <section className="bg-surface-container px-4 py-20 sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 max-w-2xl"
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Coverage area</p>
            <h2 className="text-3xl font-bold text-on-surface sm:text-4xl">
              We cover Nigeria and West Africa.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
              Cross-border and interstate routes connecting major cities and hubs.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="flex flex-wrap gap-3"
          >
            {company.routes.map((route, i) => (
              <motion.span
                key={route}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="max-w-full break-words rounded-lg border border-outline bg-white px-5 py-3 text-sm font-bold text-on-surface shadow-sm transition-colors duration-200 hover:border-primary"
              >
                {route}
              </motion.span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          >
            {company.hubs.slice(0, 6).map((hub) => (
              <div key={hub.name} className="min-w-0 rounded-xl border border-outline bg-white p-4 text-center shadow-sm">
                <span className="material-symbols-outlined mb-2 text-2xl text-primary">location_on</span>
                <p className="break-words text-sm font-bold text-on-surface">{hub.name}</p>
                <p className="mt-1 break-words text-xs text-on-surface-variant">{hub.address}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary px-4 py-16 text-white sm:px-6 md:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center"
        >
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold sm:text-4xl">Ready to book?</h2>
            <p className="mt-3 text-base leading-relaxed text-white/90">
              Choose any service above or contact us directly for a custom quote.
            </p>
          </div>
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
            <a
              href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              WhatsApp
            </a>
            <a
              href="#services"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-4 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
            >
              Choose service
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
