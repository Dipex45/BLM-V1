import { Link } from 'react-router-dom';
import { company } from '../lib/company';

export default function Footer() {
  return (
    <footer className="z-50 mt-auto border-t border-outline-variant bg-white px-4 py-10 md:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <img src={company.logo} alt="BLM Motors logo" className="mb-4 h-16 w-36 object-contain" />
          <p className="mb-8 max-w-lg text-sm font-medium leading-relaxed text-on-surface-variant">
            {company.summary}
          </p>
          <div className="mb-8 grid gap-3 text-sm font-semibold text-secondary sm:grid-cols-2">
            <a href={`tel:${company.phone}`} className="flex items-center gap-3 hover:text-primary">
              <span className="material-symbols-outlined text-lg text-primary">call</span>
              {company.phoneDisplay}
            </a>
            <a href={`https://wa.me/${company.whatsapp.replace('+', '')}`} className="flex items-center gap-3 hover:text-primary">
              <span className="material-symbols-outlined text-lg text-primary">chat</span>
              WhatsApp {company.whatsappDisplay}
            </a>
            <a href={`tel:${company.beninPhone}`} className="flex items-center gap-3 hover:text-primary">
              <span className="material-symbols-outlined text-lg text-primary">public</span>
              {company.beninPhoneDisplay}
            </a>
            <a href={`mailto:${company.email}`} className="flex items-center gap-3 hover:text-primary">
              <span className="material-symbols-outlined text-lg text-primary">mail</span>
              {company.email}
            </a>
          </div>
          <p className="flex items-center gap-3 text-sm font-semibold text-secondary">
            <span className="material-symbols-outlined text-lg text-primary">location_on</span>
            {company.address}
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
        <div className="flex gap-4">
          <Link to="/legal" className="hover:text-primary">Privacy policy</Link>
          <Link to="/legal" className="hover:text-primary">Terms of service</Link>
          <Link to="/admin" className="hover:text-primary">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
