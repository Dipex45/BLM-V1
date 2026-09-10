import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import { company } from '../lib/company';
import CurrencySelector from './CurrencySelector';
import Sidebar from './Sidebar';
import { useLocale } from '../contexts/LocaleContext';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLocale();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const isAdmin = ['admin', 'super_admin', 'dispatcher', 'finance_admin', 'customer_support_agent'].includes(user?.role);
  const dashboardPath = isAdmin ? '/admin' : user?.role === 'driver' ? '/driver' : '/dashboard';
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `border-b-2 py-2 transition-colors ${isActive ? 'border-primary text-primary' : 'border-transparent hover:text-primary'}`;

  return (
    <>
      <nav className="fixed top-0 z-50 flex h-20 w-full items-center justify-between gap-2 border-b border-outline bg-white/96 px-2 backdrop-blur sm:px-3 md:px-8">
        <div className="flex min-w-0 shrink items-center gap-2 md:gap-5">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-md p-2 transition-colors hover:bg-surface-container xl:hidden"
            aria-label="Toggle navigation"
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>

          <Link to="/" className="flex min-w-0 items-center gap-2 md:gap-3" aria-label="BLM Motors home">
            <img src={company.logo} alt="BLM Motors logo" className="h-10 w-20 shrink-0 object-contain sm:h-12 sm:w-24 md:h-14 md:w-32" />
            <span className="hidden h-8 w-px bg-outline 2xl:block" />
            <span className="hidden max-w-[220px] text-xs font-semibold leading-tight text-on-surface-variant 2xl:block">
              {company.tagline}
            </span>
          </Link>
        </div>

        <div className="hidden items-center gap-5 text-sm font-semibold text-on-surface-variant xl:flex 2xl:gap-8">
          <NavLink to="/services" className={navLinkClass}>{t('services')}</NavLink>
          <NavLink to="/tracking" className={navLinkClass}>{t('track')}</NavLink>
          <NavLink to="/reviews" className={navLinkClass}>{t('reviews')}</NavLink>
          <a href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`} className="transition-colors hover:text-primary">
            WhatsApp
          </a>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-4">
          <div className="hidden sm:block"><CurrencySelector compact={true} /></div>
          <button type="button" onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')} className="rounded-md border border-outline px-2 py-2 text-xs font-black text-on-surface" title="English / Francais" aria-label="Change language">
            {language === 'en' ? 'FR' : 'EN'}
          </button>

          <Link
            to="/services"
            className="hidden items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-container lg:flex"
          >
            <span className="material-symbols-outlined text-base">event_available</span>
            {t('book')}
          </Link>

          {user ? (
            <>
            <div className="hidden items-center gap-2 lg:flex lg:gap-3">
              <Link to={dashboardPath} className="hidden text-sm font-bold hover:text-primary md:block">
                {isAdmin ? 'Admin' : 'Dashboard'}
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md border border-outline px-3 py-2 text-sm font-bold transition-colors hover:border-secondary hover:bg-secondary hover:text-white md:px-4"
              >
                Sign out
              </button>
            </div>
            <div className="flex items-center gap-1 lg:hidden">
              <Link to={dashboardPath} className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface hover:bg-surface-container" aria-label={isAdmin ? 'Open admin panel' : 'Open dashboard'}>
                <span className="material-symbols-outlined text-xl">account_circle</span>
              </Link>
              <button onClick={handleLogout} className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface hover:bg-surface-container" aria-label="Sign out">
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 lg:flex lg:gap-3">
              <Link to="/login" className="px-1.5 py-2 text-sm font-bold hover:text-primary sm:px-2">{t('login')}</Link>
              <Link to="/register" className="rounded-md bg-secondary px-2.5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary sm:px-3 md:px-4">
                {t('createAccount')}
              </Link>
            </div>
          )}
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-[55] bg-black/45 xl:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed bottom-0 left-0 top-0 z-[60] w-[86vw] max-w-sm bg-white shadow-2xl xl:hidden"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-outline p-6">
                  <img src={company.logo} alt="BLM Motors logo" className="h-14 w-32 object-contain" />
                  <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto" onClick={() => setIsMobileMenuOpen(false)}>
                  {user ? (
                    <Sidebar isMobile />
                  ) : (
                    <div className="flex flex-col gap-2 p-6 text-sm font-bold">
                      <div className="mb-3 border-b border-outline pb-5"><CurrencySelector /></div>
                      <NavLink to="/services" className={({ isActive }) => `rounded-md border-l-2 p-4 ${isActive ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:bg-surface-container'}`}>Services</NavLink>
                      <NavLink to="/tracking" className={({ isActive }) => `rounded-md border-l-2 p-4 ${isActive ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:bg-surface-container'}`}>Track booking</NavLink>
                      <NavLink to="/reviews" className={({ isActive }) => `rounded-md border-l-2 p-4 ${isActive ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:bg-surface-container'}`}>Reviews</NavLink>
                      <a href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(company.whatsappMessage)}`} className="rounded-md p-4 hover:bg-surface-container">
                        WhatsApp
                      </a>
                      <Link to="/login" className="rounded-md border border-outline p-4 text-center">{t('login')}</Link>
                      <Link to="/register" className="rounded-md bg-secondary p-4 text-center text-white">{t('createAccount')}</Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
