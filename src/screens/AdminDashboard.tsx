import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, QueryDocumentSnapshot, startAfter } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { apiDelete, apiErrorMessage, apiGet, apiPost } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { invalidateCatalog, useCatalog } from '../hooks/useCatalog';
import { useCurrency } from '../contexts/CurrencyContext';
import type { BankAccountConfig, PaymentRecord } from '../lib/payments/types';
import AdminSidebar from './admin/components/AdminSidebar';
import AdminHeader from './admin/components/AdminHeader';
import AdminSkeleton from './admin/components/AdminSkeleton';
import { useAdminFeedback } from './admin/hooks/useAdminFeedback';
import type { AdminRole, AdminTab } from './admin/types';
import BookingsTab from './admin/tabs/BookingsTab';
import PaymentsTab from './admin/tabs/PaymentsTab';
import SupportTab from './admin/tabs/SupportTab';
import DriversTab from './admin/tabs/DriversTab';
import PricesTab from './admin/tabs/PricesTab';
import HubsTab from './admin/tabs/HubsTab';
import SchedulesTab from './admin/tabs/SchedulesTab';
import SettingsTab from './admin/tabs/SettingsTab';
import AdminsTab from './admin/tabs/AdminsTab';
import AnalyticsTab from './admin/tabs/AnalyticsTab';
import ReviewsTab from './admin/tabs/ReviewsTab';
import MaintenanceTab from './admin/tabs/MaintenanceTab';

const PAGE_SIZE = 25;

const EMPTY_BANK: BankAccountConfig = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  branchName: '',
  currency: 'NGN',
  instructions: 'Transfer the exact amount and use your BLM payment reference as the narration.',
  deadlineHours: 24,
  contactPhone: '',
  contactEmail: '',
  referencePrefix: 'BLM',
  requireProofUpload: true,
};

const rows = <T,>(snapshot: { docs: QueryDocumentSnapshot[] }) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
const byNewest = (a: any, b: any) => (b.createdAt?.toMillis?.() ?? Date.parse(b.createdAt) ?? 0) - (a.createdAt?.toMillis?.() ?? Date.parse(a.createdAt) ?? 0);

