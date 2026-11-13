import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { GoogleAuthProvider, OAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Apple } from 'lucide-react';
import { auth } from '../lib/firebase';
import { authContinueUrl, ensureCustomerProfile, getEmailAuthError, getProviderAuthError } from '../lib/authFlow';
import AuthLayout, { FormMessage, GoogleIcon } from '../components/AuthLayout';
import { Spinner } from '../components/ui/motion';

type Mode = 'signin' | 'reset';

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | 'reset' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy('email');
    try {
      // Routing reacts to the auth state: verified users land on their dashboard,
      // unverified email accounts are sent to /verify-email.
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err: any) {
      setError(getEmailAuthError(err?.code));
      setBusy(null);
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy('reset');
    try {
      await sendPasswordResetEmail(auth, normalizedEmail, authContinueUrl());
      setMessage(`If ${normalizedEmail} has an account, we’ve sent a reset link. Check your inbox and spam folder.`);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        setMessage(`If ${normalizedEmail} has an account, we’ve sent a reset link. Check your inbox and spam folder.`);
      } else {
        setError(getEmailAuthError(err?.code));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleProvider = async (name: 'Google' | 'Apple') => {
    setError('');
    setMessage('');
    setBusy(name === 'Google' ? 'google' : 'apple');
    try {
      const provider = name === 'Google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
      if (provider instanceof OAuthProvider) {
        provider.addScope('email');
        provider.addScope('name');
      }
      const result = await signInWithPopup(auth, provider);
      await ensureCustomerProfile(result.user, `${name} customer`).catch(() => undefined);
    } catch (err: any) {
      setError(getProviderAuthError(name, err?.code));
      setBusy(null);
    }
  };

  return (
    <AuthLayout
      title={mode === 'signin' ? 'Welcome back' : 'Reset your password'}
      subtitle={mode === 'signin' ? 'Sign in to see your bookings, pay, and track your trips.' : 'Enter your email and we’ll send you a link to set a new password.'}
      sideTitle="Every journey, one account."
      sideBody="Book rides, tours, car hire and deliveries, then follow each one as it happens."
    >
      <AnimatePresence initial={false}>
        {error && <FormMessage key="error" tone="error">{error}</FormMessage>}
        {message && <FormMessage key="message" tone="success">{message}</FormMessage>}
      </AnimatePresence>

      {mode === 'signin' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => handleProvider('Google')} disabled={busy !== null} className="btn-outline">
              {busy === 'google' ? <Spinner /> : <GoogleIcon />} Google
            </button>
            <button type="button" onClick={() => handleProvider('Apple')} disabled={busy !== null} className="btn-dark">
              {busy === 'apple' ? <Spinner /> : <Apple className="h-5 w-5" fill="currentColor" aria-hidden="true" />} Apple
            </button>
          </div>
          <div className="my-6 flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <span className="h-px flex-1 bg-outline" /> or with email <span className="h-px flex-1 bg-outline" />
          </div>

          <form onSubmit={handleSignIn} className="space-y-5" noValidate={false}>
            <div>
              <label htmlFor="email" className="field-label">Email address</label>
              <input id="email" type="email" autoComplete="email" required className="field" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="field-label">Password</label>
                <button type="button" onClick={() => { setMode('reset'); setError(''); setMessage(''); }} className="mb-1.5 text-xs font-bold text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required className="field pr-12" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <button type="submit" disabled={busy !== null} className="btn-primary btn-lg w-full">
              {busy === 'email' ? <><Spinner /> Signing in…</> : 'Sign in'}
            </button>
          </form>
          <p className="mt-8 text-center text-sm text-on-surface-variant">
            Don’t have an account? <Link to="/register" className="font-bold text-primary hover:underline">Create an account</Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleReset} className="space-y-5">
          <div>
            <label htmlFor="reset-email" className="field-label">Email address</label>
            <input id="reset-email" type="email" autoComplete="email" required className="field" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={busy !== null} className="btn-primary btn-lg w-full">
            {busy === 'reset' ? <><Spinner /> Sending…</> : 'Send reset link'}
          </button>
          <button type="button" onClick={() => { setMode('signin'); setError(''); setMessage(''); }} className="btn-ghost w-full">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Back to sign in
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
