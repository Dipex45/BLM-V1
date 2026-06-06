import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import { company } from '../lib/company';
import Sidebar from './Sidebar';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const isAdmin = ['admin', 'super_admin', 'dispatcher', 'finance_admin', 'customer_support_agent'].includes(user?.role);
  const dashboardPath = isAdmin ? '/admin' : '/dashboard';

  return (
    <>
      <nav className="fixed top-0 z-50 flex h-20 w-full items-center justify-between gap-2 border-b border-outline bg-white/96 px-2 backdrop-blur sm:px-3 md:px-8">
        <div className="flex min-w-0 shrink items-center gap-2 md:gap-5">
          {user && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-md p-2 transition-colors hover:bg-surface-container md:hidden"
              aria-label="Toggle navigation"
            >
              <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          )}

          <Link to="/" className="flex min-w-0 items-center gap-2 md:gap-3" aria-label="BLM Motors home">
            <img src={company.logo} alt="BLM Motors logo" className="h-10 w-20 shrink-0 object-contain sm:h-12 sm:w-24 md:h-14 md:w-32" />
            <span className="hidden h-8 w-px bg-outline lg:block" />
            <span className="hidden max-w-[220px] text-xs font-semibold leading-tight text-on-surface-variant lg:block">
              {company.tagline}
            </span>
          </Link>
        </div>

        <div className="hidden items-center gap-8 text-sm font-semibold text-on-surface-variant lg:flex">
          <Link to="/" className="transition-colors hover:text-primary">Services</Link>
          <Link to="/tracking" className="transition-colors hover:text-primary">Track booking</Link>
          <Link to="/booking" className="transition-colors hover:text-primary">Book now</Link>
          <a href={`https://wa.me/${company.whatsapp.replace('+', '')}`} className="transition-colors hover:text-primary">
            WhatsApp
          </a>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-4">
          <a
            href={`tel:${company.phone}`}
            className="hidden rounded-md border border-outline px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:border-primary hover:text-primary xl:block"
          >
            {company.phoneDisplay}
          </a>

          <Link
            to="/booking"
            className="hidden items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-container sm:flex"
          >
            <span className="material-symbols-outlined text-base">event_available</span>
            Book
          </Link>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
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
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/login" className="px-1.5 py-2 text-sm font-bold hover:text-primary sm:px-2">Log in</Link>
              <Link to="/register" className="rounded-md bg-secondary px-2.5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary sm:px-3 md:px-4">
                Create<span className="hidden sm:inline"> account</span>
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
              className="fixed inset-0 z-[55] bg-black/45 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 top-0 z-[60] w-[86vw] max-w-sm bg-white shadow-2xl md:hidden"
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
                      <Link to="/" className="rounded-md p-4 hover:bg-surface-container">Services</Link>
                      <Link to="/tracking" className="rounded-md p-4 hover:bg-surface-container">Track booking</Link>
                      <Link to="/booking" className="rounded-md p-4 hover:bg-surface-container">Book now</Link>
                      <a href={`https://wa.me/${company.whatsapp.replace('+', '')}`} className="rounded-md p-4 hover:bg-surface-container">
                        WhatsApp {company.whatsappDisplay}
                      </a>
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
