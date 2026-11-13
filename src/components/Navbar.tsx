import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useCurrency, CURRENCY_CONFIG } from '../contexts/CurrencyContext';
import { useLocale } from '../contexts/LocaleContext';
import { isStaffRole, landingPathForRole } from '../lib/authFlow';
import { company } from '../lib/company';
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '../lib/catalog';
import { easeOutExpo } from './ui/motion';

const whatsappUrl = `https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`;

function accountLinks(role: string) {
  if (isStaffRole(role)) return [{ to: '/admin', label: 'Admin panel', icon: 'admin_panel_settings' }, { to: '/support', label: 'Customer messages', icon: 'support_agent' }];
  if (role === 'driver') return [{ to: '/driver', label: 'My trips', icon: 'local_shipping' }, { to: '/support', label: 'Help', icon: 'support_agent' }];
  return [
    { to: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
    { to: '/bookings', label: 'My bookings', icon: 'receipt_long' },
    { to: '/support', label: 'Help', icon: 'support_agent' },
  ];
}

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const { language, setLanguage, t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const links = [
    { to: '/services', label: t('services') },
    { to: '/tracking', label: t('track') },
    { to: '/reviews', label: t('reviews') },
  ];
  const initials = (user?.displayName || user?.email || 'B').split(/[\s@.]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 h-20 transition-[background-color,box-shadow,border-color] duration-300 ${scrolled || mobileOpen ? 'border-b border-outline bg-white/90 shadow-[0_8px_30px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl' : 'border-b border-transparent bg-white/70 backdrop-blur'}`}>
        <nav className="container-page flex h-full items-center justify-between gap-3" aria-label="Main">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface-container lg:hidden" aria-label="Toggle navigation" aria-expanded={mobileOpen}>
              <span className="material-symbols-outlined">{mobileOpen ? 'close' : 'menu'}</span>
            </button>
            <Link to="/" className="flex items-center" aria-label="BLM Motors home">
              <img src={company.logo} alt="BLM Motors" className="h-11 w-28 object-contain sm:h-12 sm:w-32" />
            </Link>
          </div>

          <div className="hidden items-center gap-1 rounded-full border border-outline bg-white/70 p-1 lg:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className="relative rounded-full px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-secondary" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                    <span className={`relative ${isActive ? 'text-white' : ''}`}>{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-full px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface">WhatsApp</a>
          </div>

          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="nav-currency">Display currency</label>
            <select
              id="nav-currency"
              value={displayCurrency}
              onChange={(event) => setDisplayCurrency(event.target.value as SupportedCurrency)}
              className="hidden h-10 rounded-xl border border-outline bg-white px-2 text-xs font-bold sm:block"
            >
              {SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency} {CURRENCY_CONFIG[currency].symbol}</option>)}
            </select>
            <button type="button" onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')} className="h-10 rounded-xl border border-outline bg-white px-3 text-xs font-black" aria-label="Change language">
              {language === 'en' ? 'FR' : 'EN'}
            </button>

            {user ? (
              <div className="relative" ref={menuRef}>
                <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex h-10 items-center gap-2 rounded-xl border border-outline bg-white pl-1 pr-2 hover:border-outline-variant" aria-haspopup="menu" aria-expanded={menuOpen}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">{initials}</span>
                  <span className="material-symbols-outlined hidden text-lg sm:inline">expand_more</span>
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.18 }} className="card absolute right-0 mt-2 w-64 origin-top-right p-2">
                      <div className="border-b border-outline px-3 pb-3 pt-2">
                        <p className="truncate text-sm font-bold">{user.displayName || 'BLM account'}</p>
                        <p className="truncate text-xs text-on-surface-variant">{user.email}</p>
                      </div>
                      <div className="py-1">
                        {accountLinks(user.role).map((item) => (
                          <Link key={item.to} to={item.to} role="menuitem" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-surface-container">
                            <span className="material-symbols-outlined text-lg text-on-surface-variant">{item.icon}</span>{item.label}
                          </Link>
                        ))}
                      </div>
                      <button type="button" onClick={handleSignOut} role="menuitem" className="flex w-full items-center gap-3 rounded-lg border-t border-outline px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary-soft">
                        <span className="material-symbols-outlined text-lg">logout</span> Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login" className="btn-ghost px-3 py-2">{t('login')}</Link>
                <Link to="/services" className="btn-primary py-2.5">{t('book')}</Link>
              </div>
            )}
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-x-0 bottom-0 top-20 z-40 overflow-y-auto bg-white lg:hidden" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3, ease: easeOutExpo }}>
            <div className="container-page flex flex-col gap-1 py-6">
              {[...links, ...(user ? accountLinks(user.role).map((item) => ({ to: item.to, label: item.label })) : [])].map((link, index) => (
                <motion.div key={link.to} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * index, ease: easeOutExpo, duration: 0.4 }}>
                  <NavLink to={link.to} className={({ isActive }) => `flex items-center justify-between rounded-xl px-4 py-4 text-lg font-bold ${isActive ? 'bg-primary-soft text-primary' : 'hover:bg-surface-container'}`}>
                    {link.label}
                    <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
                  </NavLink>
                </motion.div>
              ))}
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl px-4 py-4 text-lg font-bold hover:bg-surface-container">WhatsApp <span className="material-symbols-outlined">chat</span></a>
              <div className="mt-4 flex items-center gap-3 border-t border-outline pt-6">
                <select value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value as SupportedCurrency)} className="field flex-1" aria-label="Display currency">
                  {SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{CURRENCY_CONFIG[currency].name} ({currency})</option>)}
                </select>
              </div>
              {user ? (
                <button type="button" onClick={handleSignOut} className="btn-outline mt-4 w-full">Sign out</button>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Link to="/login" className="btn-outline">{t('login')}</Link>
                  <Link to="/register" className="btn-primary">{t('createAccount')}</Link>
                </div>
              )}
              {user && <Link to={landingPathForRole(user.role)} className="btn-primary mt-3 w-full">Go to my account</Link>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
