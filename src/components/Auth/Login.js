// src/components/Auth/Login.js - WITH REJECTION RULES IN POPUP
import React, { useState, useEffect } from 'react';
import './Auth.css';
import { signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { ref, get, remove } from 'firebase/database';
import { auth, database } from '../config/Firebase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectionMessage, setShowRejectionMessage] = useState(false);
  const [showRejectionRules, setShowRejectionRules] = useState(false); // NEW: Toggle rules display
  const [rejectionData, setRejectionData] = useState({
    reason: '',
    stationName: '',
    cleanupComplete: false
  });
  const navigate = useNavigate();

  // Check for remembered email on component mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setFormData(prev => ({
        ...prev,
        email: rememberedEmail,
        rememberMe: true
      }));
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: '' }));
    }
    
    if (showRejectionMessage) {
      setShowRejectionMessage(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const findStationByEmail = async (email) => {
    try {
      const stationsRef = ref(database, 'waterStations');
      const snapshot = await get(stationsRef);
      
      if (!snapshot.exists()) return null;
      
      const stations = snapshot.val();
      
      for (const [stationId, stationData] of Object.entries(stations)) {
        if (stationData.email === email) {
          return { id: stationId, ...stationData };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding station by email:', error);
      return null;
    }
  };

  const deleteAuthAccount = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await deleteUser(user);
      console.log('✅ Firebase Auth account deleted for:', email);
      
      await auth.signOut();
      
      return true;
    } catch (error) {
      console.error('Error deleting auth account:', error);
      console.warn('Could not delete auth account automatically.');
      return false;
    }
  };

  const deleteStationFromDB = async (stationId) => {
    try {
      const stationRef = ref(database, `waterStations/${stationId}`);
      await remove(stationRef);
      console.log('✅ Station deleted from database:', stationId);
      return true;
    } catch (error) {
      console.error('Error deleting station from database:', error);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});
    setShowRejectionMessage(false);
    
    try {
      console.log('🔍 Checking station status for:', formData.email);
      const stationData = await findStationByEmail(formData.email);
      
      if (stationData && stationData.status === 'deletion_pending') {
        console.log('⚠️ Station is marked for deletion:', stationData.id);
        
        setRejectionData({
          reason: stationData.rejectionReason || 'No specific reason provided.',
          stationName: stationData.stationName || 'Your station',
          cleanupComplete: false
        });
        
        setShowRejectionMessage(true);
        
        let authDeleted = false;
        try {
          authDeleted = await deleteAuthAccount(formData.email, formData.password);
        } catch (authError) {
          console.warn('Auth deletion failed:', authError);
        }
        
        const dbDeleted = await deleteStationFromDB(stationData.id);
        
        setRejectionData(prev => ({
          ...prev,
          cleanupComplete: true
        }));
        
        if (authDeleted && dbDeleted) {
          console.log('✅ Complete cleanup successful');
        } else if (dbDeleted) {
          console.log('⚠️ Database cleaned but auth may need manual cleanup');
        }
        
        setIsLoading(false);
        return;
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      const stationRef = ref(database, `waterStations/${user.uid}`);
      const stationSnapshot = await get(stationRef);
      
      if (!stationSnapshot.exists()) {
        throw new Error('Station profile not found. Please contact support.');
      }
      
      const stationDataAfterLogin = stationSnapshot.val();
      
      if (stationDataAfterLogin.status === 'pending') {
        throw new Error('Your station is still pending approval. Please wait for admin approval.');
      }
      
      if (stationDataAfterLogin.status === 'rejected') {
        const reason = stationDataAfterLogin.rejectionReason ? ` Reason: "${stationDataAfterLogin.rejectionReason}"` : '';
        throw new Error(`Your station registration was rejected.${reason} Please contact support if you believe this is an error.`);
      }
      
      if (stationDataAfterLogin.status !== 'approved') {
        throw new Error('Your station is not yet approved. Please contact support.');
      }
      
      if (formData.rememberMe) {
        localStorage.setItem('rememberedEmail', formData.email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      navigate('/dashboard');
      
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Session expired. Please login again.';
          break;
        default:
          errorMessage = error.message || 'Login failed. Please try again.';
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert('Forgot password feature coming soon! For now, please contact support at support@aquallera.com');
  };

  const handleReapply = () => {
    navigate('/signup', { 
      state: { 
        message: 'You can reapply with the same email address.',
        previousEmail: formData.email 
      } 
    });
  };

  const handleClearRejection = () => {
    setShowRejectionMessage(false);
    setShowRejectionRules(false);
    setFormData(prev => ({ ...prev, email: '', password: '' }));
  };

  return (
    <div className="auth-container">
      <div className="auth-card">

        {/* 🔙 BACK TO HOME BUTTON */}
        <button
          type="button"
          className="btn-home"
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
        <div className="auth-header">
          <h2>Station Login</h2>
          <p>Welcome back to AQUA-LLERA</p>
        </div>

        {/* Rejection Message Display */}
        {showRejectionMessage && (
          <div className="rejection-message">
            <div className="rejection-header">
              <div className="rejection-icon">
                ⚠️
              </div>
              <div className="rejection-content">
                <h3 className="rejection-title">Application Rejected</h3>
                <p className="rejection-station">
                  Your station "<strong>{rejectionData.stationName}</strong>" has been rejected.
                </p>
              </div>
            </div>
            
            <div className="rejection-reason-container">
              <p className="rejection-reason-label">Rejection Reason:</p>
              <p className="rejection-reason-text">{rejectionData.reason}</p>
            </div>
            
            {rejectionData.cleanupComplete && (
              <div className="cleanup-success">
                <span className="cleanup-success-icon">✅</span>
                <span className="cleanup-success-text">
                  Your station data has been removed from our system.
                </span>
              </div>
            )}

            {/* NEW: Toggle button for rejection rules */}
            <div className="rejection-rules-toggle">
              <button
                onClick={() => setShowRejectionRules(!showRejectionRules)}
                className="btn-toggle-rules"
              >
                {showRejectionRules ? '▼ Hide' : '▶ View'} Common Rejection Reasons & Requirements
              </button>
            </div>

            {/* NEW: Collapsible rejection rules */}
            {showRejectionRules && (
              <div className="rejection-rules-content">
                <h4>📋 Common Rejection Reasons</h4>
                
                <div className="rules-section">
                  <h5>Business Permit Issues:</h5>
                  <ul>
                    <li>❌ Expired business permit (must be current year)</li>
                    <li>❌ Permit issued to different business name</li>
                    <li>❌ Illegible or unclear permit image</li>
                    <li>❌ Permit number doesn't match document</li>
                    <li>❌ Not specifically for water refilling business</li>
                  </ul>
                </div>

                <div className="rules-section">
                  <h5>Missing Requirements:</h5>
                  <ul>
                    <li>❌ No FDA License to Operate (LTO) for water products</li>
                    <li>❌ Missing sanitation permit from local health office</li>
                    <li>❌ No proof of water quality testing</li>
                    <li>❌ Incomplete or poor quality document scans</li>
                  </ul>
                </div>

                <div className="rules-section">
                  <h5>Location Problems:</h5>
                  <ul>
                    <li>❌ Coordinates point to residential area</li>
                    <li>❌ Address doesn't match coordinates</li>
                    <li>❌ Location not properly zoned for commercial use</li>
                    <li>❌ Duplicate station at same address</li>
                  </ul>
                </div>

                <div className="rules-section">
                  <h5>Data Privacy Violations:</h5>
                  <ul>
                    <li>❌ Terms and conditions not accepted</li>
                    <li>❌ Non-compliance with Data Privacy Act (RA 10173)</li>
                    <li>❌ Inadequate data protection measures</li>
                  </ul>
                </div>

                <div className="requirements-checklist">
                  <h4>✅ Required Documents Before Reapplying:</h4>
                  <ul>
                    <li>☑ Valid Business Permit (Mayor's Permit) - Current year</li>
                    <li>☑ Sanitation Permit from Local Health Office</li>
                    <li>☑ FDA License to Operate (LTO) for water products</li>
                    <li>☑ Latest water quality testing results</li>
                    <li>☑ Clear, high-quality scans/photos of all documents</li>
                    <li>☑ Accurate business information and location</li>
                  </ul>
                </div>

                <div className="compliance-note">
                  <strong>📘 Important:</strong> All water stations must comply with:
                  <ul>
                    <li>• DOH Administrative Order 2017-0010 (Water Refilling Standards)</li>
                    <li>• Philippine National Standards (PNS) for drinking water</li>
                    <li>• Data Privacy Act of 2012 (Republic Act 10173)</li>
                    <li>• Local government health and sanitation codes</li>
                  </ul>
                </div>
              </div>
            )}
            
            <div className="rejection-actions">
              <button
                onClick={handleReapply}
                className="rejection-btn reapply"
              >
                ↻ Reapply Now
              </button>
              <button
                onClick={handleClearRejection}
                className="rejection-btn clear"
              >
                ✕ Clear & Try Again
              </button>
            </div>
            
            <p className="rejection-support">
              Need help? <a href="mailto:support@aquallera.com">Contact Support</a>
            </p>
          </div>
        )}

        {errors.general && (
          <div className="error-message">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email Address *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your@email.com"
              className={errors.email ? 'error' : ''}
              disabled={isLoading}
              autoComplete="email"
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              className={errors.password ? 'error' : ''}
              disabled={isLoading}
              autoComplete="current-password"
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <span>Remember me</span>
            </label>
            
            <button 
              type="button" 
              onClick={handleForgotPassword}
              className="forgot-password"
              disabled={isLoading}
            >
              Forgot Password?
            </button>
          </div>

          <button 
            type="submit" 
            className={`login-btn ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign in to Dashboard'
            )}
          </button>
        </form>

        <div className="features-preview">
          <h4>What you can do after login:</h4>
          <ul>
            <li>✓ View real-time business analytics</li>
            <li>✓ Manage delivery orders</li>
            <li>✓ Update pricing and services</li>
            <li>✓ Set business hours</li>
            <li>✓ Manage service areas</li>
          </ul>
          
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0f9ff', borderRadius: '6px', borderLeft: '4px solid #0ea5e9' }}>
            <small style={{ color: '#0369a1', display: 'block', marginBottom: '0.25rem' }}>
              <strong>Note:</strong> New stations require admin approval before full access.
            </small>
            <small style={{ color: '#64748b' }}>
              Check your email for approval notifications or contact support if waiting more than 48 hours.
            </small>
          </div>
        </div>

        <div className="auth-footer">
          <p>Don't have an account? <a href="/signup" className="signup-link">Register your station</a></p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
            Need help? <a href="mailto:support@aquallera.com">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;