export default function AdminDashboard() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { catalog } = useCatalog();
  const { notify, confirmAction, requestForm, feedbackLayer } = useAdminFeedback();

  const role = (user?.role || 'customer_support_agent') as AdminRole;
  const isSuper = role === 'super_admin' || role === 'admin';
  const canDispatch = isSuper || role === 'dispatcher';
  const canFinance = isSuper || role === 'finance_admin';
  const canSupport = isSuper || role === 'customer_support_agent';

  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const saved = sessionStorage.getItem('blm-admin-tab') as AdminTab | null;
    return saved || 'bookings';
  });
  const [navOpen, setNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [bookings, setBookings] = useState<any[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [analyticsBookings, setAnalyticsBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [blockedDays, setBlockedDays] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [bankConfig, setBankConfig] = useState<BankAccountConfig>(EMPTY_BANK);

  useEffect(() => {
    sessionStorage.setItem('blm-admin-tab', activeTab);
  }, [activeTab]);

  const loadBookings = useCallback(async (more = false) => {
    const base = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    const snapshot = await getDocs(more && cursor ? query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE)) : base);
    const next = rows<any>(snapshot);
    setBookings((current) => (more ? [...current, ...next] : next));
    setCursor(snapshot.docs[snapshot.docs.length - 1] || null);
    setHasMore(snapshot.docs.length === PAGE_SIZE);
  }, [cursor]);

  const loadTab = useCallback(async (tab: AdminTab) => {
    setLoading(true);
    setLoadError(null);
    try {
      switch (tab) {
        case 'bookings':
          await Promise.all([loadBookings(false), getDocs(collection(db, 'drivers')).then((snap) => setDrivers(rows(snap)))]);
          break;
        case 'payments':
          setPayments(rows<PaymentRecord>(await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(300)))));
          break;
        case 'support':
          setTickets((await apiGet<{ tickets: any[] }>('/api/support/tickets')).data.tickets);
          break;
        case 'drivers':
          setDrivers(rows<any>(await getDocs(collection(db, 'drivers'))).sort(byNewest));
          break;
        case 'hubs':
          setHubs(rows<any>(await getDocs(collection(db, 'hubs'))));
          break;
        case 'schedules':
          setBlockedDays(rows<any>(await getDocs(collection(db, 'blocked_dates'))).sort((a, b) => String(a.date).localeCompare(String(b.date))));
          break;
        case 'admins':
          setAdmins(rows<any>(await getDocs(collection(db, 'admins'))));
          break;
        case 'analytics':
          setAnalyticsBookings(rows<any>(await getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(2000)))));
          break;
        case 'reviews':
          setReviews(rows<any>(await getDocs(collection(db, 'reviews'))).sort(byNewest));
          break;
        case 'settings': {
          const bank = await getDoc(doc(db, 'settings', 'bank_accounts'));
          setBankConfig({ ...EMPTY_BANK, ...(bank.data()?.value || {}) });
          await invalidateCatalog();
          break;
        }
        case 'prices':
          await invalidateCatalog();
          break;
        default:
          break;
      }
    } catch (error: any) {
      setLoadError(error?.code === 'permission-denied'
        ? 'You don’t have access to this yet. Try signing out and back in. If it still doesn’t work, ask your site administrator to check your staff access.'
        : apiErrorMessage(error, 'We couldn’t load this section. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [loadBookings]);

  useEffect(() => { void loadTab(activeTab); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Run an API action with toast feedback; reloads the active tab on success. */
  const act = async (action: () => Promise<unknown>, success: string, reload = true) => {
    try {
      await action();
      notify(success, 'success');
      if (reload) await loadTab(activeTab);
    } catch (error) {
      notify(apiErrorMessage(error), 'error');
      throw error;
    }
  };
  /** Errors are already shown as a toast by `act`; swallow them for fire-and-forget handlers. */
  const quiet = (promise: Promise<unknown>): Promise<void> => promise.then(() => undefined, () => undefined);

  const saveSetting = (key: string, value: unknown) =>
    quiet(act(async () => {
      await apiPost(`/api/admin/settings/${key}`, { value });
      await invalidateCatalog();
    }, 'Saved. Customers will see the change straight away.', false));

  const visibleBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((booking) => `${booking.trackingId} ${booking.id} ${booking.customerName} ${booking.customerEmail} ${booking.pickup} ${booking.destination}`.toLowerCase().includes(term));
  }, [bookings, search]);

  const updateStatus = async (booking: any, status: string) => {
    let cancellationReason: string | undefined;
    if (status === 'Cancelled') {
      const reason = await confirmAction({ title: 'Cancel this booking?', message: 'We’ll let the customer know. If they’ve paid, they may need a refund.', confirmLabel: 'Cancel booking', requireReason: true, tone: 'danger' });
      if (reason === null) return;
      cancellationReason = reason;
      if (booking.paymentProvider === 'stripe' && booking.paymentStatus === 'succeeded' && canFinance) {
        const refund = await confirmAction({ title: 'Refund their card?', message: `Send ${formatPrice(booking.totalAmount || 0)} back to the customer’s card.`, confirmLabel: 'Refund now' });
        if (refund !== null) {
          await quiet(act(() => apiPost('/api/payment/stripe/refund', { bookingId: booking.id, reason: cancellationReason }), 'Refund sent and booking cancelled.'));
          return;
        }
      }
    }
    await quiet(act(() => apiPost('/api/bookings/update-status', { bookingId: booking.id, status, cancellationReason }), `Booking updated.`));
  };

  const content = () => {
    if (loading) return <AdminSkeleton />;
    if (loadError) {
      return (
        <div className="alert-error">
          <span className="material-symbols-outlined">error</span>
          <span className="flex-1">{loadError}</span>
          <button type="button" onClick={() => loadTab(activeTab)} className="font-bold underline">Retry</button>
        </div>
      );
    }
    switch (activeTab) {
      case 'bookings':
        return (
          <BookingsTab
            bookings={visibleBookings}
            drivers={drivers.filter((driver) => driver.onboarding?.state === 'approved')}
            formatPrice={formatPrice}
            canUpdateStatus={canDispatch || canSupport}
            canAssign={canDispatch}
            onStatus={updateStatus}
            onAssign={(bookingId, driverId) => quiet(act(() => apiPost('/api/dispatch/assign', { bookingId, driverId }), 'Driver assigned. We’ve sent them a text.'))}
            onAutoAssign={(bookingId) => quiet(act(() => apiPost('/api/dispatch/auto-assign', { bookingId }), 'An available driver has been assigned.'))}
            onCheckpoint={(bookingId, location, status) => quiet(act(() => apiPost('/api/bookings/checkpoint', { bookingId, location, status }), 'Update posted. The customer can see it on their tracking page.'))}
            onLoadMore={() => quiet(loadBookings(true))}
            hasMore={hasMore && !search}
            checkpointSuggestions={catalog?.trackingLocations || []}
          />
        );
      case 'payments':
        return (
          <PaymentsTab
            payments={payments}
            formatPrice={formatPrice}
            canManage={canFinance}
            onApprove={(payment) => act(() => apiPost('/api/payment/manual/review', { paymentId: payment.id, decision: 'approve' }), 'Payment confirmed. The booking is now paid.')}
            onReject={(payment, reason) => act(() => apiPost('/api/payment/manual/review', { paymentId: payment.id, decision: 'reject', reason }), 'Payment declined. The customer can upload a new receipt.')}
            onReconcile={(payment) => act(() => apiPost('/api/admin/payments/reconcile', { paymentId: payment.id, reconciled: !payment.isReconciled }), payment.isReconciled ? 'Marked as not matched.' : 'Marked as matched to bank statement.')}
          />
        );
      case 'support':
        return <SupportTab tickets={tickets} onRefresh={() => loadTab('support')} />;
      case 'drivers':
        return (
          <DriversTab
            drivers={drivers}
            canManage={canDispatch}
            onOnboard={(input) => act(() => apiPost('/api/drivers/onboard', input), 'Driver added. Press Approve so they can start taking trips.')}
            onStatus={async (driver, state) => {
              const reason = state === 'approved' ? '' : await confirmAction({ title: `${state === 'suspended' ? 'Suspend' : 'Reject'} ${driver.name}?`, message: 'They’ll go offline and won’t get any trips.', confirmLabel: state === 'suspended' ? 'Suspend' : 'Reject', requireReason: true, tone: 'danger' });
              if (reason === null) return;
              await quiet(act(() => apiPost(`/api/admin/drivers/${driver.id}/status`, { state, reason: reason || undefined }), state === 'approved' ? 'Driver approved.' : 'Driver updated.'));
            }}
          />
        );
      case 'prices':
        return catalog ? (
          <PricesTab
            prices={catalog.vehicles}
            formatPrice={formatPrice}
            onSave={(index, item) => saveSetting('vehicle_types', catalog.vehicles.map((vehicle, i) => (i === index ? { ...item, price: Number(item.price) || 0, kmRate: Number(item.kmRate) || undefined } : vehicle)))}
            onAdd={async () => {
              const values = await requestForm({
                title: 'Add a car type',
                fields: [
                  { name: 'title', label: 'Name', required: true },
                  { name: 'price', label: 'Starting price (₦)', type: 'number', required: true },
                  { name: 'kmRate', label: 'Price per km (₦)', type: 'number' },
                  { name: 'desc', label: 'Description' },
                ],
              });
              if (!values) return;
              await saveSetting('vehicle_types', [...catalog.vehicles, { title: values.title.trim(), price: Number(values.price) || 0, kmRate: Number(values.kmRate) || undefined, desc: values.desc || '', icon: 'directions_car' }]);
            }}
            onRemove={async (index, title) => {
              if (catalog.vehicles.length <= 1) return notify('You need at least one car type.', 'error');
              const ok = await confirmAction({ title: `Remove ${title}?`, message: 'Customers won’t be able to choose it any more. Existing bookings keep their price.', confirmLabel: 'Remove', tone: 'danger' });
              if (ok === null) return;
              await saveSetting('vehicle_types', catalog.vehicles.filter((_, i) => i !== index));
            }}
          />
        ) : <AdminSkeleton />;
      case 'hubs':
        return (
          <HubsTab
            hubs={hubs}
            onAdd={(name, address) => quiet(act(() => apiPost('/api/admin/hubs', { name, address }).then(invalidateCatalog), 'Pickup point added.'))}
            onDelete={async (id, name) => {
              const reason = await confirmAction({ title: `Remove ${name}?`, message: 'Customers won’t be able to choose this pickup point any more.', confirmLabel: 'Remove', requireReason: true, tone: 'danger' });
              if (reason === null) return;
              await quiet(act(() => apiDelete(`/api/admin/hubs/${id}`, { reason }).then(invalidateCatalog), 'Pickup point removed.'));
            }}
          />
        );
      case 'schedules':
        return (
          <SchedulesTab
            blockedDays={blockedDays}
            onBlock={(date, reason) => quiet(act(() => apiPost('/api/admin/blocked-dates', { date, reason }).then(invalidateCatalog), `${date} is now closed for bookings.`))}
            onUnblock={async (id) => {
              const reason = await confirmAction({ title: 'Open this day again?', message: 'Customers will be able to book this day again.', confirmLabel: 'Open', requireReason: true });
              if (reason === null) return;
              await quiet(act(() => apiDelete(`/api/admin/blocked-dates/${id}`, { reason }).then(invalidateCatalog), 'Day opened for bookings.'));
            }}
          />
        );
      case 'settings':
        return catalog ? (
          <SettingsTab
            canFinance={canFinance}
            canOperations={canDispatch || canFinance}
            pricingRules={catalog.rules as unknown as Record<string, number>}
            touringPackages={catalog.touringPackages}
            touringStates={catalog.touringStates}
            internationalTours={catalog.internationalTours}
            carHireOptions={catalog.carHireOptions}
            trackingLocations={catalog.trackingLocations}
            routes={catalog.routes}
            bankConfig={bankConfig}
            featureFlags={catalog.features}
            currencyRates={catalog.currencyRates}
            onSave={saveSetting}
            onUploadCarImage={async (file) => {
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
              const fileRef = storageRef(storage, `car_hire/${Date.now()}-${safeName}`);
              await uploadBytes(fileRef, file, { contentType: file.type });
              return getDownloadURL(fileRef);
            }}
          />
        ) : <AdminSkeleton />;
      case 'admins':
        return (
          <AdminsTab
            admins={admins}
            currentUid={user?.uid}
            onPromote={(account, nextRole) => quiet(act(() => apiPost('/api/admin/users/role', { account, role: nextRole }), `${account} now has access.`))}
            onRevoke={async (uid, label) => {
              const ok = await confirmAction({ title: `Remove ${label}?`, message: 'They’ll lose admin access straight away and be signed out.', confirmLabel: 'Remove access', tone: 'danger' });
              if (ok === null) return;
              await quiet(act(() => apiDelete(`/api/admin/users/role/${uid}`), 'Access removed.'));
            }}
          />
        );
      case 'analytics':
        return <AnalyticsTab bookings={analyticsBookings} formatPrice={formatPrice} />;
      case 'reviews':
        return (
          <ReviewsTab
            reviews={reviews}
            canModerate={canSupport || canDispatch}
            onStatus={(review, status) => quiet(act(() => apiPost(`/api/admin/reviews/${review.id}/status`, { status }), status === 'hidden' ? 'Review hidden from the website.' : 'Review is now visible.'))}
          />
        );
      case 'maintenance':
        return (
          <MaintenanceTab
            onDiagnostics={async () => (await apiGet('/api/admin/maintenance/diagnostics')).data}
            onArchive={async (reason) => (await apiPost<{ archived: number }>('/api/admin/maintenance/archive-bookings', { olderThanDays: 90, reason })).data.archived}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background">
      <AdminSidebar activeTab={activeTab} role={role} mobileOpen={navOpen} onChange={setActiveTab} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-64">
        <AdminHeader activeTab={activeTab} role={role} onOpenNavigation={() => setNavOpen(true)}>
          {activeTab === 'bookings' && (
            <label className="relative">
              <span className="sr-only">Search bookings</span>
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant">search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bookings" className="field h-9 w-64 py-0 pl-10 text-xs" />
            </label>
          )}
          <button type="button" onClick={() => loadTab(activeTab)} className="flex h-9 w-9 items-center justify-center rounded-md border border-outline bg-white hover:border-primary" aria-label="Refresh">
            <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </AdminHeader>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
              {content()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {feedbackLayer}
    </div>
  );
}
