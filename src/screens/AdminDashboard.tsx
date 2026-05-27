import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter
} from 'firebase/firestore';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

import { useCurrency } from '../hooks/useCurrency';
import { logAudit, AuditAction } from '../lib/audit';
import { apiDelete, apiPost } from '../lib/api';
import { company, defaultVehicles } from '../lib/company';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [activeTab, setActiveTab] = useState<'bookings' | 'prices' | 'hubs' | 'schedules' | 'admins' | 'drivers' | 'analytics' | 'maintenance' | 'reviews'>('bookings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  
  // Data States
  const [bookings, setBookings] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [blockedDays, setBlockedDays] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async (loadMore = false) => {
    if (!loadMore) {
      setLoading(true);
      setBookings([]);
      setLastVisible(null);
      setHasMore(true);
    }
    
    setError(null);
    try {
      if (activeTab === 'bookings') {
        let q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(15));
        
        if (loadMore && lastVisible) {
          q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(15));
        }

        const snap = await getDocs(q);
        const newBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setLastVisible(snap.docs[snap.docs.length - 1]);
        setHasMore(snap.docs.length === 15);
        
        if (loadMore) {
          setBookings(prev => [...prev, ...newBookings]);
        } else {
          setBookings(newBookings);
        }
      } else if (activeTab === 'hubs') {
        const snap = await getDocs(collection(db, 'hubs'));
        setHubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'prices') {
        const snap = await getDocs(collection(db, 'settings'));
        const p = snap.docs.find(d => d.id === 'vehicle_types')?.data()?.value || [];
        if (p.length === 0) {
           const defaults = [
             ...defaultVehicles,
           ];
           setPrices(defaults);
        } else {
           setPrices(p);
        }
      } else if (activeTab === 'schedules') {
        const snap = await getDocs(collection(db, 'blocked_dates'));
        setBlockedDays(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'admins') {
        const snap = await getDocs(collection(db, 'admins'));
        setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'drivers') {
        const snap = await getDocs(collection(db, 'drivers'));
        setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'reviews') {
        const snap = await getDocs(collection(db, 'reviews'));
        setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'analytics') {
        // Fetch ALL bookings for deep analysis
        const snap = await getDocs(collection(db, 'bookings'));
        const allBookings = snap.docs.map(d => d.data());
        
        // Calculate Analytics
        const revenueByVehicle = allBookings.reduce((acc: any, b: any) => {
          if (b.status === 'Booked' || b.status === 'Completed' || b.status === 'Paid') {
            acc[b.vehicleClass] = (acc[b.vehicleClass] || 0) + (b.totalAmount || 0);
          }
          return acc;
        }, {});

        const statusCounts = allBookings.reduce((acc: any, b: any) => {
          acc[b.status] = (acc[b.status] || 0) + 1;
          return acc;
        }, {});

        const dailyRevenue = allBookings.reduce((acc: any, b: any) => {
          if (b.status === 'Booked' || b.status === 'Completed' || b.status === 'Paid') {
            acc[b.date] = (acc[b.date] || 0) + (b.totalAmount || 0);
          }
          return acc;
        }, {});

          setAnalyticsData({
            revenueByVehicle: Object.entries(revenueByVehicle).map(([name, value]) => ({ name, value })),
            statusCounts: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
            dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
            totalRevenue: allBookings.filter((b: any) => ['Booked', 'Completed', 'Paid', 'Confirmed', 'Dispatched'].includes(b.status)).reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0),
            activeVectors: allBookings.filter((b: any) => ['Paid', 'Confirmed', 'Dispatched'].includes(b.status)).length,
            completedManifests: allBookings.filter((b: any) => b.status === 'Completed').length,
            cancelledVectors: allBookings.filter((b: any) => b.status === 'Cancelled').length,
            recurringPercentage: (allBookings.filter((b: any) => b.isRecurring).length / (allBookings.length || 1) * 100).toFixed(1)
          });
      }
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('the client is offline')) {
        setError("Network connection issue. System is currently offline.");
      } else {
        setError("Failed to fetch administrative data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (index: number, newPrice: number) => {
    try {
      const updated = [...prices];
      const oldPrice = updated[index].price;
      updated[index].price = newPrice;
      setPrices(updated);
      await setDoc(doc(db, 'settings', 'vehicle_types'), { key: 'vehicle_types', value: updated });
      
      await logAudit(user?.uid || 'sys', user?.email || 'sys', AuditAction.UPDATE_SETTING, {
        vehicle: updated[index].title,
        oldPrice,
        newPrice
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/vehicle_types');
    }
  };

  const handleAddHub = async (e: any) => {
    e.preventDefault();
    try {
      const name = e.target.hubName.value;
      const address = e.target.hubAddress.value;
      const docRef = await addDoc(collection(db, 'hubs'), { name, address, active: true });
      
      await logAudit(user?.uid || 'sys', user?.email || 'sys', AuditAction.UPDATE_SETTING, {
        action: 'ADD_HUB',
        hubId: docRef.id,
        name
      });

      e.target.reset();
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'hubs');
    }
  };

  const handleDeleteHub = async (id: string, name: string) => {
    if (!window.confirm(`Are you absolutely sure you want to remove ${name}? This could affect scheduled routes.`)) return;
    try {
      await deleteDoc(doc(db, 'hubs', id));
      await logAudit(user?.uid || 'sys', user?.email || 'sys', AuditAction.UPDATE_SETTING, {
        action: 'DELETE_HUB',
        hubId: id,
        name
      });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `hubs/${id}`);
    }
  };

  const unblockDate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'blocked_dates', id));
      await logAudit(user?.uid || 'sys', user?.email || 'sys', AuditAction.UPDATE_SETTING, {
        action: 'UNBLOCK_DATE',
        id
      });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `blocked_dates/${id}`);
    }
  };

  const updateBookingStatus = async (id: string, status: string, oldStatus: string, bookingData: any) => {
    try {
      setLoading(true);
      
      // If cancelling a paid booking, trigger refund
      const wasPaid = (oldStatus === 'Booked' || oldStatus === 'Paid') && bookingData.paymentIntentId && bookingData.paymentProvider === 'stripe';
      if (status === 'Cancelled' && wasPaid) {
        if (window.confirm("This booking was paid for. Should we initialize an automatic refund via Stripe?")) {
          const refundRes = await apiPost('/api/payment/stripe/refund', {
            paymentIntentId: bookingData.paymentIntentId,
            bookingId: id,
            reason: 'admin_cancellation'
          });
          if (!refundRes.data?.success) throw new Error('Refund failed');
          alert("Refund processed by Stripe.");
        }
      }

      // If assigning a driver or dispatching, trigger driver SMS
      if ((status === 'Confirmed' || status === 'Dispatched') && bookingData.driverId) {
        const driver = drivers.find(d => d.id === bookingData.driverId);
        if (driver) {
          await apiPost('/api/drivers/notify', {
            driverId: driver.id,
            driverPhone: driver.phone || '000-000-0000',
            driverName: driver.name,
            bookingId: id,
            pickup: bookingData.pickup,
            destination: bookingData.destination
          });
        }
      }

      await apiPost('/api/bookings/update-status', {
        bookingId: id,
        status,
        assignedDriverId: bookingData.driverId || undefined,
        cancellationReason: status === 'Cancelled' ? 'admin_status_update' : undefined
      });

      await logAudit(user?.uid || 'sys', user?.email || 'sys', AuditAction.UPDATE_BOOKING, {
        bookingId: id,
        oldStatus,
        newStatus: status,
        refundTriggered: !!(status === 'Cancelled' && wasPaid)
      });

      fetchData();
    } catch (err: any) {
      console.error(err);
      alert(`Update error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteAdmin = async (e: any) => {
    e.preventDefault();
    const uid = e.target.userUid.value.trim();
    if (!uid) return;
    try {
      await apiPost('/api/admin/users/role', { uid, role: 'dispatcher' });
      await logAudit(user?.uid || 'sys', user?.email || 'sys', AuditAction.UPDATE_SETTING, {
        action: 'PROMOTE_ADMIN',
        targetUid: uid
      });
      e.target.reset();
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${uid}`);
    }
  };

  const handleRevokeAdmin = async (id: string) => {
    if (!window.confirm("Are you sure you want to revoke these privileges?")) return;
    try {
      await apiDelete(`/api/admin/users/role/${id}`);
      await logAudit(user?.uid || 'sys', user?.email || 'sys', AuditAction.UPDATE_SETTING, {
        action: 'REVOKE_ADMIN',
        targetUid: id
      });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `admins/${id}`);
    }
  };

  const exportBookingsCSV = () => {
    const headers = ['Booking ID', 'Customer', 'Email', 'Pickup', 'Destination', 'Date', 'Amount', 'Status'];
    const rows = bookings.map(b => [
      b.id,
      b.customerName,
      b.customerEmail,
      b.pickup,
      b.destination,
      b.date,
      b.totalAmount,
      b.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `blm_bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = b.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         b.pickup?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         b.destination?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         b.id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 flex flex-col gap-8 md:gap-10 bg-background min-h-screen">
      <header className="flex flex-col gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-primary text-on-primary text-xs font-bold rounded-md">Admin access</span>
            <span className="text-xs font-bold text-on-surface-variant">Operations management</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-sans font-bold leading-none text-on-surface">Admin panel.</h1>
          <p className="text-on-surface-variant text-sm font-semibold mt-3 flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Service: stable</span>
            <span className="opacity-20 text-on-surface">|</span>
            <span className="font-bold opacity-60">User: {user?.fullName || 'Admin'}</span>
          </p>
        </div>

        <nav className="flex items-center justify-between bg-white p-1 rounded-lg border border-outline shadow-sm overflow-x-auto no-scrollbar scroll-smooth gap-4">
          <div className="flex gap-1">
            {(['bookings', 'prices', 'hubs', 'drivers', 'admins', 'analytics', 'reviews', 'maintenance'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-bold transition-all rounded-md whitespace-nowrap ${
                  activeTab === tab 
                    ? 'bg-primary text-white' 
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'bookings' && (
            <div className="flex items-center gap-2 pr-2">
               <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-sm">search</span>
                 <input 
                   type="text" 
                   placeholder="Search..." 
                   className="pl-9 pr-3 py-2 bg-surface-container border border-outline rounded-md text-sm font-semibold w-48"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
               </div>
               <select 
                 className="bg-surface-container border border-outline rounded-md p-2 text-sm font-semibold"
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value)}
               >
                 <option value="All">All Status</option>
                 <option value="Quoted">Quoted</option>
                 <option value="Paid">Paid</option>
                 <option value="Dispatched">Dispatched</option>
                 <option value="Completed">Completed</option>
                 <option value="Cancelled">Cancelled</option>
               </select>
               <button 
                 onClick={exportBookingsCSV}
                 className="p-2 bg-primary/10 text-primary rounded-md hover:bg-primary hover:text-white transition-all flex items-center gap-2 text-sm font-bold"
               >
                 <span className="material-symbols-outlined text-sm">download</span>
                 CSV
               </button>
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'bookings' && (
            <motion.div 
              key="bookings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-lg border border-outline shadow-sm overflow-hidden"
            >
              <div className="p-8 border-b border-outline bg-surface-container/30">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span> 
                  All Bookings
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container/20 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                      <th className="p-6 border-b border-outline">ID</th>
                      <th className="p-6 border-b border-outline">Customer</th>
                      <th className="p-6 border-b border-outline">Route</th>
                      <th className="p-6 border-b border-outline">Vehicle</th>
                      <th className="p-6 border-b border-outline">Status</th>
                      <th className="p-6 border-b border-outline">Amount</th>
                      <th className="p-6 border-b border-outline">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-surface-container/10 transition-colors">
                        <td className="p-6 border-b border-outline font-mono text-[10px]">{b.id?.slice(-6)}</td>
                        <td className="p-6 border-b border-outline font-medium">{b.customerId?.slice(-6)}</td>
                        <td className="p-6 border-b border-outline">
                          <div className="flex flex-col">
                            <span className="font-bold">{b.pickup}</span>
                            <span className="text-[10px] text-on-surface-variant">to {b.destination}</span>
                          </div>
                        </td>
                        <td className="p-6 border-b border-outline">{b.vehicleClass}</td>
                        <td className="p-6 border-b border-outline">
                           <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                             b.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
                           }`}>
                             {b.status}
                           </span>
                        </td>
                        <td className="p-6 border-b border-outline font-bold">{formatPrice(b.totalAmount)}</td>
                        <td className="p-6 border-b border-outline">
                           <div className="flex flex-col gap-2">
                             <select 
                               className="bg-surface-container border border-outline rounded-lg p-2 text-xs font-bold"
                               value={b.status}
                               onChange={(e) => updateBookingStatus(b.id, e.target.value, b.status, b)}
                             >
                               <option value="Quoted">Quoted</option>
                               <option value="Paid">Paid</option>
                               <option value="Confirmed">Confirmed</option>
                               <option value="Dispatched">Dispatched</option>
                               <option value="Completed">Completed</option>
                               <option value="Cancelled">Cancelled</option>
                             </select>
                             {(b.status === 'Paid' || b.status === 'Confirmed' || b.status === 'Dispatched') && (
                               <select 
                                 className="bg-surface-container border border-outline rounded-lg p-2 text-[9px] font-bold uppercase tracking-widest"
                                 value={b.driverId || ''}
                                 onChange={async (e) => {
                                   try {
                                     await updateDoc(doc(db, 'bookings', b.id), { driverId: e.target.value });
                                     fetchData();
                                   } catch (err) {
                                     handleFirestoreError(err, OperationType.UPDATE, `bookings/${b.id}`);
                                   }
                                 }}
                               >
                                 <option value="">Assign Driver</option>
                                 {drivers.map(d => (
                                   <option key={d.id} value={d.id}>{d.name}</option>
                                 ))}
                               </select>
                             )}
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <div className="p-8 text-center border-t border-outline">
                  <button 
                    onClick={() => fetchData(true)}
                    className="px-8 py-3 border-2 border-primary text-primary font-bold text-sm rounded-md hover:bg-primary hover:text-white transition-colors"
                  >
                    Load more bookings
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'analytics' && analyticsData && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                 <div className="bg-white p-8 rounded-lg border border-outline shadow-sm group">
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Global Revenue</span>
                       <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">payments</span>
                    </div>
                    <p className="text-4xl font-bold">{formatPrice(analyticsData.totalRevenue)}</p>
                    <p className="text-xs font-semibold text-on-surface-variant mt-2">Gross revenue</p>
                 </div>
                 <div className="bg-white p-8 rounded-lg border border-outline shadow-sm group">
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Fleet Efficiency</span>
                       <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">network_check</span>
                    </div>
                    <p className="text-4xl font-bold">98.4%</p>
                    <p className="text-xs font-semibold text-on-surface-variant mt-2">Operational uptime</p>
                 </div>
                 <div className="bg-white p-8 rounded-lg border border-outline shadow-sm group">
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-xs font-bold text-on-surface-variant">Total bookings</span>
                       <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">hub</span>
                    </div>
                    <p className="text-4xl font-bold">{bookings.length + (lastVisible ? '+' : '')}</p>
                    <p className="text-xs font-semibold text-on-surface-variant mt-2">Registered routes</p>
                 </div>
                 <div className="bg-white p-8 rounded-lg border border-outline shadow-sm group">
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Recurring Ratio</span>
                       <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">sync</span>
                    </div>
                    <p className="text-4xl font-bold">{analyticsData.recurringPercentage}%</p>
                    <p className="text-xs font-semibold text-on-surface-variant mt-2">Recurring bookings</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Daily Revenue Chart */}
                 <div className="bg-white p-8 rounded-lg border border-outline shadow-sm overflow-hidden h-[400px] flex flex-col">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-8 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Daily Inflow Stream
                    </h3>
                    <div className="flex-1 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analyticsData.dailyRevenue}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                             <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                             <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => formatPrice(Number(val))} />
                             <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}
                                labelStyle={{ color: '#D40000' }}
                             />
                             <Line type="monotone" dataKey="amount" stroke="#D40000" strokeWidth={3} dot={{ r: 4, fill: '#D40000' }} activeDot={{ r: 6 }} />
                          </LineChart>
                       </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Revenue by Vehicle */}
                 <div className="bg-white p-8 rounded-lg border border-outline shadow-sm overflow-hidden h-[400px] flex flex-col">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-8 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Booking performance
                    </h3>
                    <div className="flex-1 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsData.revenueByVehicle} layout="vertical">
                             <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                             <XAxis type="number" hide />
                             <YAxis dataKey="name" type="category" fontSize={10} axisLine={false} tickLine={false} width={80} />
                             <Tooltip 
                                cursor={{ fill: 'rgba(212,0,0,0.05)' }}
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}
                             />
                             <Bar dataKey="value" fill="#D40000" radius={[0, 4, 4, 0]} barSize={20} />
                          </BarChart>
                       </ResponsiveContainer>
                    </div>
                 </div>
                 
                 {/* Status Distribution */}
                 <div className="bg-white p-8 rounded-lg border border-outline shadow-sm lg:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-8 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Booking status breakdown
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                       {analyticsData.statusCounts.map((s: any, i: number) => (
                         <div key={i} className="p-6 bg-surface-container/50 rounded-2xl border border-outline text-center">
                            <p className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 underline">{s.name}</p>
                            <p className="text-2xl font-bold">{s.value}</p>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reviews' && (
            <motion.div 
              key="reviews"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-outline shadow-sm overflow-hidden"
            >
              <div className="p-8 border-b border-outline bg-surface-container/30">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">reviews</span> 
                  Customer feedback
                </h3>
              </div>
              <div className="divide-y divide-outline">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-8 hover:bg-surface-container/10 transition-colors">
                     <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                              {rev.rating}
                           </div>
                           <div>
                              <p className="text-xs font-bold">Booking #{rev.bookingId.slice(-6)}</p>
                              <p className="text-[10px] text-on-surface-variant font-medium">Customer: {rev.customerId.slice(-6)}</p>
                           </div>
                        </div>
                        <span className="text-[9px] font-bold text-on-surface-variant uppercase">{rev.createdAt}</span>
                     </div>
                     <p className="text-sm italic text-on-surface">{rev.comment}</p>
                  </div>
                ))}
                {reviews.length === 0 && <div className="p-20 text-center text-on-surface-variant font-semibold text-sm">No feedback has been recorded yet.</div>}
              </div>
            </motion.div>
          )}

          {activeTab === 'prices' && (
            <motion.div 
              key="prices"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {prices.map((p, i) => (
                <div key={i} className="bg-white p-8 rounded-lg border border-outline shadow-sm flex flex-col gap-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-3xl">{p.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xl mb-1">{p.title}</h4>
                    <p className="text-xs text-on-surface-variant font-medium">{p.desc}</p>
                  </div>
                  <div className="mt-auto">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Base price (NGN)</label>
                    <div className="flex flex-col gap-2">
                       <p className="text-[10px] font-bold text-primary uppercase">Localized: {formatPrice(p.price)}</p>
                       <input 
                         type="number" 
                         className="w-full bg-surface-container border border-outline p-4 rounded-xl font-bold text-2xl text-on-surface"
                         value={p.price}
                         onChange={(e) => handleUpdatePrice(i, parseInt(e.target.value))}
                       />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'hubs' && (
            <motion.div 
              key="hubs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12"
            >
              <div className="bg-white p-10 rounded-lg border border-outline shadow-sm">
                <h3 className="font-bold text-xl mb-8">Add new hub</h3>
                <form onSubmit={handleAddHub} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Hub Name</label>
                    <input name="hubName" required className="w-full bg-surface-container border border-outline p-4 rounded-xl" placeholder="e.g. Lagos Operations Hub" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Physical Address</label>
                    <input name="hubAddress" required className="w-full bg-surface-container border border-outline p-4 rounded-xl" placeholder="Full street address" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-md text-sm">
                    Add hub
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-lg border border-outline shadow-sm overflow-hidden flex flex-col">
                <div className="p-8 border-b border-outline bg-surface-container/30">
                  <h3 className="font-bold">Active Hub Network</h3>
                </div>
                <div className="divide-y divide-outline">
                  {hubs.map((hub) => (
                    <div key={hub.id} className="p-6 flex items-center justify-between group">
                      <div>
                        <p className="font-bold text-lg">{hub.name}</p>
                        <p className="text-xs text-on-surface-variant">{hub.address}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteHub(hub.id, hub.name)}
                        className="w-10 h-10 rounded-xl bg-primary/10 text-primary opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  ))}
                  {hubs.length === 0 && <div className="p-10 text-center text-on-surface-variant italic">No hubs defined. Use form to add.</div>}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'schedules' && (
             <motion.div 
               key="schedules"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white p-12 rounded-lg border border-outline shadow-sm text-center"
             >
                <span className="material-symbols-outlined text-6xl text-primary mb-6">event_busy</span>
                <h3 className="text-2xl font-bold mb-4">Availability control</h3>
                <p className="text-on-surface-variant max-w-md mx-auto mb-10">
                  Mark out entire days or specific time windows as unavailable for service.
                </p>
                
                <div className="max-w-xl mx-auto space-y-8">
                   <div className="p-6 border border-outline rounded-lg bg-surface-container/30 text-left">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Select Date to Block</label>
                      <div className="flex gap-4">
                        <input type="date" className="flex-1 bg-white border border-outline p-4 rounded-xl" id="blockDate" />
                        <button 
                          onClick={async () => {
                             const dateInput = document.getElementById('blockDate') as HTMLInputElement;
                             if (!dateInput.value) return;
                             await addDoc(collection(db, 'blocked_dates'), { date: dateInput.value, reason: 'Maintenance' });
                             dateInput.value = '';
                             alert('Date blocked.');
                          }}
                          className="px-8 bg-primary text-white font-bold rounded-md text-sm"
                        >
                          Block date
                        </button>
                      </div>
                   </div>
                   
                   <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Active Disruptions</p>
                   <div className="grid grid-cols-1 gap-4">
                      {blockedDays.map((block) => (
                        <div key={block.id} className="p-4 bg-white border border-outline rounded-xl flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <span className="material-symbols-outlined text-primary text-xl">block</span>
                              <div>
                                 <p className="font-bold text-sm">{block.date}</p>
                                 <p className="text-[10px] text-on-surface-variant uppercase font-medium">{block.reason}</p>
                              </div>
                           </div>
                           <button 
                             onClick={() => unblockDate(block.id)}
                             className="text-primary hover:text-primary-container p-2"
                           >
                              <span className="material-symbols-outlined text-lg">close</span>
                           </button>
                        </div>
                      ))}
                      {blockedDays.length === 0 && <p className="text-xs italic text-on-surface-variant">No active schedule constraints.</p>}
                   </div>
                </div>
             </motion.div>
          )}

          {activeTab === 'drivers' && (
            <motion.div 
              key="drivers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12"
            >
              <div className="bg-white p-10 rounded-lg border border-outline shadow-sm">
                  <h3 className="font-bold text-xl mb-8">Register new driver</h3>
                  <form onSubmit={async (e: any) => {
                    e.preventDefault();
                    const name = e.target.driverName.value;
                    const license = e.target.license.value;
                    const phone = e.target.driverPhone.value;
                    await apiPost('/api/drivers/onboard', { name, license, phone });
                    e.target.reset();
                    fetchData();
                  }} className="space-y-6">
                     <div>
                       <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Full Legal Name</label>
                       <input name="driverName" required className="w-full bg-surface-container border border-outline p-4 rounded-xl" placeholder="e.g. Samuel Okafor" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">License Reference</label>
                          <input name="license" required className="w-full bg-surface-container border border-outline p-4 rounded-xl" placeholder="A-XXXXX-XXXX" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Phone</label>
                          <input name="driverPhone" required className="w-full bg-surface-container border border-outline p-4 rounded-xl" placeholder="+234 906 409 0276" />
                        </div>
                     </div>
                     <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-xl uppercase tracking-widest text-xs">
                       Onboard Driver
                     </button>
                  </form>
              </div>

              <div className="bg-white rounded-lg border border-outline shadow-sm overflow-hidden flex flex-col">
                <div className="p-8 border-b border-outline bg-surface-container/30 flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">badge</span>
                    Fleet Personnel
                  </h3>
                   <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{drivers.length} Active</span>
                </div>
                <div className="divide-y divide-outline">
                  {drivers.map((driver) => (
                    <div key={driver.id} className="p-6 flex items-center justify-between group">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant font-bold">
                             {driver.name?.[0]}
                          </div>
                          <div>
                             <p className="font-bold">{driver.name}</p>
                             <p className="text-[10px] text-on-surface-variant uppercase font-medium">License: {driver.license}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                            driver.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {driver.status}
                          </span>
                       </div>
                    </div>
                  ))}
                  {drivers.length === 0 && <div className="p-12 text-center text-on-surface-variant italic">No drivers registered in fleet.</div>}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'admins' && (
            <motion.div 
              key="admins"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12"
            >
              <div className="bg-white p-10 rounded-lg border border-outline shadow-sm h-fit">
                <h3 className="font-bold text-xl mb-2">Promote admin</h3>
                <p className="text-xs text-on-surface-variant mb-8 font-medium">Elevate a user to operational control by searching their system UID.</p>
                
                {isSuperAdmin ? (
                  <form onSubmit={handlePromoteAdmin} className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">User UID</label>
                      <input name="userUid" required className="w-full bg-surface-container border border-outline p-4 rounded-xl font-mono text-xs" placeholder="Paste full User UID here..." />
                    </div>
                    <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-md text-sm flex items-center justify-center gap-3">
                      <span className="material-symbols-outlined">shield_person</span>
                      Promote user
                    </button>
                    <p className="text-[9px] text-center text-on-surface-variant uppercase font-bold italic">Critical Operation: Super-Admin Clearance Required</p>
                  </form>
                ) : (
                  <div className="p-8 border-2 border-dashed border-outline rounded-lg text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">lock</span>
                    <p className="text-xs font-bold text-on-surface-variant uppercase">Access Denied</p>
                    <p className="text-[10px] text-on-surface-variant/60 mt-2">Only Super-Admins can authorize new staff promotions.</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-outline shadow-sm overflow-hidden flex flex-col">
                <div className="p-8 border-b border-outline bg-surface-container/30 flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">security</span>
                    Operational Staff
                  </h3>
                   <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{admins.length + 1} Active</span>
                </div>
                <div className="divide-y divide-outline">
                  {/* Super Admin Always First */}
                  <div className="p-6 flex items-center justify-between bg-primary/5">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                           <span className="material-symbols-outlined">stars</span>
                        </div>
                        <div>
                           <p className="font-bold text-sm">{user?.email}</p>
                           <p className="text-xs text-primary font-bold">Active admin session</p>
                        </div>
                     </div>
                  </div>

                  {admins.map((admin) => (
                    <div key={admin.id} className="p-6 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                           <span className="material-symbols-outlined">person</span>
                        </div>
                        <div>
                           <p className="font-mono text-xs">{admin.id}</p>
                           <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest mt-0.5">Role: Operations Specialist</p>
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <button 
                          onClick={() => handleRevokeAdmin(admin.id)}
                          className="w-10 h-10 rounded-xl bg-red-50 text-red-600 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all hover:bg-red-600 hover:text-white"
                        >
                          <span className="material-symbols-outlined text-lg">no_accounts</span>
                        </button>
                      )}
                    </div>
                  ))}
                  {admins.length === 0 && (
                    <div className="p-12 text-center">
                      <p className="text-xs text-on-surface-variant italic">No additional staff members promoted.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'maintenance' && (
            <motion.div 
              key="maintenance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-12 rounded-lg border border-outline shadow-sm"
            >
              <h3 className="text-2xl font-bold mb-4">Maintenance</h3>
              <p className="text-on-surface-variant max-w-md mb-10">
                Perform administrative database cleanup and optimization tasks.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="p-8 border border-outline rounded-lg bg-surface-container/30">
                    <h4 className="font-bold mb-2 text-sm">Archive old bookings</h4>
                    <p className="text-xs text-on-surface-variant mb-6">Move completed bookings older than 90 days to archive.</p>
                    <button 
                      onClick={async () => {
                        if (!window.confirm("Commence global archival process? This will move indices to secondary storage.")) return;
                        setLoading(true);
                        try {
                          const ninetyDaysAgo = new Date();
                          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                          
                          const q = query(collection(db, 'bookings'), orderBy('date'));
                          const snap = await getDocs(q);
                          const oldBookings = snap.docs.filter(d => {
                            const b = d.data();
                            return new Date(b.date) < ninetyDaysAgo && (b.status === 'Completed' || b.status === 'Cancelled');
                          });

                          if (oldBookings.length === 0) {
                            alert("No qualifying bookings found for archival.");
                            return;
                          }

                          for (const docSnap of oldBookings) {
                            await setDoc(doc(db, 'archived_bookings', docSnap.id), docSnap.data());
                            await deleteDoc(doc(db, 'bookings', docSnap.id));
                          }

                          alert(`Successfully archived ${oldBookings.length} bookings.`);
                          fetchData();
                        } catch (err) {
                          console.error(err);
                          alert("Archival process failed.");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="w-full py-4 bg-on-surface text-white font-bold rounded-md text-sm hover:bg-black transition-colors"
                    >
                      Archive old bookings
                    </button>
                 </div>

                 <div className="p-8 border border-outline rounded-lg bg-surface-container/30">
                    <h4 className="font-bold mb-2 text-sm">Data check</h4>
                    <p className="text-xs text-on-surface-variant mb-6">Re-validate operational records against the current data rules.</p>
                    <button
                      onClick={() => {
                        const missingCustomer = bookings.filter((booking) => !booking.customerId || !booking.customerEmail).length;
                        const missingRoute = bookings.filter((booking) => !booking.pickup || !booking.destination).length;
                        const missingAmount = bookings.filter((booking) => !booking.totalAmount).length;
                        alert(`Diagnostic complete.\nBookings checked: ${bookings.length}\nMissing customer data: ${missingCustomer}\nMissing route data: ${missingRoute}\nMissing amount: ${missingAmount}`);
                      }}
                      className="w-full py-4 border-2 border-outline text-on-surface-variant font-bold rounded-md text-sm hover:bg-surface-container transition-colors"
                    >
                      Run Diagnostic Scan
                    </button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Supply Chain Metrics Overlay */}
      <footer className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t border-outline">
         {[
           { label: 'Bookings loaded', val: bookings.length.toString(), icon: 'receipt_long' },
           { label: 'Drivers loaded', val: drivers.length.toString(), icon: 'badge' },
           { label: 'Reviews loaded', val: reviews.length.toString(), icon: 'reviews' },
           { label: 'Support', val: company.phoneDisplay, icon: 'call' },
         ].map((stat) => (
           <div key={stat.label} className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant border border-outline">
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
              <div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant leading-tight mb-1">{stat.label}</p>
                 <p className="text-lg font-bold">{stat.val}</p>
              </div>
           </div>
         ))}
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(212, 0, 0, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(212, 0, 0, 0.5); }
      `}</style>
    </div>
  );
}
