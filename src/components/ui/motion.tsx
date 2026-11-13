import { ReactNode, useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Variants } from 'framer-motion';

export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOutExpo } },
};

export const stagger = (delay = 0.07): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

/** Fades and lifts its children into view once, when scrolled to. */
export function Reveal({ children, className, delay = 0, y = 24 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: easeOutExpo }}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers `motion` children using the fadeUp variant. */
export function Stagger({ children, className, delay = 0.07 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} variants={stagger(delay)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
      {children}
    </motion.div>
  );
}

export const StaggerItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div className={className} variants={fadeUp}>{children}</motion.div>
);

/** Smoothly counts between numeric values (used for live prices and KPIs). */
export function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (latest) => format(Math.round(latest)));
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, value, { duration: 0.6, ease: easeOutExpo });
    return () => controls.stop();
  }, [inView, motionValue, value]);

  return <motion.span ref={ref}>{text}</motion.span>;
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <span className={`${className} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`} aria-hidden="true" />;
}
