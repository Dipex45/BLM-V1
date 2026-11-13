import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { company } from '../lib/company';
import { easeOutExpo } from './ui/motion';

export default function AuthLayout({ title, subtitle, sideTitle, sideBody, children }: {
  title: string;
  subtitle: string;
  sideTitle: string;
  sideBody: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-5rem)] lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-secondary lg:block">
        <motion.img
          src={company.authImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: easeOutExpo }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
        <div className="hero-grid absolute inset-0" />
        <div className="relative z-10 flex h-full flex-col justify-end p-14 text-white">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.8, ease: easeOutExpo }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {company.tagline}
            </span>
            <h2 className="mt-6 max-w-lg text-5xl font-extrabold leading-[1.05]">{sideTitle}</h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/75">{sideBody}</p>
            <div className="mt-10 flex gap-8 border-t border-white/15 pt-6 text-sm text-white/70">
              <div><p className="text-2xl font-bold text-white">24/7</p>Always open</div>
              <div><p className="text-2xl font-bold text-white">4</p>Countries served</div>
              <div><p className="text-2xl font-bold text-white">5</p>Services</div>
            </div>
          </motion.div>
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-on-surface sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>
          </div>
          {children}
        </motion.div>
      </main>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <motion.div
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className={tone === 'error' ? 'alert-error' : 'alert-success'}
    >
      <span className="material-symbols-outlined text-lg">{tone === 'error' ? 'error' : 'check_circle'}</span>
      <span>{children}</span>
    </motion.div>
  );
}
