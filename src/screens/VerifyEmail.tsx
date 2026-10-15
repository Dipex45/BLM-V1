import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

export default function VerifyEmail() {
  const location = useLocation();
  const [message, setMessage] = useState(
    location.state?.verificationSent === false
      ? 'Your account was created, but the first email could not be sent. Use the resend button below.'
      : '',
  );
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const user = auth.currentUser;

  const handleResend = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await sendEmailVerification(user);
      setMessage("A fresh verification link has been sent.");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await currentUser.reload();
      await currentUser.getIdToken(true);
      if (currentUser.emailVerified) {
        navigate('/dashboard', { replace: true });
      } else {
        setMessage('Your email is not verified yet. Open the verification link in your inbox, then check again.');
      }
    } catch {
      setMessage('We could not refresh your verification status. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full p-8 md:p-10 bg-white rounded-lg border border-outline shadow-sm"
      >
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-lg flex items-center justify-center mx-auto mb-8">
          <span className="material-symbols-outlined text-4xl">mark_email_unread</span>
        </div>
        <h1 className="text-3xl font-bold text-on-surface mb-4">Verify your email.</h1>
        <p className="text-on-surface-variant font-semibold text-sm leading-relaxed mb-8">
          User: {user?.email}<br/>
          Status: pending verification
        </p>
        
        <p className="text-on-surface-variant text-sm mb-10 leading-relaxed">
          Please check your inbox and follow the verification link before accessing your dashboard.
        </p>

        {message && (
          <div className="mb-8 p-4 bg-primary/5 text-primary rounded-md text-sm font-bold">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-full py-4 bg-primary text-white font-bold rounded-md text-sm hover:bg-primary-container transition-colors"
          >
            {loading ? 'Checking...' : 'I have verified my email'}
          </button>
          
          <button
            onClick={handleResend}
            disabled={loading}
            className="w-full py-4 bg-surface-container border border-outline text-on-surface font-bold rounded-md text-sm hover:bg-outline/10 transition-colors"
          >
            {loading ? 'Sending...' : 'Resend email'}
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-4 bg-white border border-red-100 text-red-500 font-bold rounded-md text-sm hover:bg-red-50 transition-colors"
          >
            Log out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
