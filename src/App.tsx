import { lazy, ReactNode, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './hooks/useAuth';
import { isStaffRole, landingPathForRole } from './lib/authFlow';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CookieNotice from './components/CookieNotice';
import { ErrorBoundary } from './components/ErrorBoundary';
import { easeOutExpo } from './components/ui/motion';
import About from './screens/About';
import Login from './screens/Login';
import Register from './screens/Register';
import VerifyEmail from './screens/VerifyEmail';

const Services = lazy(() => import('./screens/Services'));
const ServiceOrder = lazy(() => import('./screens/ServiceOrder'));
const Tracking = lazy(() => import('./screens/Tracking'));
const Checkout = lazy(() => import('./screens/Checkout'));
const Dashboard = lazy(() => import('./screens/Dashboard'));
const BookingHistory = lazy(() => import('./screens/BookingHistory'));
const Reviews = lazy(() => import('./screens/Reviews'));
const Support = lazy(() => import('./screens/Support'));
const DriverPortal = lazy(() => import('./screens/DriverPortal'));
const AdminDashboard = lazy(() => import('./screens/AdminDashboard'));
const Legal = lazy(() => import('./screens/Legal'));

function Splash() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white">
      <motion.div className="flex flex-col items-center gap-6" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: easeOutExpo }}>
        <img src="/brand/blm-logo-wide.png" alt="BLM Motors" className="h-14 w-36 object-contain" />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-container">
          <motion.div className="h-full w-1/3 rounded-full bg-primary" animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      </motion.div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="container-page space-y-4 py-16" aria-label="Loading page">
      <div className="skeleton h-10 w-1/3" />
      <div className="skeleton h-5 w-1/2" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-48" />)}</div>
    </div>
  );
}

/** Signed-in, verified users only; optionally restricted to roles. */
function Protected({ children, allow }: { children: ReactNode; allow?: (role: string) => boolean }) {
  const { user, needsVerification } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (needsVerification) return <Navigate to="/verify-email" replace />;
  if (allow && !allow(user.role)) return <Navigate to={landingPathForRole(user.role)} replace />;
  return <>{children}</>;
}

/** Login/register pages: once signed in, continue where the user was heading. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, needsVerification } = useAuth();
  const location = useLocation();
  if (!user) return <>{children}</>;
  if (needsVerification) return <Navigate to="/verify-email" replace />;
  const from = (location.state as { from?: string } | null)?.from || sessionStorage.getItem('blm-return-to');
  sessionStorage.removeItem('blm-return-to');
  return <Navigate to={from && !from.startsWith('/login') ? from : landingPathForRole(user.role)} replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  const { user, needsVerification } = useAuth();
  const isStaff = (role: string) => isStaffRole(role);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.35, ease: easeOutExpo }}
      >
        <Suspense fallback={<PageFallback />}>
          <Routes location={location}>
            <Route path="/" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:slug" element={<ServiceOrder />} />
            <Route path="/tracking" element={<Tracking />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route
              path="/verify-email"
              element={!user ? <Navigate to="/login" replace /> : needsVerification ? <VerifyEmail /> : <Navigate to={landingPathForRole(user.role)} replace />}
            />
            <Route path="/dashboard" element={<Protected allow={(role) => !isStaff(role) && role !== 'driver'}><Dashboard /></Protected>} />
            <Route path="/bookings" element={<Protected><BookingHistory /></Protected>} />
            <Route path="/support" element={<Protected><Support /></Protected>} />
            <Route path="/checkout/:bookingId" element={<Protected><Checkout /></Protected>} />
            <Route path="/driver" element={<Protected allow={(role) => role === 'driver'}><DriverPortal /></Protected>} />
            <Route path="/admin" element={<Protected allow={isStaff}><AdminDashboard /></Protected>} />
            <Route path="/reports" element={<Navigate to="/bookings" replace />} />
            <Route path="/booking" element={<Navigate to="/services" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const { sessionError, user } = useAuth();
  const isAdmin = pathname.startsWith('/admin');
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background font-sans text-on-surface">
      <ScrollToTop />
      <Navbar />
      <main className="min-w-0 flex-1 pt-20">
        {user && sessionError && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900" role="status">
            {sessionError} Some features may not work until this is fixed.
          </div>
        )}
        <ErrorBoundary>
          <AnimatedRoutes />
        </ErrorBoundary>
      </main>
      {!isAdmin && <Footer />}
      <CookieNotice />
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <Splash />;
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
