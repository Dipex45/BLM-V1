import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendEmailVerification, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { auth, db } from '../lib/firebase';
import { company } from '../lib/company';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        fullName,
        email,
        role: 'customer',
        createdAt: new Date().toISOString(),
      });

      setError('Account created. Please verify your email before logging in.');
      setLoading(false);
      setTimeout(() => navigate('/login'), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          fullName: result.user.displayName || 'Google User',
          email: result.user.email,
          role: 'customer',
          createdAt: new Date().toISOString(),
        });
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Google register error:', err.code, err.message);
      
      // Detect specific error types
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please: 1) Disable popup blockers (including ad blockers), 2) Try a different browser, or 3) Use incognito/private mode.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign up was cancelled. Please try again and complete the sign-in process.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Another popup request is pending. Please wait a moment and try again.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network connection error. Please check your internet and try again.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Google Sign-In is not configured for this domain. The website administrator needs to add this domain to Firebase Console settings (Project Settings > Authorized domains). Please contact support or try email/password registration.');
      } else {
        setError(`Google sign up failed (${err.code}). Please try again or use email/password registration.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-secondary p-20 lg:flex">
        <img
          src={company.servicesImage}
          alt="BLM Motors transport service flyer"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-lg text-white">
          <img src={company.logo} alt="BLM Motors logo" className="mb-12 h-24 w-52 object-contain" />
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
            <h1 className="mb-2 text-3xl font-bold">Create account</h1>
            <p className="text-sm text-on-surface-variant">Set up your profile for faster bookings.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md bg-error-container p-4 text-sm font-medium text-on-error-container">
              {error}
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
