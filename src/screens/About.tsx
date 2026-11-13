import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { company } from '../lib/company';
import { serviceSlug } from '../lib/catalog';
import { serviceStartingPrice } from '../lib/bookingPricing';
import { apiErrorMessage, apiPost } from '../lib/api';
import { useCatalog } from '../hooks/useCatalog';
import { useCurrency } from '../contexts/CurrencyContext';
import { easeOutExpo, Reveal, Spinner, Stagger, StaggerItem } from '../components/ui/motion';

const whatsappUrl = `https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`;

const steps = [
  { icon: 'touch_app', title: 'Choose a service', desc: 'Transport, touring, car hire, cross-border or pickup.' },
  { icon: 'request_quote', title: 'See the price', desc: 'We work out the exact price from today’s rates and the real road distance.' },
  { icon: 'lock', title: 'Pay safely', desc: 'Pay by card, Paystack or bank transfer.' },
  { icon: 'my_location', title: 'Follow your trip', desc: 'You get a tracking number straight away and can see each update as it happens.' },
];

export default function About() {
  const { catalog } = useCatalog();
  const { formatPrice } = useCurrency();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const [email, setEmail] = useState('');
  const [newsletter, setNewsletter] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; message?: string }>({ state: 'idle' });

  const subscribe = async (event: FormEvent) => {
    event.preventDefault();
    setNewsletter({ state: 'busy' });
    try {
      await apiPost('/api/newsletter', { email: email.trim() });
      setNewsletter({ state: 'done', message: 'Thanks! You’re signed up.' });
      setEmail('');
    } catch (error) {
      setNewsletter({ state: 'error', message: apiErrorMessage(error, 'We couldn’t sign you up. Please try again.') });
    }
  };

  const headline = ['Travel', 'across', 'West', 'Africa', 'with', 'confidence.'];

  return (
    <div className="overflow-x-hidden">
      <section ref={heroRef} className="relative isolate min-h-[calc(100svh-5rem)] overflow-hidden bg-black text-white">
        <motion.img src={company.heroImage} alt="BLM Motors fleet" style={{ y: imageY }} className="absolute inset-0 -z-10 h-[118%] w-full object-cover opacity-70" initial={{ scale: 1.1 }} animate={{ scale: 1 }} transition={{ duration: 1.8, ease: easeOutExpo }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/75 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black to-transparent" />
        <div className="hero-grid absolute inset-0 -z-10" />

        <motion.div style={{ opacity: contentOpacity }} className="container-page flex min-h-[calc(100svh-5rem)] flex-col justify-center py-20">
          <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary" /><span className="relative h-2 w-2 rounded-full bg-primary" /></span>
            Open 24 hours, every day
          </motion.span>
          <h1 className="mt-6 max-w-4xl text-5xl font-extrabold leading-[1.02] sm:text-7xl">
            {headline.map((word, index) => (
              <motion.span key={word} className="mr-[0.25em] inline-block" initial={{ opacity: 0, y: 40, rotateX: -40 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.15 + index * 0.07, duration: 0.8, ease: easeOutExpo }}>
                {word === 'confidence.' ? <span className="text-primary">{word}</span> : word}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.8, ease: easeOutExpo }} className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
            {company.summary}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.8, ease: easeOutExpo }} className="mt-10 flex flex-wrap gap-3">
            <Link to="/services" className="btn-primary btn-lg">Book a trip <span className="material-symbols-outlined">arrow_forward</span></Link>
            <Link to="/tracking" className="btn btn-lg border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20">Track a booking</Link>
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.8 }} className="mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/15 pt-8">
            {[['24/7', 'Always open'], ['4', 'Countries'], ['5', 'Services']].map(([value, label]) => (
              <div key={label}><dt className="text-sm text-white/55">{label}</dt><dd className="mt-1 text-3xl font-extrabold">{value}</dd></div>
            ))}
          </motion.dl>
        </motion.div>
      </section>

      <div className="overflow-hidden border-y border-outline bg-white py-5" aria-hidden="true">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap text-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant">
          {[...Array(2)].flatMap((_, copy) => (catalog?.routes || company.routes).map((route) => (
            <span key={`${copy}-${route}`} className="flex items-center gap-12">{route}<span className="h-1.5 w-1.5 rounded-full bg-primary" /></span>
          )))}
        </div>
      </div>

      <section className="container-page py-24">
        <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">What we do</p>
            <h2 className="mt-3 text-4xl font-extrabold sm:text-5xl">Everything you need to get around, in one place.</h2>
          </div>
          <Link to="/services" className="btn-outline">All services</Link>
        </Reveal>
        <Stagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {company.services.map((service) => {
            const start = catalog ? serviceStartingPrice(service.kind, catalog) : null;
            return (
              <StaggerItem key={service.title}>
                <Link to={`/services/${serviceSlug(service.title)}`} className="card card-hover group flex h-full flex-col p-6">
                  <span className="material-symbols-outlined text-3xl text-primary transition-transform duration-300 group-hover:-translate-y-1">{service.icon}</span>
                  <h3 className="mt-6 text-lg font-bold">{service.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-on-surface-variant">{service.desc}</p>
                  <p className="mt-6 text-sm font-bold">{start ? <>From <span className="text-primary">{formatPrice(start.amount)}</span>{start.suffix}</> : <span className="skeleton inline-block h-4 w-24" />}</p>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <section className="bg-secondary py-24 text-white">
        <div className="container-page grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 text-4xl font-extrabold sm:text-5xl">Book in four simple steps.</h2>
            <ol className="mt-10 space-y-6">
              {steps.map((step, index) => (
                <motion.li key={step.title} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1, duration: 0.6, ease: easeOutExpo }} className="flex gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><span className="material-symbols-outlined text-primary">{step.icon}</span></span>
                  <div><p className="font-bold">{index + 1}. {step.title}</p><p className="mt-1 text-sm text-white/65">{step.desc}</p></div>
                </motion.li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={0.1} className="relative">
            <img src={company.transportHeroImage} alt="BLM vehicle on a cross-border route" className="aspect-[4/5] w-full rounded-3xl object-cover" loading="lazy" />
            <motion.div className="card absolute -bottom-6 left-6 right-6 flex items-center gap-4 p-5 text-on-surface sm:left-auto sm:w-72" animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><span className="material-symbols-outlined">verified_user</span></span>
              <div><p className="text-sm font-bold">Checked drivers</p><p className="text-xs text-on-surface-variant">Every driver is licensed and approved by us</p></div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      <section className="container-page py-24">
        <Reveal className="card grid gap-10 overflow-hidden p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Get news and offers.</h2>
            <p className="mt-3 text-on-surface-variant">New routes, holiday times and tour deals. Just a few emails a month.</p>
          </div>
          <form onSubmit={subscribe}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="newsletter-email">Email address</label>
              <input id="newsletter-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="field flex-1" />
              <button type="submit" disabled={newsletter.state === 'busy'} className="btn-primary">{newsletter.state === 'busy' ? <Spinner /> : 'Subscribe'}</button>
            </div>
            {newsletter.message && <p className={`mt-3 text-sm font-semibold ${newsletter.state === 'error' ? 'text-primary' : 'text-success'}`} role="status">{newsletter.message}</p>}
          </form>
        </Reveal>
      </section>

      <section className="container-page pb-24">
        <Reveal className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-white sm:px-14">
          <div className="hero-grid absolute inset-0" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-4xl font-extrabold">Ready to move?</h2>
              <p className="mt-3 text-white/85">Call <a href={`tel:${company.phone}`} className="font-bold underline">{company.phoneDisplay}</a> or book online in a few minutes.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/services" className="btn btn-lg bg-white text-primary hover:bg-white/90">Book now</Link>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-lg border border-white/40 text-white hover:bg-white/10">WhatsApp</a>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
