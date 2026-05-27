import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { auth, db } from '../lib/firebase';
import { AuditAction, logAudit } from '../lib/audit';
import { company } from '../lib/company';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      const adminDoc = await getDoc(doc(db, 'admins', userCredential.user.uid));
      if (adminDoc.exists()) {
        await logAudit(userCredential.user.uid, userCredential.user.email || 'admin', AuditAction.ADMIN_LOGIN, {
          method: 'email',
        });
      }

      if (!userCredential.user.emailVerified) {
        setMessage('Please verify your email address. Check your inbox.');
        setLoading(false);
        return;
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address to reset your password.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset link sent to your inbox.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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

      const adminDoc = await getDoc(doc(db, 'admins', result.user.uid));
      if (adminDoc.exists()) {
        await logAudit(result.user.uid, result.user.email || 'admin', AuditAction.ADMIN_LOGIN, {
          method: 'google',
        });
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Google login failed. Please check that popups are allowed and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-secondary p-20 lg:flex">
        <img
          src={company.servicesImage}
          alt="BLM Motors services flyer"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 max-w-lg text-white">
          <img src={company.logo} alt="BLM Motors logo" className="mb-12 h-20 w-44 object-contain" />
          <h2 className="mb-6 text-5xl font-bold leading-tight">Welcome back.</h2>
          <p className="text-lg font-medium leading-relaxed text-white/82">
            Manage Nigerian transport, touring, car hire, pickup, and cross-border bookings.
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
            <h1 className="mb-2 text-3xl font-bold">Sign in</h1>
            <p className="text-sm text-on-surface-variant">Access your bookings and delivery history.</p>
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
              onClick={handleGoogleLogin}
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

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-bold text-on-surface-variant">Email address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg text-primary">person</span>
                <input
                  type="email"
                  required
                  className="w-full rounded-md border border-outline bg-surface-container py-3.5 pl-12 pr-4 font-medium transition-colors focus:bg-white focus:ring-2 focus:ring-primary/20"
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-on-surface-variant">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg text-primary">lock</span>
                <input
                  type="password"
                  required
                  className="w-full rounded-md border border-outline bg-surface-container py-3.5 pl-12 pr-4 font-medium transition-colors focus:bg-white focus:ring-2 focus:ring-primary/20"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="mt-2 text-right">
                <button type="button" onClick={handleForgotPassword} className="text-sm font-bold text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-4 font-bold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50"
            >
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-on-primary" /> : 'Log in'}
            </button>
          </form>

          <div className="mt-8 border-t border-outline pt-8 text-center">
            <p className="text-sm text-on-surface-variant">
              Do not have an account? <Link to="/register" className="font-bold text-primary hover:underline">Create one</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
