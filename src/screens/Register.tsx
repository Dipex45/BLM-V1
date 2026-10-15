import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, sendEmailVerification, signInWithPopup, updateProfile } from 'firebase/auth';
import { motion } from 'framer-motion';
import { Apple } from 'lucide-react';
import { auth } from '../lib/firebase';
import { company } from '../lib/company';
import { ensureCustomerProfile, getAuthenticatedLandingPath, getProviderAuthError } from '../lib/authFlow';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const getFriendlyAuthError = (code: string): string => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/network-request-failed':
        return 'Network connection error. Please check your internet and try again.';
      case 'auth/operation-not-allowed':
        return 'Email and password registration is not enabled. Please contact BLM support.';
      default:
        return 'Registration failed. Please try again or contact support.';
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedName = fullName.trim();
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await updateProfile(userCredential.user, { displayName: normalizedName });

      try {
        await ensureCustomerProfile(userCredential.user, normalizedName);
      } catch (profileError) {
        console.warn('Customer profile sync will be retried by the server', profileError);
      }

      let verificationSent = true;
      try {
        await sendEmailVerification(userCredential.user);
      } catch (verificationError) {
        verificationSent = false;
        console.warn('Initial verification email could not be sent', verificationError);
      }

      navigate('/verify-email', { replace: true, state: { verificationSent } });
    } catch (err: any) {
      setError(getFriendlyAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleProviderRegister = async (providerName: 'Google' | 'Apple', provider: GoogleAuthProvider | OAuthProvider) => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await signInWithPopup(auth, provider);
      try {
        await ensureCustomerProfile(result.user, `${providerName} Customer`);
      } catch (profileError) {
        console.warn(`${providerName} profile sync will be retried by the server`, profileError);
      }
      navigate(await getAuthenticatedLandingPath(result.user), { replace: true });
    } catch (err: any) {
      console.error(`${providerName} registration error:`, err.code, err.message);
      setError(getProviderAuthError(providerName, err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = () => handleProviderRegister('Google', new GoogleAuthProvider());

  const handleAppleRegister = () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    return handleProviderRegister('Apple', provider);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-secondary p-20 lg:flex">
        <img
          src={company.authImage}
          alt="BLM Motors transport service flyer"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-90"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 max-w-lg text-white">
          <div className="brand-logo-glow mb-10">
            <img
              src={company.logo}
              alt="BLM Motors logo"
              className="h-20 w-64 object-contain md:h-24 md:w-72"
            />
          </div>
          <h2 className="mb-6 text-5xl font-bold leading-tight">Create your BLM account.</h2>
          <p className="text-lg font-medium leading-relaxed text-white/82">
            Book transport, touring, car hire, pickup, and cross-border trips from one account.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-white p-8 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-lg border border-outline bg-white p-8 shadow-sm md:p-10"
        >
          <div className="mb-9 text-center">
            <div className="brand-logo-glow mb-5 lg:hidden">
              <img src={company.logo} alt="BLM Motors logo" className="h-16 w-48 object-contain" />
            </div>
            <h1 className="mb-2 text-3xl font-bold">Create account</h1>
            <p className="text-sm text-on-surface-variant">Set up your profile for faster bookings.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md bg-error-container p-4 text-sm font-medium text-on-error-container">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-6 rounded-md bg-primary/10 p-4 text-sm font-medium text-primary">
              {message}
            </div>
          )}

          <div className="mb-8 space-y-4">
            <button
              onClick={handleGoogleRegister}
              disabled={loading}
              className="flex w-full items-center justify-center gap-4 rounded-md border border-outline bg-white py-4 font-bold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>
            <button
              type="button"
              onClick={handleAppleRegister}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-md bg-black py-4 font-bold text-white transition-colors hover:bg-black/85 disabled:opacity-60"
            >
              <Apple className="h-5 w-5" aria-hidden="true" fill="currentColor" />
              Continue with Apple
            </button>
            <div className="flex items-center gap-4 px-2">
              <div className="h-px flex-1 bg-outline" />
              <span className="text-xs font-bold text-on-surface-variant">or</span>
              <div className="h-px flex-1 bg-outline" />
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-bold text-on-surface-variant">Full name</label>
              <input
                type="text"
                autoComplete="name"
                required
                className="w-full rounded-md border border-outline bg-surface-container px-4 py-3.5 font-medium transition-colors focus:bg-white focus:ring-2 focus:ring-primary/20"
                placeholder="Chinedu Okafor"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-on-surface-variant">Email address</label>
              <input
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-outline bg-surface-container px-4 py-3.5 font-medium transition-colors focus:bg-white focus:ring-2 focus:ring-primary/20"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-on-surface-variant">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-md border border-outline bg-surface-container px-4 py-3.5 pr-24 font-medium transition-colors focus:bg-white focus:ring-2 focus:ring-primary/20"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-primary hover:text-primary/80"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-4 font-bold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50"
            >
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-on-primary" /> : 'Create account'}
            </button>
          </form>

          <div className="mt-8 border-t border-outline pt-8 text-center">
            <p className="text-sm text-on-surface-variant">
              Already have an account? <Link to="/login" className="font-bold text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
