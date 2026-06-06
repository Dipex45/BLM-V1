import { Link } from 'react-router-dom';
import { company } from '../lib/company';

export default function Footer() {
  return (
    <footer className="z-50 mt-auto border-t border-outline-variant bg-white px-4 py-10 md:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 md:grid-cols-4">
        <div className="min-w-0 md:col-span-2">
          <img src={company.logo} alt="BLM Motors logo" className="mb-4 h-20 w-44 object-contain" />
          <p className="safe-text mb-8 max-w-lg text-sm font-medium leading-relaxed text-on-surface-variant">
            {company.summary}
          </p>
          <div className="mb-8 grid gap-3 text-sm font-semibold text-secondary sm:grid-cols-2">
            <a href={`tel:${company.beninPhone}`} className="flex min-w-0 items-center gap-3 hover:text-primary">
              <span className="material-symbols-outlined shrink-0 text-lg text-primary">call</span>
              <span className="safe-text">{company.beninPhoneDisplay}</span>
            </a>
            <a href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`} className="flex min-w-0 items-center gap-3 hover:text-primary">
              <span className="material-symbols-outlined shrink-0 text-lg text-primary">chat</span>
              <span className="safe-text">WhatsApp</span>
            </a>
            <a href={`mailto:${company.email}`} className="flex min-w-0 items-center gap-3 hover:text-primary">
              <span className="material-symbols-outlined shrink-0 text-lg text-primary">mail</span>
              <span className="safe-text">{company.email}</span>
            </a>
          </div>
          <p className="safe-text flex items-center gap-3 text-sm font-semibold text-secondary">
            <span className="material-symbols-outlined shrink-0 text-lg text-primary">location_on</span>
            <span>{company.address}</span>
          </p>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold">Services</h4>
          <ul className="flex flex-col gap-2 text-sm text-on-surface-variant">
            {company.services.slice(0, 6).map((service) => (
              <li key={service.title}>
                <Link to="/booking" className="hover:text-primary">{service.title}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold">Routes</h4>
          <ul className="flex flex-col gap-2 text-sm text-on-surface-variant">
            {company.routes.map((route) => (
              <li key={route}>{route}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-8 flex max-w-7xl flex-col justify-between gap-4 border-t border-outline-variant pt-8 text-xs font-medium text-on-surface-variant md:flex-row">
        <p>&copy; 2026 {company.legalName}. All rights reserved.</p>
        <div className="flex flex-wrap gap-4">
          <Link to="/legal" className="hover:text-primary">Privacy policy</Link>
          <Link to="/legal" className="hover:text-primary">Terms of service</Link>
        </div>
      </div>
    </footer>
  );
}
