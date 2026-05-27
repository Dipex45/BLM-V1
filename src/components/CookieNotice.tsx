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

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-8 left-4 right-4 z-[100] rounded-lg border border-outline bg-white p-6 shadow-2xl md:left-auto md:right-8 md:w-96"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">cookie</span>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Cookies on this site</h4>
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                We use cookies to remember your preferences, support booking tools, and localize currency data.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleAccept}
              className="flex-1 rounded-md bg-primary py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-container"
            >
              Accept
            </button>
            <button 
              onClick={() => setIsVisible(false)}
              className="rounded-md border border-outline px-6 py-2.5 text-sm font-bold transition-colors hover:bg-surface-container"
            >
              Later
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
