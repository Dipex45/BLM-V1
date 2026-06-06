import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { company } from '../lib/company';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onFinish, 700);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-5"
      >
        <img src={company.logo} alt="BLM Motors logo" className="h-24 w-52 object-contain" />
        <div className="h-1 w-36 overflow-hidden rounded-md bg-surface-container">
          <motion.div
            initial={{ width: '20%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="h-full rounded-md bg-primary"
          />
        </div>
      </motion.div>
    </div>
  );
}
