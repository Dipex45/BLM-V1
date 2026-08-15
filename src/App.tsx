/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { CurrencyProvider } from './contexts/CurrencyContext';
import Dashboard from './screens/Dashboard';
import AdminDashboard from './screens/AdminDashboard';
import Login from './screens/Login';
import Register from './screens/Register';
import Tracking from './screens/Tracking';
import Booking from './screens/Booking';
import Checkout from './screens/Checkout';
import About from './screens/About';
import Services from './screens/Services';
import ServiceOrder from './screens/ServiceOrder';
import Legal from './screens/Legal';
import VerifyEmail from './screens/VerifyEmail';
import { Reports } from './screens/Misc';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CookieNotice from './components/CookieNotice';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md space-y-5">
          <div className="h-14 w-44 animate-pulse rounded-xl bg-surface-container" />
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded-full bg-surface-container" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-surface-container" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 animate-pulse rounded-xl bg-surface-container" />
            <div className="h-20 animate-pulse rounded-xl bg-surface-container" />
            <div className="h-20 animate-pulse rounded-xl bg-surface-container" />
          </div>
        </div>
      </div>
    );
  }

  const isUserAdmin = ['admin', 'super_admin', 'dispatcher', 'finance_admin', 'customer_support_agent'].includes(user?.role);
  const isVerified = user?.emailVerified || user?.isAnonymous || user?.providerData?.some((p: any) => p.providerId === 'google.com');

  return (
    <CurrencyProvider>
      <Router>
        <div className="min-h-screen bg-background text-on-surface font-sans flex flex-col selection:bg-primary selection:text-white overflow-x-hidden">
          <Navbar />
          <div className="flex flex-1 pt-20">
            {user && isVerified && <Sidebar />}
            <main className={`flex-1 transition-all duration-300 ${user && isVerified ? 'md:ml-64' : ''}`}>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={user ? <Navigate to={!isVerified ? "/verify-email" : isUserAdmin ? "/admin" : "/dashboard"} replace /> : <About />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/services/:slug" element={<ServiceOrder />} />
                  <Route path="/login" element={!user ? <Login /> : <Navigate to={isUserAdmin ? "/admin" : "/dashboard"} />} />
                  <Route path="/register" element={!user ? <Register /> : <Navigate to={isUserAdmin ? "/admin" : "/dashboard"} />} />
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
        </div>
      </Router>
    </CurrencyProvider>
  );
}
