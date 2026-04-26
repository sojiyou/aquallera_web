// src/components/Admin/AdminPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminPage.css';
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
      <div className="admin-login-container">
        <div className="admin-login-box">
          <div className="admin-header">
            <h1>🔐 AQUA-LLERA Admin Portal</h1>
            <p>Developer Access Only</p>
          </div>
          
          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="form-group">
              <label htmlFor="accessCode">Enter Admin Access Code</label>
              <input
                type="password"
                id="accessCode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter secret code..."
                required
                autoComplete="off"
              />
              <small className="hint">Access restricted to developers only</small>
            </div>
            
            <button type="submit" className="admin-login-btn">
              Access Admin Panel
            </button>
            
            <div className="admin-note">
              <p>⚠️ This page is for system administrators only.</p>
              <p>Unauthorized access is prohibited.</p>
            </div>
          </form>
          
          <div className="admin-footer">
            <button 
              onClick={() => navigate('/')}
              className="back-to-home"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Admin Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-title">
            <h1>🚀 AQUA-LLERA Admin Dashboard</h1>
            <p>System Administrator Control Panel</p>
          </div>
          
          
          <div className="admin-actions">
            <button 
              onClick={() => window.location.reload()}
              className="refresh-btn"
              title="Refresh Data"
            >
              🔄 Refresh
            </button>
            
            <button 
              onClick={handleLogout}
              className="logout-btn"
            >
              👋 Logout
            </button>
          </div>
          </div>
      </header>

      {/* Stats Overview */}
      <section className="admin-stats">
        <div className="stat-card">
          <div className="stat-icon total">🏢</div>
          <div className="stat-info">
            <h3>{stats.totalStations}</h3>
            <p>Total Stations</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon pending">⏳</div>
          <div className="stat-info">
            <h3>{stats.pendingStations}</h3>
            <p>Pending Review</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon approved">✅</div>
          <div className="stat-info">
            <h3>{stats.approvedStations}</h3>
            <p>Approved Stations</p>
          </div>
        </div>
        
      </section>

      {/* Main Content */}
      <main className="admin-main">
        <div className="admin-tabs">
          <button 
            className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            ⏳ Pending Review ({pendingStations.length})
          </button>
          <button 
            className={`admin-tab ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            ✅ Approved Stations ({approvedStations.length})
          </button>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading station data...</p>
          </div>
        ) : (
          <div className="stations-grid">
            {getFilteredStations().length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  {activeTab === 'pending' ? '📋' : '🏪'}
                </div>
                <h3>No stations found</h3>
                <p>
                  {activeTab === 'pending' 
                    ? 'All stations have been reviewed!' 
                    : 'No stations have been approved yet.'}
                </p>
              </div>
            ) : (
              getFilteredStations().map(station => (
                <div key={station.id} className="station-card">
                  <div className="station-header">
                    <div className="station-info">
                      <h3>{station.stationName || 'Unnamed Station'}</h3>
                      <div className="station-meta">
                        <span className="station-id">ID: {station.id.substring(0, 8)}...</span>
                        <span className="station-date">
                          Registered: {formatDate(station.createdAt || station.timestamp)}
                        </span>
                      </div>
                    </div>
                    <div className={`station-status ${station.status || 'pending'}`}>
                      {station.status || 'pending'}
                    </div>
                  </div>

                  <div className="station-details">
                    <div className="detail-row">
                      <span className="detail-label">📍 Location:</span>
                      <span className="detail-value">
                        {station.address || 'N/A'}, {station.city || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">👤 Owner:</span>
                      <span className="detail-value">
                        {station.ownerName || 'N/A'} ({station.email ? maskEmail(station.email) : 'No email'})
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">📱 Contact:</span>
                      <span className="detail-value">{station.phone ? maskPhone(station.phone) : 'N/A'}</span>
                    </div>
                    
                    {station.businessPermitNumber && (
                      <div className="detail-row">
                        <span className="detail-label">📄 Permit #:</span>
                        <span className="detail-value">{station.businessPermitNumber}</span>
                      </div>
                    )}
                    
                    {station.rejectionReason && (
                      <div className="detail-row rejection">
                        <span className="detail-label">❌ Rejection Reason:</span>
                        <span className="detail-value">{station.rejectionReason}</span>
                      </div>
                    )}
                    
                    {station.approvedAt && (
                      <div className="detail-row approved">
                        <span className="detail-label">✅ Approved On:</span>
                        <span className="detail-value">{formatDate(station.approvedAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="station-actions">
                    {activeTab === 'pending' ? (
                      <>
                        <button 
                          onClick={() => handleApproveStation(station.id)}
                          className="action-btn approve"
                          disabled={rejectingStationId === station.id}
                        >
                          ✅ Approve Station
                        </button>
                        <button 
                          onClick={() => handleRejectStation(station.id)}
                          className="action-btn reject"
                          disabled={rejectingStationId === station.id}
                        >
                          {rejectingStationId === station.id ? '⏳ Sending Email...' : '❌ Reject Station'}
                        </button>
                        <button 
                          onClick={() => handleViewDetails(station)}
                          className="action-btn view"
                          disabled={rejectingStationId === station.id}
                        >
                          👁️ View Details
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleRevokeApproval(station.id)}
                          className="action-btn revoke"
                        >
                          ↩️ Revoke Approval
                        </button>
                        <button 
                          onClick={() => handleViewDetails(station)}
                          className="action-btn view"
                        >
                          👁️ View Details
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(station.id);
                            alert('Station ID copied to clipboard!');
                          }}
                          className="action-btn copy"
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
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>📋 Station Details</h2>
              <button onClick={closeModal} className="modal-close-btn">×</button>
            </div>
            
            <div className="modal-content">
              <div className="station-details-section">
                <h3>🏢 Station Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Station Name:</span>
                    <span className="detail-value">{selectedStation.stationName || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Owner Name:</span>
                    <span className="detail-value">{selectedStation.ownerName || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{selectedStation.email || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">{selectedStation.phone || 'N/A'}</span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Full Address:</span>
                    <span className="detail-value">
                      {selectedStation.address || 'N/A'}, {selectedStation.city || 'N/A'}, {selectedStation.state || 'N/A'} {selectedStation.zipCode || ''}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Coordinates:</span>
                    <span className="detail-value">
                      {selectedStation.latitude ? `${selectedStation.latitude.toFixed(6)}` : 'N/A'}, 
                      {selectedStation.longitude ? ` ${selectedStation.longitude.toFixed(6)}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="station-details-section">
                <h3>📄 Business Permit Details</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Permit Number:</span>
                    <span className="detail-value">{selectedStation.businessPermitNumber || 'N/A'}</span>
                  </div>
                  {selectedStation.businessPermitFilename && (
                    <div className="detail-item">
                      <span className="detail-label">File Name:</span>
                      <span className="detail-value">{selectedStation.businessPermitFilename}</span>
                    </div>
                  )}
                  {selectedStation.businessPermitFileType && (
                    <div className="detail-item">
                      <span className="detail-label">File Type:</span>
                      <span className="detail-value">{selectedStation.businessPermitFileType}</span>
                    </div>
                  )}
                  {selectedStation.businessPermitFileSize && (
                    <div className="detail-item">
                      <span className="detail-label">File Size:</span>
                      <span className="detail-value">
                        {Math.round(selectedStation.businessPermitFileSize / 1024)} KB
                      </span>
                    </div>
                  )}
                  {selectedStation.businessPermitUploadedAt && (
                    <div className="detail-item">
                      <span className="detail-label">Uploaded:</span>
                      <span className="detail-value">
                        {formatDate(selectedStation.businessPermitUploadedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Permit Image */}
              {selectedStation.businessPermitBase64 && (
                <div className="permit-image-section">
                  <h3>📸 Business Permit Image</h3>
                  <div className="image-container">
                    <img 
                      src={selectedStation.businessPermitBase64} 
                      alt="Business Permit" 
                      className="permit-image"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNGNUY1RjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2Ij5CdXNpbmVzcyBQZXJtaXQgSW1hZ2UgKEVycm9yIGxvYWRpbmcpPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  </div>
                  <div className="image-actions">
                    <button 
                      onClick={() => {
                        const win = window.open();
                        win.document.write(`<img src="${selectedStation.businessPermitBase64}" style="max-width:100%;" />`);
                      }}
                      className="action-btn view-full"
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
                      className="action-btn download"
                    >
                      ⬇️ Download Image
                    </button>
                  </div>
                </div>
              )}

              {/* System Information */}
              <div className="station-details-section">
                <h3>⚙️ System Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Station ID:</span>
                    <span className="detail-value station-id">{selectedStation.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value status-badge ${selectedStation.status || 'pending'}`}>
                      {selectedStation.status || 'pending'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Registered:</span>
                    <span className="detail-value">{formatDate(selectedStation.createdAt)}</span>
                  </div>
                  {selectedStation.approvedAt && (
                    <div className="detail-item">
                      <span className="detail-label">Approved:</span>
                      <span className="detail-value">{formatDate(selectedStation.approvedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button onClick={closeModal} className="modal-btn close">
                Close
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(selectedStation.id);
                  alert('Station ID copied to clipboard!');
                }}
                className="modal-btn copy"
              >
                📋 Copy Station ID
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Footer */}
      <footer className="admin-footer">
        <div className="admin-footer-content">
          <div className="system-info">
            <span>🛡️ Secure Admin Portal</span>
            <span>•</span>
            <span>👥 Developers Only</span>
            <span>•</span>
            <span>🚀 v1.0.0</span>
          </div>
          <div className="session-info">
            <span>Session Active</span>
            <div className="session-indicator active"></div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminPage;