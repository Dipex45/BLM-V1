/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Dashboard from './screens/Dashboard';
import AdminDashboard from './screens/AdminDashboard';
import Login from './screens/Login';
import Register from './screens/Register';
import Tracking from './screens/Tracking';
import Booking from './screens/Booking';
import Checkout from './screens/Checkout';
import About from './screens/About';
import Legal from './screens/Legal';
import VerifyEmail from './screens/VerifyEmail';
import { Reports } from './screens/Misc';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CookieNotice from './components/CookieNotice';
import SplashScreen from './components/SplashScreen';
import SupportChat from './components/SupportChat';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="animate-pulse bg-primary h-1 w-32 rounded-full shadow-[0_0_20px_#d40000]"></div>
      </div>
    );
  }

  const isUserAdmin = user?.role === 'admin';
  const isVerified = user?.emailVerified || user?.isAnonymous || user?.providerData?.some((p: any) => p.providerId === 'google.com');

  return (
    <Router>
      <div className="min-h-screen bg-background text-on-surface font-sans flex flex-col selection:bg-primary selection:text-white overflow-x-hidden">
        <Navbar />
        <div className="flex flex-1 pt-20">
          {user && isVerified && <Sidebar />}
          <main className={`flex-1 transition-all duration-300 ${user && isVerified ? 'md:ml-64' : ''}`}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<About />} />
                <Route path="/login" element={!user ? <Login /> : <Navigate to={isUserAdmin ? "/admin" : "/dashboard"} />} />
                <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
                <Route path="/verify-email" element={user && !isVerified ? <VerifyEmail /> : <Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={user ? (!isVerified ? <Navigate to="/verify-email" /> : (isUserAdmin ? <Navigate to="/admin" /> : <Dashboard />)) : <Navigate to="/login" />} />
                <Route path="/admin" element={user && isUserAdmin ? (isVerified ? <AdminDashboard /> : <Navigate to="/verify-email" />) : <Navigate to="/login" />} />
                <Route path="/tracking" element={<Tracking />} />
                <Route path="/booking" element={<Booking />} />
                <Route path="/checkout/:bookingId" element={<Checkout />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/reports" element={user ? <Reports /> : <Navigate to="/login" />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
        <Footer />
        <CookieNotice />
        {user && <SupportChat />}
      </div>
    </Router>
  );
}
