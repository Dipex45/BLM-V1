import { useEffect } from 'react';
import { motion } from 'framer-motion';

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
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-sm font-black text-white">BLM</span>
          <span className="font-display text-2xl font-bold text-on-surface">BLM Motors</span>
        </div>
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
