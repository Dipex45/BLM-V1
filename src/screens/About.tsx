import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { company, defaultVehicles } from '../lib/company';
import { useCurrency } from '../hooks/useCurrency';

const steps = [
  { title: 'Choose the route', desc: 'Select pickup, destination, travel date, and any notes for the driver or logistics desk.' },
  { title: 'Pick a service', desc: 'Book city transport, interstate movement, cross-border travel, touring, car hire, or pickup logistics.' },
  { title: 'Pay securely', desc: 'Complete checkout with Paystack or Stripe and keep the payment reference attached to your booking.' },
  { title: 'Track the movement', desc: 'Follow booking status, driver assignment, payment state, and updates from your dashboard.' },
];

export default function About() {
  const { formatPrice } = useCurrency();

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden bg-black text-white">
        <img
          src={company.heroImage}
          alt="BLM Motors transport service flyer"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/78 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col justify-end px-4 pb-8 pt-20 md:px-8 lg:px-12">
          <div className="max-w-3xl pb-8">
            <motion.img
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              src={company.logo}
              alt="BLM Motors logo"
              className="mb-6 h-20 w-44 object-contain"
            />
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 text-sm font-bold uppercase tracking-[0.24em] text-primary"
            >
              Nigerian transport company
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="text-4xl font-black leading-none text-white sm:text-5xl md:text-7xl"
            >
              Transport, touring, car hire, and cross-border trips.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/86 md:text-lg"
            >
              {company.summary}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link to="/booking" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-container">
                Book now
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
              <a href={`https://wa.me/${company.whatsapp.replace('+', '')}`} className="inline-flex items-center justify-center rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-on-surface">
                WhatsApp {company.whatsappDisplay}
              </a>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-white/20 pt-5 sm:grid-cols-3">
            {company.qualities.map((quality) => (
              <div key={quality} className="flex items-center gap-3 rounded-md bg-white/10 p-4 backdrop-blur">
                <span className="material-symbols-outlined text-primary">verified</span>
                <p className="text-sm font-black uppercase tracking-[0.18em]">{quality}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-bold text-primary">Our services</p>
            <h2 className="text-3xl font-bold text-on-surface md:text-5xl">More than a ride, built for Nigerian movement.</h2>
            <p className="mt-5 text-base leading-7 text-on-surface-variant">
              Book transport for city runs, interstate trips, touring, cross-border travel, car hire, pickup, and logistics support.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {company.services.map((service) => (
              <article key={service.title} className="rounded-lg border border-outline bg-surface-container-lowest p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <span className="material-symbols-outlined">{service.icon}</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface">{service.title}</h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{service.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface-container px-4 py-16 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-bold text-primary">Routes from the flyers</p>
            <h2 className="text-3xl font-bold text-on-surface md:text-5xl">Nigeria, Benin Republic, Togo, and Ghana.</h2>
            <p className="mt-5 text-base leading-7 text-on-surface-variant">
              The platform keeps every booking tied to a route, payment status, driver update, and customer record.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {company.routes.map((route) => (
                <span key={route} className="rounded-md border border-outline bg-white px-4 py-2 text-sm font-bold text-on-surface">
                  {route}
                </span>
              ))}
            </div>
          </div>
          <img
            src={company.servicesImage}
            alt="BLM Motors weekend services flyer"
            className="min-h-[420px] w-full rounded-lg border border-outline object-cover shadow-sm"
          />
        </div>
      </section>

      <section className="bg-secondary px-4 py-16 text-white md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-3 text-sm font-bold text-primary">Vehicle classes</p>
              <h2 className="text-3xl font-bold md:text-5xl">Book the vehicle that fits the job.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/68">
              Prices are listed in Nigerian naira and can be adjusted by an admin from the pricing panel.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {defaultVehicles.map((vehicle) => (
              <article key={vehicle.title} className="rounded-lg border border-white/15 bg-white/5 p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white">
                  <span className="material-symbols-outlined">{vehicle.icon}</span>
                </div>
                <div className="mb-3 flex items-start justify-between gap-4">
                  <h3 className="text-xl font-bold text-white">{vehicle.title}</h3>
                  <span className="shrink-0 text-sm font-bold text-primary">{formatPrice(vehicle.price)}</span>
                </div>
                <p className="text-sm leading-6 text-white/68">{vehicle.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-3 text-sm font-bold text-primary">How booking works</p>
            <h2 className="text-3xl font-bold text-on-surface md:text-5xl">A complete record from quote to review.</h2>
            <p className="mt-5 text-base leading-7 text-on-surface-variant">
              The system records each booking, payment reference, cancellation, driver update, support message, and customer review.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-lg border border-outline bg-surface-container-lowest p-6">
                <p className="mb-4 text-sm font-bold text-primary">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="text-lg font-bold text-on-surface">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{step.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary px-4 py-16 text-white md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold md:text-5xl">Ready to move?</h2>
            <p className="mt-4 text-base leading-7 text-white/82">
              Call {company.phoneDisplay}, WhatsApp {company.whatsappDisplay}, or book online.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/booking" className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-container">
              Book now
            </Link>
            <Link to="/tracking" className="inline-flex items-center justify-center rounded-md border border-white/45 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-primary">
              Track booking
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
