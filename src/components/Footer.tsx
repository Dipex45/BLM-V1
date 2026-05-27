import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-outline-variant py-10 px-4 md:px-8 mt-auto z-50">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-on-primary font-black text-sm">
              B
            </div>
            <span className="font-display font-bold text-2xl">BLM Motors</span>
          </div>
          <p className="text-sm text-on-surface-variant max-w-sm mb-8 font-medium leading-relaxed">
            Reliable transport, delivery, and fleet support for businesses and private clients across South Africa.
          </p>
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-sm font-semibold text-secondary">
              <span className="material-symbols-outlined text-primary text-lg">call</span>
              <a href="tel:+27114567890" className="hover:text-primary">+27 11 456 7890</a>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-secondary">
              <span className="material-symbols-outlined text-primary text-lg">mail</span>
              <a href="mailto:operations@blmmotors.com" className="hover:text-primary">operations@blmmotors.com</a>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-secondary">
              <span className="material-symbols-outlined text-primary text-lg">location_on</span>
              122 Rivonia Road, Sandton, Johannesburg
            </div>
          </div>
          <div className="flex gap-4">
            <a href="#" aria-label="BLM Motors website" className="w-9 h-9 rounded-md bg-surface-container flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors">
              <span className="material-symbols-outlined text-sm">public</span>
            </a>
            <a href="#" aria-label="Share BLM Motors" className="w-9 h-9 rounded-md bg-surface-container flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors">
              <span className="material-symbols-outlined text-sm">share</span>
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-sm mb-4">Services</h4>
          <ul className="text-sm text-on-surface-variant flex flex-col gap-2">
            <li><a href="#" className="hover:text-primary">Last-mile delivery</a></li>
            <li><a href="#" className="hover:text-primary">Fleet management</a></li>
            <li><a href="#" className="hover:text-primary">Cross-Border Logistics</a></li>
            <li><a href="#" className="hover:text-primary">Business travel</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm mb-4">Company</h4>
          <ul className="text-sm text-on-surface-variant flex flex-col gap-2">
            <li><Link to="/" className="hover:text-primary">About us</Link></li>
            <li><a href="#" className="hover:text-primary">Careers</a></li>
            <li><a href="#" className="hover:text-primary">Safety record</a></li>
            <li><a href="#" className="hover:text-primary">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto border-t border-outline-variant mt-8 pt-8 flex flex-col md:flex-row justify-between gap-4 text-xs text-on-surface-variant font-medium">
        <p>&copy; 2026 BLM Motors Logistics. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/legal" className="hover:text-primary">Privacy policy</Link>
          <Link to="/legal" className="hover:text-primary">Terms of service</Link>
        </div>
      </div>
    </footer>
  );
}
