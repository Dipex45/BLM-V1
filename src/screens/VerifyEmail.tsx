import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import { authContinueUrl, getEmailAuthError } from '../lib/authFlow';
import { easeOutExpo, Spinner } from '../components/ui/motion';

const RESEND_COOLDOWN = 60;

export default function VerifyEmail() {
  const { user, refresh, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(() =>
    sessionStorage.getItem('blm-verification-sent') === 'failed'
      ? { tone: 'error', text: 'Your account is ready, but we couldn’t send the email. Tap “Resend email”.' }
      : null,
  );

  // Poll quietly so the page moves on as soon as the link is clicked in another tab.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (!user) return;
    setSending(true);
    try {
      await sendEmailVerification(user.firebaseUser, authContinueUrl());
      setMessage({ tone: 'success', text: `We’ve sent a new link to ${user.email}.` });
      setCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      setMessage({ tone: 'error', text: getEmailAuthError(err?.code) });
    } finally {
      setSending(false);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      await refresh();
      if (!auth.currentUser?.emailVerified) {
        setMessage({ tone: 'info', text: 'Not confirmed yet. Click the link in the email, then come back here.' });
      }
    } catch {
      setMessage({ tone: 'error', text: 'We couldn’t check right now. Please check your internet.' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOutExpo }} className="card w-full max-w-md p-8 text-center sm:p-10">
        <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping-slow rounded-full bg-primary/15" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-primary">
            <span className="material-symbols-outlined text-4xl">mark_email_unread</span>
          </span>
        </div>
        <h1 className="text-3xl font-extrabold">Check your inbox</h1>
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          We’ve sent a link to <strong className="text-on-surface">{user?.email}</strong>. Click it to confirm your email — this page will move on by itself.
        </p>

        {message && (
          <div className={`mt-6 text-left ${message.tone === 'error' ? 'alert-error' : message.tone === 'success' ? 'alert-success' : 'alert-info'}`} role="status">
            {message.text}
          </div>
        )}

        <div className="mt-8 grid gap-3">
          <button type="button" onClick={checkNow} disabled={checking} className="btn-primary btn-lg w-full">
            {checking ? <><Spinner /> Checking…</> : 'I’ve clicked the link'}
          </button>
          <button type="button" onClick={resend} disabled={sending || cooldown > 0} className="btn-outline w-full">
            {sending ? <Spinner /> : null}
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          </button>
          <button type="button" onClick={() => void signOut()} className="btn-ghost w-full text-on-surface-variant">
            Use a different account
          </button>
        </div>
        <p className="mt-6 text-xs text-on-surface-variant">Can’t find it? Check your spam or promotions folder.</p>
      </motion.div>
    </div>
  );
}
