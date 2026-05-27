import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-outline px-4 md:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {user && (
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 hover:bg-surface-container rounded-md transition-colors"
              aria-label="Toggle navigation"
            >
              <span className="material-symbols-outlined">
                {isMobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          )}
          <Link to="/" className="flex items-center gap-3 group" aria-label="BLM Motors home">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-black text-white">BLM</span>
            <span className="font-display text-xl font-bold text-on-surface">BLM Motors</span>
            <span className="hidden xl:block h-8 w-px bg-outline" />
            <span className="hidden xl:block text-xs text-on-surface-variant font-semibold leading-tight">
              Transport, delivery, and fleet support
            </span>
          </Link>
        </div>

        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-on-surface-variant">
          <Link to="/" className="hover:text-primary transition-colors">About</Link>
          <Link to="/tracking" className="hover:text-primary transition-colors">Track delivery</Link>
          <Link to="/booking" className="hover:text-primary transition-colors">Book transport</Link>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            to="/booking" 
            className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md font-bold text-sm hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-base">event_available</span>
            Book transport
          </Link>
          
          {user ? (
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="hidden md:block font-bold text-sm hover:text-primary">Dashboard</Link>
              <button 
                onClick={handleLogout}
                className="text-sm font-bold px-4 py-2.5 rounded-md border border-outline hover:bg-secondary hover:border-secondary hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-sm font-bold px-2 py-2 hover:text-primary">Log in</Link>
              <Link 
                to="/register" 
                className="text-sm font-bold px-4 py-2.5 bg-secondary text-white rounded-md hover:bg-primary transition-colors"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 z-[55] md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-white z-[60] md:hidden shadow-2xl"
            >
              <div className="flex flex-col h-full">
                 <div className="p-8 border-b border-outline flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-black text-white">BLM</span>
                      <span className="font-display text-xl font-bold text-on-surface">BLM Motors</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation">
                       <span className="material-symbols-outlined">close</span>
                    </button>
                 </div>
                 <div className="flex-1 overflow-y-auto" onClick={() => setIsMobileMenuOpen(false)}>
                    <Sidebar isMobile />
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
