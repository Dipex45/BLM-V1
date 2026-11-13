import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, sendEmailVerification, signInWithPopup, updateProfile } from 'firebase/auth';
import { Apple } from 'lucide-react';
import { auth } from '../lib/firebase';
import { authContinueUrl, ensureCustomerProfile, getEmailAuthError, getProviderAuthError, passwordChecks } from '../lib/authFlow';
import AuthLayout, { FormMessage, GoogleIcon } from '../components/AuthLayout';
import { Spinner } from '../components/ui/motion';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);
  const [error, setError] = useState('');

  const checks = passwordChecks(password);
  const strong = checks.every((check) => check.ok);

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (fullName.trim().length < 2) return setError('Please enter your full name.');
    if (!strong) return setError('Your password needs at least 8 characters, including a letter and a number.');

    setBusy('email');
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      await ensureCustomerProfile(credential.user, fullName.trim());
      try {
        await sendEmailVerification(credential.user, authContinueUrl());
        sessionStorage.setItem('blm-verification-sent', String(Date.now()));
      } catch {
        sessionStorage.setItem('blm-verification-sent', 'failed');
      }
      // The router moves new accounts to /verify-email automatically.
    } catch (err: any) {
      setError(getEmailAuthError(err?.code));
      setBusy(null);
    }
  };

  const handleProvider = async (name: 'Google' | 'Apple') => {
    setError('');
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
      title="Create your account"
      subtitle="Save your details once, then book any service in under a minute."
      sideTitle="Fast. Secure. Reliable."
      sideBody="Checked drivers, clear prices and live tracking across Nigeria, Benin, Togo and Ghana."
    >
      <AnimatePresence initial={false}>{error && <FormMessage key="error" tone="error">{error}</FormMessage>}</AnimatePresence>

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

      <form onSubmit={handleRegister} className="space-y-5">
        <div>
          <label htmlFor="name" className="field-label">Full name</label>
          <input id="name" autoComplete="name" required className="field" placeholder="Chinedu Okafor" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="email" className="field-label">Email address</label>
          <input id="email" type="email" autoComplete="email" required className="field" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required className="field pr-12" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {checks.map((check, index) => (
              <motion.span key={check.label} className="h-1.5 flex-1 rounded-full bg-outline" animate={{ backgroundColor: checks.filter((c) => c.ok).length > index ? (strong ? '#15803d' : '#c1121f') : '#e2e3df' }} />
            ))}
          </div>
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
            {checks.map((check) => (
              <li key={check.label} className={`flex items-center gap-1 ${check.ok ? 'text-success' : 'text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-sm">{check.ok ? 'check_circle' : 'radio_button_unchecked'}</span>
                {check.label}
              </li>
            ))}
          </ul>
        </div>
        <button type="submit" disabled={busy !== null} className="btn-primary btn-lg w-full">
          {busy === 'email' ? <><Spinner /> Creating account…</> : 'Create account'}
        </button>
        <p className="text-center text-xs text-on-surface-variant">
          By signing up, you agree to our <Link to="/legal" className="font-semibold underline">terms and privacy policy</Link>.
        </p>
      </form>
      <p className="mt-8 text-center text-sm text-on-surface-variant">
        Already have an account? <Link to="/login" className="font-bold text-primary hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
