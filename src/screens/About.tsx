import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const stats = [
  { value: '12', label: 'regional hubs' },
  { value: '250+', label: 'vehicles and partner units' },
  { value: '24/7', label: 'dispatch support' },
  { value: '99.9%', label: 'completed delivery rate' },
];

const services = [
  {
    icon: 'local_shipping',
    title: 'Scheduled deliveries',
    desc: 'Same-day and planned routes for parcels, documents, retail stock, and business supplies.',
  },
  {
    icon: 'directions_car',
    title: 'Private transport',
    desc: 'Clean, tracked vehicles for airport transfers, business travel, and point-to-point trips.',
  },
  {
    icon: 'warehouse',
    title: 'Depot coordination',
    desc: 'Pickup, consolidation, and handoff support through Johannesburg, Cape Town, Durban, and Pretoria.',
  },
  {
    icon: 'support_agent',
    title: 'Live operations desk',
    desc: 'A real dispatch team keeps customers updated before, during, and after the trip.',
  },
];

const steps = [
  { title: 'Tell us the route', desc: 'Add the pickup, destination, date, and any handling notes.' },
  { title: 'Choose the right vehicle', desc: 'Pick the vehicle class that fits the load, timing, and budget.' },
  { title: 'Confirm the booking', desc: 'Review the quote, pay securely, and receive your booking reference.' },
  { title: 'Track the job', desc: 'Follow the driver status and delivery updates from your dashboard.' },
];

const fleet = [
  {
    name: 'Executive sedan',
    price: 'From R850',
    img: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=85&w=1000',
    desc: 'Airport transfers, business trips, and private transport.',
  },
  {
    name: 'Cargo truck',
    price: 'From R2500',
    img: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=85&w=1000',
    desc: 'Bulk freight, store replenishment, and regional deliveries.',
  },
  {
    name: 'Delivery van',
    price: 'From R450',
    img: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=85&w=1000',
    desc: 'Fast local runs for parcels, documents, and small business stock.',
  },
];

const testimonials = [
  {
    name: 'John D.',
    company: 'Apex Tech',
    text: 'BLM handled our supplier run with clear updates and no chasing from our side.',
  },
  {
    name: 'Sarah M.',
    company: 'Kruger Distro',
    text: 'The booking flow is simple, and the operations team calls when something needs attention.',
  },
  {
    name: 'David L.',
    company: 'Private client',
    text: 'Professional drivers, clean vehicles, and accurate arrival windows. That is all I wanted.',
  },
];

export default function About() {
  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-hidden">
      <section className="relative min-h-[calc(100vh-8rem)] overflow-hidden bg-secondary text-white">
        <img
          src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=85&w=2200"
          alt="BLM Motors delivery truck on the road"
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-8rem)] max-w-7xl flex-col justify-end px-4 pb-7 pt-16 md:px-8 lg:px-12">
          <div className="max-w-3xl pb-8">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 text-sm font-semibold text-white/80"
            >
              Based in Johannesburg. Moving people and goods across South Africa.
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="text-5xl font-bold leading-none text-white md:text-6xl"
            >
              BLM Motors & Elite Logistics
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 max-w-2xl text-base leading-7 text-white/88 md:text-lg"
            >
              Practical transport for freight, business travel, and scheduled deliveries, backed by a dispatch team that keeps the job moving.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link to="/booking" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-container">
                Book transport
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
              <Link to="/tracking" className="inline-flex items-center justify-center rounded-md border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-on-surface">
                Track a delivery
              </Link>
            </motion.div>
          </div>

          <dl className="grid grid-cols-2 border-t border-white/25 pt-5 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="pr-6 py-2">
                <dt className="text-3xl font-bold text-white md:text-4xl">{stat.value}</dt>
                <dd className="mt-1 text-sm text-white/72">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-white px-4 pb-20 pt-6 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <p className="mb-3 text-sm font-bold text-primary">What we handle</p>
            <h2 className="text-3xl font-bold text-on-surface md:text-5xl">Useful logistics without the theatre.</h2>
            <p className="mt-5 text-base leading-7 text-on-surface-variant">
              Customers come to BLM for straightforward transport: clear quotes, reliable drivers, and updates that do not need decoding.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => (
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

      <section className="bg-surface-container py-20 px-4 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-bold text-primary">How booking works</p>
            <h2 className="text-3xl font-bold text-on-surface md:text-5xl">Four steps, no mystery.</h2>
            <p className="mt-5 text-base leading-7 text-on-surface-variant">
              The booking flow is built for people who need a trip confirmed quickly and want the details written down.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-lg border border-outline bg-white p-6">
                <p className="mb-4 text-sm font-bold text-primary">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="text-lg font-bold text-on-surface">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{step.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary py-20 px-4 text-white md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-3 text-sm font-bold text-primary">Fleet options</p>
              <h2 className="text-3xl font-bold md:text-5xl">Right-sized vehicles for the work.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/68">
              Vehicle availability changes by city and date. The booking form shows the active options and starting rates.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {fleet.map((vehicle) => (
              <article key={vehicle.name} className="overflow-hidden rounded-lg border border-white/15 bg-white/5">
                <img
                  src={vehicle.img}
                  alt={vehicle.name}
                  className="h-60 w-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="p-6">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <h3 className="text-xl font-bold text-white">{vehicle.name}</h3>
                    <span className="shrink-0 text-sm font-bold text-primary">{vehicle.price}</span>
                  </div>
                  <p className="text-sm leading-6 text-white/68">{vehicle.desc}</p>
                  <Link to="/booking" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white hover:text-primary">
                    Check availability
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 px-4 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <p className="mb-3 text-sm font-bold text-primary">Operations</p>
            <h2 className="text-3xl font-bold text-on-surface md:text-5xl">Human dispatch with useful tracking.</h2>
            <p className="mt-5 text-base leading-7 text-on-surface-variant">
              Tracking is there to reduce follow-up calls, not replace the team. If a driver is delayed, the operations desk can see it and respond before it becomes a bigger problem.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                'Driver and vehicle assignment',
                'Pickup and delivery status updates',
                'Route notes for special handling',
                'Customer support after booking',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-outline bg-surface-container p-4">
                  <span className="material-symbols-outlined mt-0.5 text-primary">check_circle</span>
                  <p className="text-sm font-semibold leading-6 text-on-surface">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 overflow-hidden rounded-lg border border-outline lg:order-2">
            <img
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=85&w=1300"
              alt="Warehouse staff coordinating delivery work"
              className="h-full min-h-[420px] w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      <section className="bg-surface-container py-20 px-4 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <p className="mb-3 text-sm font-bold text-primary">Customer notes</p>
            <h2 className="text-3xl font-bold text-on-surface md:text-5xl">The kind of feedback that matters.</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <article key={testimonial.name} className="rounded-lg border border-outline bg-white p-6">
                <div className="mb-5 flex text-primary" aria-label="5 out of 5 stars">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="material-symbols-outlined text-base">star</span>
                  ))}
                </div>
                <p className="text-base leading-7 text-on-surface">"{testimonial.text}"</p>
                <div className="mt-6 border-t border-outline pt-5">
                  <h3 className="text-sm font-bold text-on-surface">{testimonial.name}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">{testimonial.company}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary px-4 py-16 text-white md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold md:text-5xl">Ready to move something?</h2>
            <p className="mt-4 text-base leading-7 text-white/82">
              Start with the route and date. We will show the available vehicles and the expected total before checkout.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/booking" className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-container">
              Book transport
            </Link>
            <Link to="/tracking" className="inline-flex items-center justify-center rounded-md border border-white/45 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-primary">
              Track delivery
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
