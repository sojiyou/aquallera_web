// src/components/Auth/Login.js - WITH REJECTION RULES IN POPUP
import React, { useState, useEffect } from 'react';

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
      console.log('Error code:', error.code, 'Error name:', error.constructor?.name);

      let errorMessage = 'Login failed. Please try again.';
      const errorCode = error.code || '';
      const errorMsg = error.message || '';

      if (errorCode.includes('auth/user-not-found') ||
          errorCode.includes('auth/wrong-password') ||
          errorCode.includes('auth/invalid-credential') ||
          errorMsg.includes('auth/invalid-credential') ||
          errorMsg.includes('INVALID_LOGIN_CREDENTIALS')) {
        errorMessage = 'Invalid email or password';
      } else if (errorCode.includes('auth/too-many-requests')) {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (errorCode.includes('auth/user-disabled')) {
        errorMessage = 'This account has been disabled. Please contact support.';
      } else if (errorCode.includes('auth/invalid-email') ||
                 errorMsg.includes('auth/invalid-email')) {
        errorMessage = 'Invalid email address format';
      } else if (errorCode.includes('auth/network-request-failed')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (errorCode.includes('auth/requires-recent-login')) {
        errorMessage = 'Session expired. Please login again.';
      } else {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] p-8 font-sans">
      <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] p-10 w-full max-w-md">

        {/* 🔙 BACK TO HOME BUTTON */}
        <button
          type="button"
          className="bg-transparent border-none text-sky-500 text-sm cursor-pointer mb-3 text-left hover:underline"
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
        <div className="text-center mb-8">
          <h2 className="text-slate-800 text-3xl mb-2">Station Login</h2>
          <p className="text-slate-500 text-sm m-0">Welcome back to AQUA-LLERA</p>
        </div>

        {/* Rejection Message Display */}
        {showRejectionMessage && (
          <div className="bg-red-100 border-2 border-red-600 rounded-xl p-6 mb-6 animate-[fadeIn_0.3s_ease-in]">
            <div className="flex items-start mb-4">
              <div className="bg-red-600 text-white w-9 h-9 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                ⚠️
              </div>
              <div className="flex-1">
                <h3 className="text-red-900 m-0 mb-2 text-lg font-semibold">Application Rejected</h3>
                <p className="text-red-800 m-0 mb-2 font-medium">
                  Your station "<strong>{rejectionData.stationName}</strong>" has been rejected.
                </p>
              </div>
            </div>

            <div className="bg-[rgba(220,38,38,0.05)] border-l-4 border-l-red-600 p-3 mb-4 rounded-r">
              <p className="m-0 mb-1 text-red-900 font-semibold">Rejection Reason:</p>
              <p className="m-0 text-red-800 leading-relaxed">{rejectionData.reason}</p>
            </div>

            {rejectionData.cleanupComplete && (
              <div className="bg-emerald-100 border border-emerald-500 rounded-md p-3 mb-4 flex items-center gap-2">
                <span className="text-emerald-700">✅</span>
                <span className="text-emerald-800 text-sm">
                  Your station data has been removed from our system.
                </span>
              </div>
            )}

            {/* NEW: Toggle button for rejection rules */}
            <div className="mt-3 mb-2">
              <button
                onClick={() => setShowRejectionRules(!showRejectionRules)}
                className="bg-slate-100 border border-slate-300 rounded-md px-4 py-2 text-sm text-slate-700 cursor-pointer w-full text-left hover:bg-slate-200 transition-colors"
              >
                {showRejectionRules ? '▼ Hide' : '▶ View'} Common Rejection Reasons & Requirements
              </button>
            </div>

            {/* NEW: Collapsible rejection rules */}
            {showRejectionRules && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
                <h4 className="text-slate-800 text-base font-semibold mb-3">📋 Common Rejection Reasons</h4>

                <div className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-100">
                  <h5 className="text-red-700 text-sm font-bold mb-2">Business Permit Issues:</h5>
                  <ul className="list-none p-0 m-0">
                    <li className="text-slate-600 text-sm py-1">❌ Expired business permit (must be current year)</li>
                    <li className="text-slate-600 text-sm py-1">❌ Permit issued to different business name</li>
                    <li className="text-slate-600 text-sm py-1">❌ Illegible or unclear permit image</li>
                    <li className="text-slate-600 text-sm py-1">❌ Permit number doesn't match document</li>
                    <li className="text-slate-600 text-sm py-1">❌ Not specifically for water refilling business</li>
                  </ul>
                </div>

                <div className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-100">
                  <h5 className="text-red-700 text-sm font-bold mb-2">Missing Requirements:</h5>
                  <ul className="list-none p-0 m-0">
                    <li className="text-slate-600 text-sm py-1">❌ No FDA License to Operate (LTO) for water products</li>
                    <li className="text-slate-600 text-sm py-1">❌ Missing sanitation permit from local health office</li>
                    <li className="text-slate-600 text-sm py-1">❌ No proof of water quality testing</li>
                    <li className="text-slate-600 text-sm py-1">❌ Incomplete or poor quality document scans</li>
                  </ul>
                </div>

                <div className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-100">
                  <h5 className="text-red-700 text-sm font-bold mb-2">Location Problems:</h5>
                  <ul className="list-none p-0 m-0">
                    <li className="text-slate-600 text-sm py-1">❌ Coordinates point to residential area</li>
                    <li className="text-slate-600 text-sm py-1">❌ Address doesn't match coordinates</li>
                    <li className="text-slate-600 text-sm py-1">❌ Location not properly zoned for commercial use</li>
                    <li className="text-slate-600 text-sm py-1">❌ Duplicate station at same address</li>
                  </ul>
                </div>

                <div className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-100">
                  <h5 className="text-red-700 text-sm font-bold mb-2">Data Privacy Violations:</h5>
                  <ul className="list-none p-0 m-0">
                    <li className="text-slate-600 text-sm py-1">❌ Terms and conditions not accepted</li>
                    <li className="text-slate-600 text-sm py-1">❌ Non-compliance with Data Privacy Act (RA 10173)</li>
                    <li className="text-slate-600 text-sm py-1">❌ Inadequate data protection measures</li>
                  </ul>
                </div>

                <div className="mb-4 p-3 bg-emerald-50 rounded-md border border-emerald-200">
                  <h4 className="text-emerald-800 text-sm font-bold mb-2">✅ Required Documents Before Reapplying:</h4>
                  <ul className="list-none p-0 m-0">
                    <li className="text-slate-600 text-sm py-1">☑ Valid Business Permit (Mayor's Permit) - Current year</li>
                    <li className="text-slate-600 text-sm py-1">☑ Sanitation Permit from Local Health Office</li>
                    <li className="text-slate-600 text-sm py-1">☑ FDA License to Operate (LTO) for water products</li>
                    <li className="text-slate-600 text-sm py-1">☑ Latest water quality testing results</li>
                    <li className="text-slate-600 text-sm py-1">☑ Clear, high-quality scans/photos of all documents</li>
                    <li className="text-slate-600 text-sm py-1">☑ Accurate business information and location</li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-md p-3 mb-2">
                  <strong className="block mb-1 text-purple-900">📘 Important:</strong> All water stations must comply with:
                  <ul className="list-none p-0 m-0 mt-2">
                    <li className="text-slate-600 text-sm py-1">• DOH Administrative Order 2017-0010 (Water Refilling Standards)</li>
                    <li className="text-slate-600 text-sm py-1">• Philippine National Standards (PNS) for drinking water</li>
                    <li className="text-slate-600 text-sm py-1">• Data Privacy Act of 2012 (Republic Act 10173)</li>
                    <li className="text-slate-600 text-sm py-1">• Local government health and sanitation codes</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleReapply}
                className="border-none px-6 py-3 rounded-md cursor-pointer font-medium flex-1 min-w-[140px] transition-all text-sm bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5"
              >
                ↻ Reapply Now
              </button>
              <button
                onClick={handleClearRejection}
                className="border-none px-6 py-3 rounded-md cursor-pointer font-medium flex-1 min-w-[140px] transition-all text-sm bg-gray-500 text-white hover:bg-gray-600 hover:-translate-y-0.5"
              >
                ✕ Clear & Try Again
              </button>
            </div>

            <p className="mt-4 text-xs text-amber-800 text-center">
              Need help? <a href="mailto:support@aquallera.com" className="text-red-600 font-semibold no-underline hover:underline">Contact Support</a>
            </p>
          </div>
        )}

        {errors.general && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-center font-medium">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block mb-2 text-gray-700 font-medium text-sm">Email Address *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your@email.com"
              className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] ${errors.email ? 'border-red-500' : 'border-slate-200'} ${isLoading ? 'bg-slate-50 cursor-not-allowed opacity-70' : ''}`}
              disabled={isLoading}
              autoComplete="email"
            />
            {errors.email && <span className="text-red-500 text-sm mt-1 block">{errors.email}</span>}
          </div>

          <div className="mb-6">
            <label className="block mb-2 text-gray-700 font-medium text-sm">Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] ${errors.password ? 'border-red-500' : 'border-slate-200'} ${isLoading ? 'bg-slate-50 cursor-not-allowed opacity-70' : ''}`}
              disabled={isLoading}
              autoComplete="current-password"
            />
            {errors.password && <span className="text-red-500 text-sm mt-1 block">{errors.password}</span>}
          </div>

          <div className="flex justify-between items-center mb-8">
            <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleInputChange}
                className="w-[18px] h-[18px] m-0"
                disabled={isLoading}
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="bg-transparent border-none text-blue-600 cursor-pointer text-sm p-0 font-sans hover:underline disabled:text-slate-400 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className={`w-full py-3 px-4 rounded-lg font-semibold cursor-pointer transition-all text-base bg-blue-600 text-white flex items-center justify-center gap-2 min-h-[48px] hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="w-[18px] h-[18px] border-2 border-transparent border-t-current rounded-full animate-spin"></span>
                Signing in...
              </>
            ) : (
              'Sign in to Dashboard'
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-200">
          <h4 className="text-slate-800 mb-4 text-base">What you can do after login:</h4>
          <ul className="list-none p-0 m-0">
            <li className="py-2 text-slate-500 flex items-center gap-3 text-sm"> View real-time business analytics</li>
            <li className="py-2 text-slate-500 flex items-center gap-3 text-sm"> Manage delivery orders</li>
            <li className="py-2 text-slate-500 flex items-center gap-3 text-sm"> Update pricing and services</li>
            <li className="py-2 text-slate-500 flex items-center gap-3 text-sm"> Set business hours</li>
            <li className="py-2 text-slate-500 flex items-center gap-3 text-sm"> Manage service areas</li>
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

        <div className="text-center pt-6 border-t border-slate-200">
          <p>Don't have an account? <a href="/signup" className="text-blue-600 hover:underline font-medium">Register your station</a></p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
            Need help? <a href="mailto:support@aquallera.com">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;