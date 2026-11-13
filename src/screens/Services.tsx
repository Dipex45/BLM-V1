import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { company } from '../lib/company';
import { serviceSlug } from '../lib/catalog';
import { serviceStartingPrice } from '../lib/bookingPricing';
import { useCatalog } from '../hooks/useCatalog';
import { useCurrency } from '../contexts/CurrencyContext';
import { useLocale } from '../contexts/LocaleContext';
import { easeOutExpo, fadeUp, Reveal, Stagger, StaggerItem } from '../components/ui/motion';

export default function Services() {
  const { catalog, error, reload } = useCatalog();
  const { formatPrice } = useCurrency();
  const { t } = useLocale();

  return (
    <div className="overflow-x-hidden">
      <section className="relative isolate overflow-hidden bg-secondary text-white">
        <motion.img src={company.servicesImage} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease: easeOutExpo }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/85 to-black/40" />
        <div className="hero-grid absolute inset-0 -z-10" />
        <div className="container-page py-20 sm:py-28">
          <motion.div initial="hidden" animate="show" variants={fadeUp} className="max-w-3xl">
            <p className="eyebrow">Our services</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] sm:text-6xl">Get around Nigeria and West Africa with one booking.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">{company.summary}</p>
          </motion.div>
        </div>
      </section>

      <section className="container-page py-20">
        <Reveal className="mb-12 max-w-2xl">
          <p className="eyebrow">{t('chooseService')}</p>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">{t('serviceHeading')}</h2>
          <p className="mt-4 text-on-surface-variant">{t('serviceBody')}</p>
        </Reveal>

        {error && (
          <div className="alert-error mb-8">
            <span className="material-symbols-outlined">cloud_off</span>
            <span className="flex-1">{error}</span>
            <button type="button" onClick={reload} className="font-bold underline">Retry</button>
          </div>
        )}

        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {company.services.map((service, index) => {
            const start = catalog ? serviceStartingPrice(service.kind, catalog) : null;
            return (
              <StaggerItem key={service.title} className={index === 0 ? 'lg:row-span-2' : ''}>
                <Link to={`/services/${serviceSlug(service.title)}`} className="card card-hover group flex h-full flex-col p-7">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary transition-all duration-300 group-hover:rotate-[-6deg] group-hover:bg-primary group-hover:text-white">
                      <span className="material-symbols-outlined text-2xl">{service.icon}</span>
                    </span>
                    <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface">
                      {start ? <>From {formatPrice(start.amount)}{start.suffix}</> : <span className="skeleton inline-block h-3 w-20 align-middle" />}
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-bold group-hover:text-primary">{service.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-on-surface-variant">{service.desc}</p>
                  {index === 0 && catalog && (
                    <ul className="mt-6 space-y-2 border-t border-outline pt-5 text-sm">
                      {catalog.vehicles.filter((vehicle) => Number(vehicle.kmRate) > 0).map((vehicle) => (
                        <li key={vehicle.title} className="flex items-center justify-between">
                          <span className="font-semibold">{vehicle.title}</span>
                          <span className="text-on-surface-variant">{formatPrice(Number(vehicle.kmRate))}/km</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-primary">
                    See price and book
                    <span className="material-symbols-outlined text-base transition-transform duration-300 group-hover:translate-x-1.5">arrow_forward</span>
                  </span>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <section className="border-y border-outline bg-white py-20">
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="eyebrow">Where we go</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Routes and pickup points.</h2>
            <p className="mt-4 text-on-surface-variant">We connect the main cities in Nigeria and the countries next door.</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {(catalog?.routes || company.routes).map((route) => <span key={route} className="chip">{route}</span>)}
            </div>
          </Reveal>
          <Stagger className="grid gap-3 sm:grid-cols-2">
            {(catalog?.hubs || []).map((hub) => (
              <StaggerItem key={hub.name} className="flex gap-3 rounded-2xl border border-outline p-4">
                <span className="material-symbols-outlined text-primary">location_on</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{hub.name}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{hub.address}</p>
                </div>
              </StaggerItem>
            ))}
            {!catalog && !error && [0, 1, 2, 3].map((key) => <div key={key} className="skeleton h-20" />)}
          </Stagger>
        </div>
      </section>

      <section className="container-page py-20">
        <Reveal className="relative overflow-hidden rounded-3xl bg-primary px-8 py-14 text-white sm:px-14">
          <div className="hero-grid absolute inset-0" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">Need something different?</h2>
              <p className="mt-3 max-w-xl text-white/85">Message us on WhatsApp for group trips, events or a special route.</p>
            </div>
            <a href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`} target="_blank" rel="noreferrer" className="btn btn-lg bg-white text-primary hover:bg-white/90">
              <span className="material-symbols-outlined">chat</span> Chat with us
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
