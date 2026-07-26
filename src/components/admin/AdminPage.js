// src/components/Admin/AdminPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, update, push, set, get } from 'firebase/database';
import { database } from '../config/Firebase';
import { sendRejectionEmail, sendAdminInvitation, sendApprovalEmail } from '../services/EmailService';
import AlertCard, { useAlert } from './AlertCard';

const AdminPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingStations, setPendingStations] = useState([]);
  const [approvedStations, setApprovedStations] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStations: 0,
    pendingStations: 0,
    approvedStations: 0,
    totalOrders: 0
  });
  const [selectedStation, setSelectedStation] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [rejectingStationId, setRejectingStationId] = useState(null); // Track rejecting station
  const navigate = useNavigate();
  const [alertProps, showAlert, closeAlert] = useAlert();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [removingAdminId, setRemovingAdminId] = useState(null);
  const unsubscribeRef = useRef(null);

  // Admin credentials (you should change these and keep them secure)
  const ADMIN_EMAIL = 'admin@aquallera.com';
  const ADMIN_PASSWORD = 'admin123';

  useEffect(() => {
    // Check if already authenticated from localStorage
    const storedAuth = localStorage.getItem('adminAuthenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
      const unsubscribe = fetchAllData();
      unsubscribeRef.current = unsubscribe;
    } else {
      setLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const fetchAllData = () => {
    setLoading(true);

    // Fetch all stations
    const stationsRef = ref(database, 'waterStations');
    const stationsUnsubscribe = onValue(stationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const stationsArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));

        const activeStations = stationsArray.filter(station =>
          station.status !== 'rejected' && station.status !== 'deletion_pending'
        );
        const pending = activeStations.filter(station =>
          station.status === 'pending' || !station.status
        );
        const approved = activeStations.filter(station =>
          station.status === 'approved'
        );

        setPendingStations(pending);
        setApprovedStations(approved);

        setStats(prev => ({
          ...prev,
          totalStations: pending.length + approved.length,
          pendingStations: pending.length,
          approvedStations: approved.length
        }));
      } else {
        setPendingStations([]);
        setApprovedStations([]);
      }
      setLoading(false);
    });

    // Fetch all orders for statistics
    const ordersRef = ref(database, 'orders');
    const ordersUnsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersArray = Object.values(data);
        setStats(prev => ({
          ...prev,
          totalOrders: ordersArray.length
        }));
      }
    });

    // Fetch all admins
    const adminsRef = ref(database, 'admins');
    const adminsUnsubscribe = onValue(adminsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const adminsArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        setAdmins(adminsArray);
      } else {
        setAdmins([]);
      }
    });

    return () => {
      stationsUnsubscribe();
      ordersUnsubscribe();
      adminsUnsubscribe();
    };
  };


  const generatePassword = (length = 10) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleRemoveAdmin = async (adminId, adminEmail) => {
    showAlert({
      type: 'confirm',
      message: `Are you sure you want to remove ${adminEmail}? They will no longer be able to access the admin panel.`,
      onConfirm: async (confirmed) => {
        closeAlert();
        if (!confirmed) return;

        setRemovingAdminId(adminId);
        try {
          const adminRef = ref(database, `admins/${adminId}`);
          await set(adminRef, null);
          showAlert({ type: 'success', message: `${adminEmail} has been removed.` });
        } catch (error) {
          console.error('Error removing admin:', error);
          showAlert({ type: 'error', message: 'Failed to remove admin. Please try again.' });
        } finally {
          setRemovingAdminId(null);
        }
      }
    });
  };

  const handleInviteAdmin = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      showAlert({ type: 'error', message: 'Please enter a valid email address' });
      return;
    }

    setInviting(true);
    try {
      const generatedPassword = generatePassword();
      const adminsRef = ref(database, 'admins');
      const newAdminRef = push(adminsRef);
      await set(newAdminRef, {
        email: inviteEmail,
        password: generatedPassword,
        invitedBy: email,
        createdAt: new Date().toISOString()
      });

      await sendAdminInvitation(inviteEmail, generatedPassword, email);

      showAlert({ type: 'success', message: `Invitation sent to ${inviteEmail}` });
      setShowInviteDialog(false);
      setInviteEmail('');
    } catch (error) {
      console.error('Error inviting admin:', error);
      showAlert({ type: 'error', message: 'Failed to send invitation. Please check your email configuration and try again.' });
    } finally {
      setInviting(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('adminAuthenticated', 'true');
      fetchAllData();
      return;
    }

    try {
      const adminsRef = ref(database, 'admins');
      const snapshot = await get(adminsRef);
      if (snapshot.exists()) {
        const admins = snapshot.val();
        const match = Object.values(admins).find(
          (a) => a.email === email && a.password === password
        );
        if (match) {
          setIsAuthenticated(true);
          localStorage.setItem('adminAuthenticated', 'true');
          fetchAllData();
          return;
        }
      }
      showAlert({ type: 'error', message: 'Invalid email or password' });
      setPassword('');
    } catch (error) {
      console.error('Login error:', error);
      showAlert({ type: 'error', message: 'Login failed. Please try again.' });
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuthenticated');
    setEmail('');
    setPassword('');
  };

  const handleApproveStation = async (stationId) => {
    try {
      const stationToApprove = [...pendingStations, ...approvedStations].find(station => station.id === stationId);
      if (!stationToApprove) {
        showAlert({ type: 'error', message: 'Station not found!' });
        return;
      }

      const stationRef = ref(database, `waterStations/${stationId}`);
      await update(stationRef, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        revokedAt: null
      });

      try {
        await sendApprovalEmail(stationToApprove);
        showAlert({ type: 'success', message: 'Station approved successfully! Approval email sent.' });
      } catch {
        showAlert({ type: 'success', message: 'Station approved successfully! (Email notification unavailable.)' });
      }
    } catch (error) {
      console.error('Error approving station:', error);
      showAlert({ type: 'error', message: 'Error approving station. Please try again.' });
    }
  };

  const handleRejectStation = async (stationId) => {
    setRejectingStationId(stationId);

    const stationToReject = pendingStations.find(station => station.id === stationId);
    if (!stationToReject) {
      showAlert({ type: 'error', message: 'Station not found!' });
      setRejectingStationId(null);
      return;
    }

    showAlert({
      type: 'prompt',
      title: 'Reject Station',
      message: 'Please provide a detailed reason for rejection:',
      placeholder: 'Enter rejection reason...',
      onConfirm: (reason) => {
        closeAlert();

        if (!reason || reason.trim() === '') {
          showAlert({ type: 'error', message: 'Rejection reason is required.' });
          setRejectingStationId(null);
          return;
        }

        (async () => {
          try {
            await sendRejectionEmail(stationToReject, reason);

              const stationRef = ref(database, `waterStations/${stationId}`);
            await update(stationRef, {
              status: 'rejected',
              rejectionReason: reason,
              rejectedAt: new Date().toISOString(),
              rejectionEmailSent: true,
              rejectionEmailSentAt: new Date().toISOString()
            });

            const rejectionRecordRef = ref(database, `rejectionRecords/${stationId}`);
            await set(rejectionRecordRef, {
              email: stationToReject.email,
              stationName: stationToReject.stationName,
              rejectionReason: reason,
              rejectedAt: new Date().toISOString()
            });

            showAlert({
              type: 'success',
              message: `Station rejected successfully!\n\nRejection email has been sent to: ${stationToReject.email}\n\nNote: Their account will be permanently deleted when they try to login.`
            });
          } catch (error) {
            console.error('Error in rejection process:', error);

            if (error.message && error.message.includes('Email sending failed')) {
              showAlert({
                type: 'error',
                message: 'Failed to send rejection email. The station has NOT been rejected. Please check your email configuration and try again.'
              });
            } else {
              showAlert({
                type: 'error',
                message: 'Error rejecting station. Please try again.'
              });
            }
          } finally {
            setRejectingStationId(null);
          }
        })();
      }
    });
  };

  const handleRevokeApproval = async (stationId) => {
    showAlert({
      type: 'confirm',
      message: 'Are you sure you want to revoke this station\'s approval?',
      onConfirm: (confirmed) => {
        closeAlert();
        if (!confirmed) return;

        (async () => {
          try {
            const stationRef = ref(database, `waterStations/${stationId}`);
            await update(stationRef, {
              status: 'pending',
              approvedAt: null,
              revokedAt: new Date().toISOString()
            });

            showAlert({ type: 'success', message: 'Approval revoked successfully!' });
          } catch (error) {
            console.error('Error revoking approval:', error);
            showAlert({ type: 'error', message: 'Error revoking approval. Please try again.' });
          }
        })();
      }
    });
  };

  const handleViewDetails = (station) => {
    setSelectedStation(station);
    setShowDetailsModal(true);
  };

  const closeModal = () => {
    setShowDetailsModal(false);
    setSelectedStation(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getFilteredStations = () => {
    return activeTab === 'pending' ? pendingStations : approvedStations;
  };

  // Function to mask phone number
  const maskPhone = (phone) => {
    if (!phone) return 'N/A';
    if (phone.length < 7) return phone;
    const visibleDigits = 4;
    const maskedPart = '*'.repeat(phone.length - visibleDigits);
    const visiblePart = phone.slice(-visibleDigits);
    return maskedPart + visiblePart;
  };

  if (!isAuthenticated) {
    return (
      <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
        <div className="bg-white rounded-2xl p-12 w-full max-w-[450px] shadow-2xl text-center">
          <div>
            <h1 className="text-slate-800 m-0 mb-2 text-3xl">AQUA-LLERA Admin Portal</h1>
            <p className="text-slate-500 m-0 mb-8 text-sm">Developer Access Only</p>
          </div>

          <form onSubmit={handleLogin} className="text-left">
            <div className="mb-4">
              <label htmlFor="email" className="block mb-2 text-gray-700 font-medium text-sm">Admin Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@aquallera.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)]"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="block mb-2 text-gray-700 font-medium text-sm">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)]"
              />
            </div>

            <button type="submit" className="w-full py-4 bg-gradient-to-br from-primary to-primary-dark text-white border-none rounded-xl text-base font-semibold cursor-pointer transition-all mb-6 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(2,128,144,0.4)]">
              Sign in to Admin Panel
            </button>

            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mt-6 text-center">
              <p className="my-1 text-amber-800 text-xs">This page is for system administrators only.</p>
              <p className="my-1 text-amber-800 text-xs">Unauthorized access is prohibited.</p>
            </div>
          </form>

          <div>
            <button
              onClick={() => navigate('/')}
              className="bg-transparent border border-gray-300 text-gray-500 px-4 py-2 rounded-md cursor-pointer text-sm mt-6 transition-all hover:bg-gray-50 hover:border-gray-400"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
      {alertProps && <AlertCard {...alertProps} onClose={() => { if (alertProps.onClose) alertProps.onClose(); closeAlert(); }} />}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <div className="flex-1">
        {/* Admin Header */}
        <header className="bg-gradient-to-br from-primary-dark to-primary-dark text-white px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-600">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0">
            <h1 className="m-0 mb-1 text-xl sm:text-3xl">AQUA-LLERA Admin Dashboard</h1>
            <p className="m-0 text-slate-300 text-xs sm:text-sm">System Administrator Control Panel</p>
          </div>


          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => setShowInviteDialog(true)}
              className="px-4 py-2 border border-white/20 rounded-md cursor-pointer font-medium text-sm transition-all bg-white/10 text-white hover:bg-white/20">
              + Add Admin
            </button>
    
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-white/20 rounded-md cursor-pointer font-medium text-sm transition-all bg-white/10 text-white hover:bg-white/20"
              title="Refresh Data"
            >
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-md cursor-pointer font-medium text-sm transition-all hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 sm:gap-6 p-4 sm:p-8 max-w-[1400px] mx-auto">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm flex items-center gap-3 sm:gap-4 transition-transform hover:-translate-y-0.5">
          <div className="w-12 h-12 sm:w-15 sm:h-15 rounded-xl flex items-center justify-center text-lg sm:text-2xl bg-primary/10 text-primary-dark"></div>
          <div className="min-w-0">
            <h3 className="m-0 text-slate-800 text-2xl sm:text-3xl">{stats.totalStations}</h3>
            <p className="m-1 text-slate-500 text-xs sm:text-sm">Total Stations</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm flex items-center gap-3 sm:gap-4 transition-transform hover:-translate-y-0.5">
          <div className="w-12 h-12 sm:w-15 sm:h-15 rounded-xl flex items-center justify-center text-lg sm:text-2xl bg-amber-100 text-amber-600"></div>
          <div className="min-w-0">
            <h3 className="m-0 text-slate-800 text-2xl sm:text-3xl">{stats.pendingStations}</h3>
            <p className="m-1 text-slate-500 text-xs sm:text-sm">Pending Review</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm flex items-center gap-3 sm:gap-4 transition-transform hover:-translate-y-0.5">
          <div className="w-12 h-12 sm:w-15 sm:h-15 rounded-xl flex items-center justify-center text-lg sm:text-2xl bg-emerald-100 text-emerald-600"></div>
          <div className="min-w-0">
            <h3 className="m-0 text-slate-800 text-2xl sm:text-3xl">{stats.approvedStations}</h3>
            <p className="m-1 text-slate-500 text-xs sm:text-sm">Approved Stations</p>
          </div>
        </div>

      </section>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-8">
        <div className="flex gap-1 sm:gap-2 px-4 sm:px-8 max-w-[1400px] mx-auto mb-6 border-b-2 border-slate-200 overflow-x-auto">
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 border-none bg-transparent text-slate-500 text-xs sm:text-sm font-medium cursor-pointer relative transition-all rounded-t-lg whitespace-nowrap hover:bg-slate-100 hover:text-slate-700${activeTab === 'pending' ? ' text-primary bg-primary/5' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Review ({pendingStations.length})
          </button>
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 border-none bg-transparent text-slate-500 text-xs sm:text-sm font-medium cursor-pointer relative transition-all rounded-t-lg whitespace-nowrap hover:bg-slate-100 hover:text-slate-700${activeTab === 'approved' ? ' text-primary bg-primary/5' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            Approved Stations ({approvedStations.length})
          </button>
          <button
            className={`px-3 sm:px-6 py-2 sm:py-3 border-none bg-transparent text-slate-500 text-xs sm:text-sm font-medium cursor-pointer relative transition-all rounded-t-lg whitespace-nowrap hover:bg-slate-100 hover:text-slate-700${activeTab === 'admins' ? ' text-primary bg-primary/5' : ''}`}
            onClick={() => setActiveTab('admins')}
          >
            Admins ({admins.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <div className="w-[50px] h-[50px] border-3 border-slate-200 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin"></div>
            <p>Loading station data...</p>
          </div>
        ) : activeTab === 'admins' ? (
          <div className="bg-white rounded-xl shadow-sm">
            {admins.length === 0 ? (
              <div className="text-center py-16">
                <h3 className="text-slate-800 m-0 mb-2">No admins yet</h3>
                <p className="text-slate-500 m-0">Invite an admin to get started.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invited By</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Invited</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((admin) => (
                        <tr key={admin.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-slate-800">{admin.email}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{admin.invitedBy || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{admin.createdAt ? formatDate(admin.createdAt) : 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                              disabled={removingAdminId === admin.id}
                              className="px-3 py-1.5 border-none rounded-md cursor-pointer text-xs font-medium transition-all bg-red-50 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {removingAdminId === admin.id ? 'Removing...' : 'Remove'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-200">
                  {admins.map((admin) => (
                    <div key={admin.id} className="px-4 py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="font-semibold text-slate-800 text-[15px] leading-tight truncate">{admin.email}</div>
                          <div className="text-slate-400 text-xs mt-0.5">Invited by: {admin.invitedBy || 'N/A'}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                          disabled={removingAdminId === admin.id}
                          className="flex-shrink-0 px-3 py-1.5 border-none rounded-md cursor-pointer text-xs font-medium transition-all bg-red-50 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {removingAdminId === admin.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                      {admin.createdAt && (
                        <div className="text-slate-400 text-xs">Invited: {formatDate(admin.createdAt)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(min(100%,500px),1fr))]">
            {getFilteredStations().length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm">
                <div className="text-5xl mb-4 opacity-50">
                  {activeTab === 'pending' ? '' : ''}
                </div>
                <h3 className="text-slate-800 m-0 mb-2">No stations found</h3>
                <p className="text-slate-500 m-0">
                  {activeTab === 'pending'
                    ? 'All stations have been reviewed!'
                    : 'No stations have been approved yet.'}
                </p>
              </div>
            ) : (
              getFilteredStations().map(station => (
                <div key={station.id} className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border-l-4 border-l-primary">
                  <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="m-0 text-slate-800 text-xl">{station.stationName || 'Unnamed Station'}</h3>
                      <div className="flex flex-col gap-1 mt-2">
                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block max-w-fit">ID: {station.id.substring(0, 8)}...</span>
                        <span className="text-xs text-slate-400">
                          Registered: {formatDate(station.createdAt || station.timestamp)}
                        </span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[0.75rem] font-semibold uppercase tracking-wider ${station.status === 'pending' || !station.status ? 'bg-amber-50 text-amber-600' : station.status === 'approved' ? 'bg-secondary/10 text-secondary' : station.status === 'rejected' || station.status === 'deletion_pending' ? 'bg-red-100 text-red-600' : ''}`}>
                      {station.status || 'pending'}
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                        <span className="min-w-[90px] sm:min-w-[120px] text-slate-500 font-medium">Location:</span>
                      <span className="flex-1 text-slate-800 break-words">
                        {station.address || 'N/A'}, {station.city || 'N/A'}
                      </span>
                    </div>

                    <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                        <span className="min-w-[90px] sm:min-w-[120px] text-slate-500 font-medium">Owner:</span>
                      <span className="flex-1 text-slate-800 break-words">{station.ownerName || 'N/A'}</span>
                    </div>

                    <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                        <span className="min-w-[90px] sm:min-w-[120px] text-slate-500 font-medium">Email:</span>
                      <span className="flex-1 text-slate-800 break-words font-mono">{station.email || 'N/A'}</span>
                    </div>

                    {station.password && (
                      <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                        <span className="min-w-[90px] sm:min-w-[120px] text-slate-500 font-medium">Password:</span>
                        <span className="flex-1 text-slate-800 break-words font-mono">{station.password}</span>
                      </div>
                    )}

                    <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                        <span className="min-w-[90px] sm:min-w-[120px] text-slate-500 font-medium">Contact:</span>
                      <span className="flex-1 text-slate-800 break-words">{station.phone ? maskPhone(station.phone) : 'N/A'}</span>
                    </div>

                    {station.businessPermitNumber && (
                      <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                        <span className="min-w-[90px] sm:min-w-[120px] text-slate-500 font-medium">Permit #:</span>
                        <span className="flex-1 text-slate-800 break-words">{station.businessPermitNumber}</span>
                      </div>
                    )}

                    {station.rejectionReason && (
                      <div className="bg-red-50 p-3 rounded-md mt-2 border border-red-200 flex py-2 text-sm">
                        <span className="min-w-[90px] sm:min-w-[120px] text-red-600 font-medium">Rejection Reason:</span>
                        <span className="flex-1 text-slate-800 break-words">{station.rejectionReason}</span>
                      </div>
                    )}

                    {station.approvedAt && (
                      <div className="bg-secondary/5 p-3 rounded-md mt-2 border border-secondary/20 flex py-2 text-sm">
                        <span className="min-w-[90px] sm:min-w-[120px] text-secondary font-medium">Approved On:</span>
                        <span className="flex-1 text-slate-800 break-words">{formatDate(station.approvedAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {activeTab === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleApproveStation(station.id)}
                          className="px-3 sm:px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[100px] sm:min-w-[140px] bg-secondary text-white hover:bg-primary-dark"
                          disabled={rejectingStationId === station.id}
                        >
                          Approve Station
                        </button>
                        <button
                          onClick={() => handleRejectStation(station.id)}
                          className="px-3 sm:px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[100px] sm:min-w-[140px] bg-red-500 text-white hover:bg-red-600"
                          disabled={rejectingStationId === station.id}
                        >
                          {rejectingStationId === station.id ? 'Sending Email...' : 'Reject Station'}
                        </button>
                        <button
                          onClick={() => handleViewDetails(station)}
                          className="px-3 sm:px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[100px] sm:min-w-[140px] bg-primary text-white hover:bg-primary-dark"
                          disabled={rejectingStationId === station.id}
                        >
                          View Details
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRevokeApproval(station.id)}
                          className="px-3 sm:px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[100px] sm:min-w-[140px] bg-amber-500 text-white hover:bg-amber-600"
                        >
                          Revoke Approval
                        </button>
                        <button
                          onClick={() => handleViewDetails(station)}
                          className="px-3 sm:px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[100px] sm:min-w-[140px] bg-primary text-white hover:bg-primary-dark"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(station.id);
                            showAlert({ type: 'success', message: 'Station ID copied to clipboard!' });
                          }}
                          className="px-3 sm:px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[100px] sm:min-w-[140px] bg-primary text-white hover:bg-primary-dark"
                        >
                          Copy ID
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
      </div>

      {/* Station Details Modal */}
      {showDetailsModal && selectedStation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4 animate-[fadeIn_0.3s_ease]">
          <div className="bg-white rounded-2xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideUp_0.3s_ease]">
            <div className="flex justify-between items-center px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-200 bg-gradient-to-br from-primary-dark to-primary-dark text-white rounded-t-2xl">
              <h2 className="m-0 text-xl sm:text-2xl">Station Details</h2>
              <button onClick={closeModal} className="bg-transparent border-none text-white text-3xl cursor-pointer w-10 h-10 flex items-center justify-center rounded-full transition-all hover:bg-white/10">×</button>
            </div>

            <div className="p-4 sm:p-8">
              <div className="mb-8 pb-6 border-b border-gray-200 last:border-b-0">
                <h3 className="text-slate-800 m-0 mb-4 text-xl flex items-center gap-2">Station Information</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Station Name:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{selectedStation.stationName || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Owner Name:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{selectedStation.ownerName || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Email:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{selectedStation.email || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Phone:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{selectedStation.phone || 'N/A'}</span>
                  </div>
                  {selectedStation.password && (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-600 text-sm">Password:</span>
                      <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200 font-mono">{selectedStation.password}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 col-span-full">
                    <span className="font-semibold text-gray-600 text-sm">Full Address:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">
                      {selectedStation.address || 'N/A'}, {selectedStation.city || 'N/A'}, {selectedStation.state || 'N/A'} {selectedStation.zipCode || ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Coordinates:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">
                      {selectedStation.latitude ? `${selectedStation.latitude.toFixed(6)}` : 'N/A'},
                      {selectedStation.longitude ? ` ${selectedStation.longitude.toFixed(6)}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Business Documents */}
              <div className="mb-8 pb-6 border-b border-gray-200 last:border-b-0">
                <h3 className="text-slate-800 m-0 mb-4 text-xl flex items-center gap-2">Business Documents</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 mb-4">
                  {selectedStation.businessPermitUploadedAt && (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-600 text-sm">Uploaded:</span>
                      <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">
                        {formatDate(selectedStation.businessPermitUploadedAt)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Document Gallery */}
                {(() => {
                  const DOCUMENT_LABELS = {
                    businessPermit:     'Business Permit (Mayor\'s Permit)',
                    dtiSecRegistration: 'DTI / SEC Registration',
                    sanitaryPermit:     'Sanitary Permit (DOH)',
                    fdaLto:             'FDA License to Operate (LTO)',
                    otherDocument:      'Other Document'
                  };
                  const docs = selectedStation.businessPermitDocuments || {};
                  const entries = Object.entries(DOCUMENT_LABELS);
                  const hasAnyDoc = entries.some(([key]) => docs[key]);

                  if (!hasAnyDoc) {
                    return (
                      <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <p className="text-slate-400 text-sm">No documents uploaded</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {entries.map(([key, label]) => {
                        const doc = docs[key];
                        if (!doc) return null;
                        const isImage = doc.fileType && doc.fileType.startsWith('image/');
                        const customLabel = key === 'otherDocument' && doc.label ? doc.label : null;

                        return (
                          <div key={key} className="border border-slate-200 rounded-lg p-4 bg-white">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-slate-800 m-0 truncate">
                                  {customLabel || label}
                                </h4>
                                <p className="text-xs text-slate-400 m-0 mt-0.5 truncate">{doc.filename}</p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${isImage ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                {isImage ? 'Image' : 'PDF'}
                              </span>
                            </div>
                            {isImage && doc.base64 && (
                              <div className="mb-3">
                                <img
                                  src={doc.base64}
                                  alt={label}
                                  className="w-full h-32 object-cover rounded border border-slate-200"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (isImage && doc.base64) {
                                    const win = window.open();
                                    win.document.write(`<img src="${doc.base64}" style="max-width:100%;" />`);
                                  } else if (doc.base64) {
                                    const win = window.open();
                                    win.document.write(`<iframe src="${doc.base64}" style="width:100%;height:100vh;" />`);
                                  }
                                }}
                                className="flex-1 bg-primary text-white px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-all hover:bg-primary-dark"
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = doc.base64;
                                  link.download = doc.filename || `${key}.png`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="flex-1 bg-secondary text-white px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-all hover:bg-primary-dark"
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* System Information */}
              <div className="mb-8 pb-6 border-b border-gray-200 last:border-b-0">
                <h3 className="text-slate-800 m-0 mb-4 text-xl flex items-center gap-2">System Information</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Station ID:</span>
                    <span className="text-gray-800 text-sm sm:text-base break-words p-2 bg-slate-800 text-white rounded-md font-mono">{selectedStation.id}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Status:</span>
                    <span className={`text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200 inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider w-fit ${selectedStation.status === 'pending' || !selectedStation.status ? 'bg-amber-50 text-amber-600' : selectedStation.status === 'approved' ? 'bg-secondary/10 text-secondary' : selectedStation.status === 'rejected' || selectedStation.status === 'deletion_pending' ? 'bg-red-100 text-red-600' : ''}`}>
                      {selectedStation.status || 'pending'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Registered:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{formatDate(selectedStation.createdAt)}</span>
                  </div>
                  {selectedStation.approvedAt && (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-600 text-sm">Approved:</span>
                      <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{formatDate(selectedStation.approvedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-8 py-4 sm:py-6 border-t border-gray-200 flex justify-end gap-3 sm:gap-4">
              <button onClick={closeModal} className="px-6 py-3 border-none rounded-lg cursor-pointer font-semibold text-sm transition-all bg-gray-500 text-white hover:bg-gray-600">
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedStation.id);
                  showAlert({ type: 'success', message: 'Station ID copied to clipboard!' });
                }}
                className="px-6 py-3 border-none rounded-lg cursor-pointer font-semibold text-sm transition-all bg-primary text-white hover:bg-primary-dark"
              >
                Copy Station ID
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Footer */}
      <footer className="bg-primary-dark text-slate-300 px-4 sm:px-8 py-4 mt-12 border-t border-slate-700">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-4 text-xs flex-wrap">
            <span>Secure Admin Portal</span>
            <span>•</span>
            <span>Admin Only</span>
            <span>•</span>
            <span>v1.0.0</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>Session Active</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-[pulse_2s_infinite]"></div>
          </div>
        </div>
      </footer>

      {/* Invite Admin Dialog */}
      {showInviteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-[90vw] max-w-[400px]">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="m-0 text-xl text-slate-800">Invite New Admin</h2>
            </div>
            <form onSubmit={handleInviteAdmin}>
              <div className="px-6 py-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  placeholder="newadmin@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-base box-border focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                  required
                />
                <p className="text-xs text-slate-500 mt-2">A random password will be generated and sent to this email.</p>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowInviteDialog(false); setInviteEmail(''); }}
                  className="px-5 py-2 border-none rounded-lg cursor-pointer text-sm font-medium bg-gray-200 text-slate-700 hover:bg-gray-300"
                  disabled={inviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-5 py-2 border-none rounded-lg cursor-pointer text-sm font-medium bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {alertProps && <AlertCard {...alertProps} onClose={() => { if (alertProps.onClose) alertProps.onClose(); closeAlert(); }} />}
    </div>
  );
};

export default AdminPage;
