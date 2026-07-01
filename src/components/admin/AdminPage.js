// src/components/Admin/AdminPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../config/Firebase';
import { sendRejectionEmail, testEmailJSConnection } from '../services/EmailService'; // Add this import

const AdminPage = () => {
  const [accessCode, setAccessCode] = useState('');
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

  // Secret admin code (you should change this and keep it secure)
  const ADMIN_SECRET_CODE = 'AQUA-LLERA-ADMIN-CODE';

  useEffect(() => {
    // Check if already authenticated from localStorage
    const storedAuth = localStorage.getItem('adminAuthenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
      fetchAllData();
    } else {
      setLoading(false);
    }
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

        const pending = stationsArray.filter(station =>
          station.status === 'pending' || !station.status
        );
        const approved = stationsArray.filter(station =>
          station.status === 'approved'
        );

        setPendingStations(pending);
        setApprovedStations(approved);

        setStats(prev => ({
          ...prev,
          totalStations: stationsArray.length,
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

    return () => {
      stationsUnsubscribe();
      ordersUnsubscribe();
    };
  };

  const handleLogin = (e) => {
    e.preventDefault();

    if (accessCode === ADMIN_SECRET_CODE) {
      setIsAuthenticated(true);
      localStorage.setItem('adminAuthenticated', 'true');
      fetchAllData();
    } else {
      alert('Invalid access code!');
      setAccessCode('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuthenticated');
    setAccessCode('');
  };

  const handleApproveStation = async (stationId) => {
    try {
      const stationRef = ref(database, `waterStations/${stationId}`);
      await update(stationRef, {
        status: 'approved',
        approvedAt: new Date().toISOString()
      });

      // Update local state
      setPendingStations(prev => prev.filter(station => station.id !== stationId));
      const approvedStation = pendingStations.find(station => station.id === stationId);
      if (approvedStation) {
        setApprovedStations(prev => [...prev, { ...approvedStation, status: 'approved' }]);
      }

      alert('Station approved successfully!');
    } catch (error) {
      console.error('Error approving station:', error);
      alert('Error approving station. Please try again.');
    }
  };

  const handleRejectStation = async (stationId) => {
    // Set the rejecting station ID to disable the button during processing
    setRejectingStationId(stationId);

    // Find the station data
    const stationToReject = pendingStations.find(station => station.id === stationId);
    if (!stationToReject) {
      alert('Station not found!');
      setRejectingStationId(null);
      return;
    }

    // Get rejection reason from admin
    const reason = prompt('Please provide a detailed reason for rejection:');
    if (reason === null || reason.trim() === '') {
      // User cancelled or entered empty reason
      setRejectingStationId(null);
      return;
    }

    try {
      console.log('Attempting to send rejection email to:', stationToReject.email);

      // Step 1: Send rejection email
      await sendRejectionEmail(stationToReject, reason);
      console.log('Rejection email sent successfully');

      // Step 2: Update station status to 'deletion_pending'
      const stationRef = ref(database, `waterStations/${stationId}`);
      await update(stationRef, {
        status: 'deletion_pending',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        rejectionEmailSent: true,
        rejectionEmailSentAt: new Date().toISOString()
      });

      // Step 3: Update local state
      setPendingStations(prev => prev.filter(station => station.id !== stationId));

      // Show success message
      alert(`✅ Station rejected successfully!\n\nRejection email has been sent to: ${stationToReject.email}\n\nNote: Their account will be permanently deleted when they try to login.`);

    } catch (error) {
      console.error('Error in rejection process:', error);

      // Check if it's an email error or database error
      if (error.message && error.message.includes('Email sending failed')) {
        alert(`❌ Failed to send rejection email!\n\nError: ${error.message}\n\nThe station has NOT been rejected. Please try again or check your EmailJS configuration.`);
      } else {
        alert(`❌ Error rejecting station!\n\nError: ${error.message}\n\nPlease try again.`);
      }
    } finally {
      // Reset rejecting state
      setRejectingStationId(null);
    }
  };

  const handleRevokeApproval = async (stationId) => {
    if (!window.confirm('Are you sure you want to revoke this station\'s approval?')) return;

    try {
      const stationRef = ref(database, `waterStations/${stationId}`);
      await update(stationRef, {
        status: 'pending',
        revokedAt: new Date().toISOString()
      });

      const revokedStation = approvedStations.find(station => station.id === stationId);
      if (revokedStation) {
        setApprovedStations(prev => prev.filter(station => station.id !== stationId));
        setPendingStations(prev => [...prev, { ...revokedStation, status: 'pending' }]);
      }

      alert('Approval revoked successfully!');
    } catch (error) {
      console.error('Error revoking approval:', error);
      alert('Error revoking approval. Please try again.');
    }
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
      minute: '2-digit'
    });
  };

  const getFilteredStations = () => {
    return activeTab === 'pending' ? pendingStations : approvedStations;
  };

  // Function to mask email for display (shows first 3 chars and domain)
  const maskEmail = (email) => {
    if (!email) return 'N/A';
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 3
      ? username.substring(0, 3) + '*'.repeat(username.length - 3)
      : username;
    return `${maskedUsername}@${domain}`;
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4">
        <div className="bg-white rounded-2xl p-12 w-full max-w-[450px] shadow-2xl text-center">
          <div>
            <h1 className="text-slate-800 m-0 mb-2 text-3xl">🔐 AQUA-LLERA Admin Portal</h1>
            <p className="text-slate-500 m-0 mb-8 text-sm">Developer Access Only</p>
          </div>

          <form onSubmit={handleLogin} className="text-left">
            <div className="mb-6">
              <label htmlFor="accessCode" className="block mb-2 text-gray-700 font-medium text-sm">Enter Admin Access Code</label>
              <input
                type="password"
                id="accessCode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter secret code..."
                required
                autoComplete="off"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base transition-all font-mono tracking-wider focus:outline-none focus:border-[#667eea] focus:shadow-[0_0_0_3px_rgba(102,126,234,0.1)]"
              />
              <small className="block mt-2 text-gray-400 text-xs italic">Access restricted to developers only</small>
            </div>

            <button type="submit" className="w-full py-4 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white border-none rounded-xl text-base font-semibold cursor-pointer transition-all mb-6 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(102,126,234,0.4)]">
              Access Admin Panel
            </button>

            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mt-6 text-center">
              <p className="my-1 text-amber-800 text-xs">⚠️ This page is for system administrators only.</p>
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
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Admin Header */}
      <header className="bg-gradient-to-br from-slate-800 to-slate-700 text-white px-8 py-6 border-b border-slate-600">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div>
            <h1 className="m-0 mb-1 text-3xl">🚀 AQUA-LLERA Admin Dashboard</h1>
            <p className="m-0 text-slate-300 text-sm">System Administrator Control Panel</p>
          </div>


          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-white/20 rounded-md cursor-pointer font-medium text-sm transition-all bg-white/10 text-white hover:bg-white/20"
              title="Refresh Data"
            >
              🔄 Refresh
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-md cursor-pointer font-medium text-sm transition-all hover:bg-red-600"
            >
              👋 Logout
            </button>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6 p-8 max-w-[1400px] mx-auto">
        <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-0.5">
          <div className="w-15 h-15 rounded-xl flex items-center justify-center text-2xl bg-blue-100 text-blue-700">🏢</div>
          <div>
            <h3 className="m-0 text-slate-800 text-3xl">{stats.totalStations}</h3>
            <p className="m-1 text-slate-500 text-sm">Total Stations</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-0.5">
          <div className="w-15 h-15 rounded-xl flex items-center justify-center text-2xl bg-amber-100 text-amber-600">⏳</div>
          <div>
            <h3 className="m-0 text-slate-800 text-3xl">{stats.pendingStations}</h3>
            <p className="m-1 text-slate-500 text-sm">Pending Review</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-0.5">
          <div className="w-15 h-15 rounded-xl flex items-center justify-center text-2xl bg-emerald-100 text-emerald-600">✅</div>
          <div>
            <h3 className="m-0 text-slate-800 text-3xl">{stats.approvedStations}</h3>
            <p className="m-1 text-slate-500 text-sm">Approved Stations</p>
          </div>
        </div>

      </section>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-8 pb-8">
        <div className="flex gap-2 px-8 max-w-[1400px] mx-auto mb-6 border-b-2 border-slate-200">
          <button
            className={`px-6 py-3 border-none bg-transparent text-slate-500 text-sm font-medium cursor-pointer relative transition-all rounded-t-lg hover:bg-slate-100 hover:text-slate-700${activeTab === 'pending' ? ' text-blue-600 bg-blue-50' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            ⏳ Pending Review ({pendingStations.length})
          </button>
          <button
            className={`px-6 py-3 border-none bg-transparent text-slate-500 text-sm font-medium cursor-pointer relative transition-all rounded-t-lg hover:bg-slate-100 hover:text-slate-700${activeTab === 'approved' ? ' text-blue-600 bg-blue-50' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            ✅ Approved Stations ({approvedStations.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <div className="w-[50px] h-[50px] border-3 border-slate-200 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin"></div>
            <p>Loading station data...</p>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(500px,1fr))]">
            {getFilteredStations().length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm">
                <div className="text-5xl mb-4 opacity-50">
                  {activeTab === 'pending' ? '📋' : '🏪'}
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
                <div key={station.id} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-l-blue-600">
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
                    <div className={`px-3 py-1 rounded-full text-[0.75rem] font-semibold uppercase tracking-wider ${station.status === 'pending' || !station.status ? 'bg-amber-50 text-amber-600' : station.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : station.status === 'rejected' ? 'bg-red-100 text-red-600' : ''}`}>
                      {station.status || 'pending'}
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                      <span className="min-w-[120px] text-slate-500 font-medium">📍 Location:</span>
                      <span className="flex-1 text-slate-800 break-words">
                        {station.address || 'N/A'}, {station.city || 'N/A'}
                      </span>
                    </div>

                    <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                      <span className="min-w-[120px] text-slate-500 font-medium">👤 Owner:</span>
                      <span className="flex-1 text-slate-800 break-words">
                        {station.ownerName || 'N/A'} ({station.email ? maskEmail(station.email) : 'No email'})
                      </span>
                    </div>

                    <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                      <span className="min-w-[120px] text-slate-500 font-medium">📱 Contact:</span>
                      <span className="flex-1 text-slate-800 break-words">{station.phone ? maskPhone(station.phone) : 'N/A'}</span>
                    </div>

                    {station.businessPermitNumber && (
                      <div className="flex py-2 text-sm border-b border-slate-100 last:border-b-0">
                        <span className="min-w-[120px] text-slate-500 font-medium">📄 Permit #:</span>
                        <span className="flex-1 text-slate-800 break-words">{station.businessPermitNumber}</span>
                      </div>
                    )}

                    {station.rejectionReason && (
                      <div className="bg-red-50 p-3 rounded-md mt-2 border border-red-200 flex py-2 text-sm">
                        <span className="min-w-[120px] text-red-600 font-medium">❌ Rejection Reason:</span>
                        <span className="flex-1 text-slate-800 break-words">{station.rejectionReason}</span>
                      </div>
                    )}

                    {station.approvedAt && (
                      <div className="bg-emerald-50 p-3 rounded-md mt-2 border border-emerald-200 flex py-2 text-sm">
                        <span className="min-w-[120px] text-emerald-600 font-medium">✅ Approved On:</span>
                        <span className="flex-1 text-slate-800 break-words">{formatDate(station.approvedAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {activeTab === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleApproveStation(station.id)}
                          className="px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[140px] bg-emerald-500 text-white hover:bg-emerald-600"
                          disabled={rejectingStationId === station.id}
                        >
                          ✅ Approve Station
                        </button>
                        <button
                          onClick={() => handleRejectStation(station.id)}
                          className="px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[140px] bg-red-500 text-white hover:bg-red-600"
                          disabled={rejectingStationId === station.id}
                        >
                          {rejectingStationId === station.id ? '⏳ Sending Email...' : '❌ Reject Station'}
                        </button>
                        <button
                          onClick={() => handleViewDetails(station)}
                          className="px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[140px] bg-blue-500 text-white hover:bg-blue-600"
                          disabled={rejectingStationId === station.id}
                        >
                          👁️ View Details
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRevokeApproval(station.id)}
                          className="px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[140px] bg-amber-500 text-white hover:bg-amber-600"
                        >
                          ↩️ Revoke Approval
                        </button>
                        <button
                          onClick={() => handleViewDetails(station)}
                          className="px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[140px] bg-blue-500 text-white hover:bg-blue-600"
                        >
                          👁️ View Details
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(station.id);
                            alert('Station ID copied to clipboard!');
                          }}
                          className="px-4 py-2 border-none rounded-md cursor-pointer text-xs font-medium transition-all flex-1 min-w-[140px] bg-violet-500 text-white hover:bg-violet-600"
                        >
                          📋 Copy ID
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

      {/* Station Details Modal */}
      {showDetailsModal && selectedStation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4 animate-[fadeIn_0.3s_ease]">
          <div className="bg-white rounded-2xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideUp_0.3s_ease]">
            <div className="flex justify-between items-center px-8 py-6 border-b border-gray-200 bg-gradient-to-br from-slate-800 to-slate-700 text-white rounded-t-2xl">
              <h2 className="m-0 text-2xl">📋 Station Details</h2>
              <button onClick={closeModal} className="bg-transparent border-none text-white text-3xl cursor-pointer w-10 h-10 flex items-center justify-center rounded-full transition-all hover:bg-white/10">×</button>
            </div>

            <div className="p-8">
              <div className="mb-8 pb-6 border-b border-gray-200 last:border-b-0">
                <h3 className="text-slate-800 m-0 mb-4 text-xl flex items-center gap-2">🏢 Station Information</h3>
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

              <div className="mb-8 pb-6 border-b border-gray-200 last:border-b-0">
                <h3 className="text-slate-800 m-0 mb-4 text-xl flex items-center gap-2">📄 Business Permit Details</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Permit Number:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{selectedStation.businessPermitNumber || 'N/A'}</span>
                  </div>
                  {selectedStation.businessPermitFilename && (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-600 text-sm">File Name:</span>
                      <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{selectedStation.businessPermitFilename}</span>
                    </div>
                  )}
                  {selectedStation.businessPermitFileType && (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-600 text-sm">File Type:</span>
                      <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">{selectedStation.businessPermitFileType}</span>
                    </div>
                  )}
                  {selectedStation.businessPermitFileSize && (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-600 text-sm">File Size:</span>
                      <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">
                        {Math.round(selectedStation.businessPermitFileSize / 1024)} KB
                      </span>
                    </div>
                  )}
                  {selectedStation.businessPermitUploadedAt && (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-600 text-sm">Uploaded:</span>
                      <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200">
                        {formatDate(selectedStation.businessPermitUploadedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Permit Image */}
              {selectedStation.businessPermitBase64 && (
                <div className="bg-slate-50 rounded-xl p-6 my-6 border-2 border-dashed border-gray-300">
                  <h3 className="mt-0 text-gray-700">📸 Business Permit Image</h3>
                  <div className="flex justify-center my-4">
                    <img
                      src={selectedStation.businessPermitBase64}
                      alt="Business Permit"
                      className="max-w-full max-h-[300px] border border-gray-200 rounded-lg shadow-md object-contain bg-white"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNGNUY1RjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2Ij5CdXNpbmVzcyBQZXJtaXQgSW1hZ2UgKEVycm9yIGxvYWRpbmcpPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  </div>
                  <div className="flex gap-2 justify-center mt-4">
                    <button
                      onClick={() => {
                        const win = window.open();
                        win.document.write(`<img src="${selectedStation.businessPermitBase64}" style="max-width:100%;" />`);
                      }}
                      className="bg-blue-500 text-white px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-all hover:bg-blue-600"
                    >
                      🔍 View Full Image
                    </button>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = selectedStation.businessPermitBase64;
                        link.download = selectedStation.businessPermitFilename || 'business-permit.png';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="bg-emerald-500 text-white px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-all hover:bg-emerald-600"
                    >
                      ⬇️ Download Image
                    </button>
                  </div>
                </div>
              )}

              {/* System Information */}
              <div className="mb-8 pb-6 border-b border-gray-200 last:border-b-0">
                <h3 className="text-slate-800 m-0 mb-4 text-xl flex items-center gap-2">⚙️ System Information</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Station ID:</span>
                    <span className="text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200 font-mono text-sm bg-slate-800 text-white p-2 rounded">{selectedStation.id}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-600 text-sm">Status:</span>
                    <span className={`text-gray-800 text-base break-words p-2 bg-gray-50 rounded-md border border-gray-200 inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider w-fit ${selectedStation.status === 'pending' || !selectedStation.status ? 'bg-amber-50 text-amber-600' : selectedStation.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : selectedStation.status === 'rejected' ? 'bg-red-100 text-red-600' : ''}`}>
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

            <div className="px-8 py-6 border-t border-gray-200 flex justify-end gap-4">
              <button onClick={closeModal} className="px-6 py-3 border-none rounded-lg cursor-pointer font-semibold text-sm transition-all bg-gray-500 text-white hover:bg-gray-600">
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedStation.id);
                  alert('Station ID copied to clipboard!');
                }}
                className="px-6 py-3 border-none rounded-lg cursor-pointer font-semibold text-sm transition-all bg-violet-500 text-white hover:bg-violet-600"
              >
                📋 Copy Station ID
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Footer */}
      <footer className="bg-slate-800 text-slate-300 px-8 py-4 mt-12 border-t border-slate-700">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4 text-xs">
            <span>🛡️ Secure Admin Portal</span>
            <span>•</span>
            <span>👥 Admin Only</span>
            <span>•</span>
            <span>🚀 v1.0.0</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>Session Active</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-[pulse_2s_infinite]"></div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminPage;