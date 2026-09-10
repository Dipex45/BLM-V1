import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setTimeout(() => setIsVisible(true), 2000);
    }
  }, []);

  const handleAcknowledge = () => {
    localStorage.setItem('cookie-consent', 'necessary-only');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[100] border-t border-outline bg-white px-3 py-2.5 shadow-xl md:bottom-4 md:left-auto md:right-4 md:w-[420px] md:rounded-lg md:border"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold">Necessary site storage</h4>
              <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">
                Used for secure sign-in, bookings, language, and currency. No advertising cookies.{' '}
                <a href="/legal#privacy" className="font-bold text-primary underline">Privacy</a>
              </p>
            </div>
            <button 
              onClick={handleAcknowledge}
              className="h-9 shrink-0 rounded-md bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary-container"
            >
              Accept
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
