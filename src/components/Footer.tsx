import { Link } from 'react-router-dom';
import { company } from '../lib/company';
import { serviceSlug } from '../lib/catalog';
import { useCatalog } from '../hooks/useCatalog';

export default function Footer() {
  const { catalog } = useCatalog();
  return (
    <footer className="mt-auto border-t border-outline bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <img src={company.logo} alt="BLM Motors" className="h-14 w-36 object-contain" />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-on-surface-variant">{company.summary}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={`tel:${company.phone}`} className="chip"><span className="material-symbols-outlined text-base text-primary">call</span>{company.phoneDisplay}</a>
            <a href={`mailto:${company.email}`} className="chip"><span className="material-symbols-outlined text-base text-primary">mail</span>{company.email}</a>
            <a href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`} target="_blank" rel="noreferrer" className="chip"><span className="material-symbols-outlined text-base text-primary">chat</span>WhatsApp</a>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold">Services</h2>
          <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
            {company.services.map((service) => (
              <li key={service.title}><Link to={`/services/${serviceSlug(service.title)}`} className="hover:text-primary">{service.title}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold">Routes</h2>
          <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
            {(catalog?.routes || company.routes).map((route) => <li key={route}>{route}</li>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-outline">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {company.legalName}. All rights reserved.</p>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link to="/tracking" className="hover:text-primary">Track booking</Link>
            <Link to="/reviews" className="hover:text-primary">Reviews</Link>
            <Link to="/support" className="hover:text-primary">Help</Link>
            <Link to="/legal" className="hover:text-primary">Privacy & terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
