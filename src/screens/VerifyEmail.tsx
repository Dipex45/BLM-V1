import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function VerifyEmail() {
  const [message, setMessage] = useState('');
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

  const handleRefresh = () => {
    window.location.reload();
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
            className="w-full py-4 bg-primary text-white font-bold rounded-md text-sm hover:bg-primary-container transition-colors"
          >
            I have verified my email
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
