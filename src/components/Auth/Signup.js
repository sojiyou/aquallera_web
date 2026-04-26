// src/components/Auth/Signup.js - WITH DELIVERY HOURS
import React, { useState, useRef, useEffect } from 'react';
import './Auth.css';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, database } from '../config/Firebase';
import { useNavigate } from 'react-router-dom';

const Signup = () => {

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // Station Information
    stationName: '',
    ownerName: '',
    email: '',
    phone: '',
    
    // Location Details
    address: '',
    city: '',
    state: '',
    zipCode: '',
    latitude: null,
    longitude: null,
    
    // Business Information
    businessHours: { open: '08:00', close: '18:00' },
    serviceTypes: [],
    deliveryRadius: 5,
    deliveryHours: [], // NEW: Array of delivery time slots
    
    // PRICING VARIABLES
    pricing_gallon_pure: '',
    pricing_liter_spring: '',
    pricing_gallon_mineral: '',
    pricing_delivery_fee: '',
    
    // Business Permit
    businessPermitNumber: '',
    permitFile: null,
    permitFileUrl: '',
    
    // Login Credentials
    password: '',
    confirmPassword: '',
    termsAccepted: false
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [locationStatus, setLocationStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  // ========== MAPBOX MAP STATES ==========
  const [mapboxSearch, setMapboxSearch] = useState('');
  const [mapboxResults, setMapboxResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const mapContainerRef = useRef(null);
  const searchContainerRef = useRef(null);

  // ========== NEW: DELIVERY HOURS STATE ==========
  const [newDeliveryTime, setNewDeliveryTime] = useState('09:00');

  // ========== YOUR EXISTING HANDLERS (UNCHANGED) ==========
  const handleNumberInputChange = (e) => { 
    const { name, value } = e.target; 
    const filteredValue = value.replace(/\D/g, '').substring(0, 11); 
    setFormData(prev => ({ ...prev, [name]: filteredValue })); 
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleBusinessHoursChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      businessHours: { ...prev.businessHours, [field]: value }
    }));
  };

  const handleServiceTypeChange = (serviceType) => {
    setFormData(prev => {
      const currentTypes = [...prev.serviceTypes];
      if (currentTypes.includes(serviceType)) {
        return {
          ...prev,
          serviceTypes: currentTypes.filter(type => type !== serviceType)
        };
      } else {
        return {
          ...prev,
          serviceTypes: [...currentTypes, serviceType]
        };
      }
    });
  };

  // ========== NEW: DELIVERY HOURS HANDLERS ==========
  const addDeliveryHour = () => {
    if (!newDeliveryTime) return;
    
    // Check if time already exists
    if (formData.deliveryHours.includes(newDeliveryTime)) {
      setErrors(prev => ({ ...prev, deliveryHours: 'This delivery time already exists' }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      deliveryHours: [...prev.deliveryHours, newDeliveryTime].sort()
    }));
    
    setNewDeliveryTime('09:00');
    setErrors(prev => ({ ...prev, deliveryHours: '' }));
  };

  const removeDeliveryHour = (timeToRemove) => {
    setFormData(prev => ({
      ...prev,
      deliveryHours: prev.deliveryHours.filter(time => time !== timeToRemove)
    }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, permitFile: 'Only JPG, PNG, or PDF files allowed' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, permitFile: 'File size must be less than 5MB' }));
      return;
    }

    setErrors(prev => ({ ...prev, permitFile: '' }));
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          permitFile: file,
          permitFileUrl: reader.result
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setFormData(prev => ({
        ...prev,
        permitFile: file,
        permitFileUrl: null
      }));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const removeFile = () => {
    setFormData(prev => ({
      ...prev,
      permitFile: null,
      permitFileUrl: ''
    }));
    setErrors(prev => ({ ...prev, permitFile: '' }));
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        fileToBase64(file).then(resolve).catch(reject);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        
        img.onerror = reject;
      };
      
      reader.onerror = reject;
    });
  };

  const simulateUploadProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
    return interval;
  };

  // ========== DETECT CLICKS OUTSIDE SEARCH TO CLOSE RESULTS ==========
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setMapboxResults([]);
      }
    };

    if (mapboxResults.length > 0) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mapboxResults]);

  // ========== INITIALIZE MAPBOX MAP WHEN STEP 2 IS SHOWN ==========
  useEffect(() => {
    if (currentStep === 2 && mapContainerRef.current && !map) {
      initializeMap();
    }
    
    return () => {
      if (map) {
        try {
          map.remove();
        } catch (error) {
          console.log('Map cleanup:', error);
        }
        setMap(null);
        setMarker(null);
      }
    };
  }, [currentStep, map]);

  // ========== INITIALIZE THE MAPBOX MAP ==========
  const initializeMap = () => {
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js';
    script.async = true;
    
    script.onload = () => {
      const link = document.createElement('link');
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;

      const defaultCenter = [121.0244, 14.5547];
      
      const center = formData.latitude && formData.longitude 
        ? [formData.longitude, formData.latitude] 
        : defaultCenter;

      const mapInstance = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: formData.latitude ? 15 : 11
      });

      mapInstance.addControl(new window.mapboxgl.NavigationControl());

      const markerInstance = new window.mapboxgl.Marker({
        draggable: true,
        color: '#2563eb'
      })
        .setLngLat(center)
        .addTo(mapInstance);

      markerInstance.on('dragend', async () => {
        const lngLat = markerInstance.getLngLat();
        await updateLocationFromCoordinates(lngLat.lat, lngLat.lng);
      });

      mapInstance.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        markerInstance.setLngLat([lng, lat]);
        await updateLocationFromCoordinates(lat, lng);
      });

      setMap(mapInstance);
      setMarker(markerInstance);
      
      if (formData.latitude && formData.longitude) {
        updateLocationFromCoordinates(formData.latitude, formData.longitude);
      }
    };
    
    document.head.appendChild(script);
  };

  // ========== UPDATE LOCATION FROM COORDINATES ==========
  const updateLocationFromCoordinates = async (lat, lng) => {
    setLocationStatus('Getting address...');
    
    try {
      const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `country=PH&` +
        `types=address,place,poi&` +
        `language=en&` +
        `limit=1`
      );
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const place = data.features[0];
        
        let address = '';
        let city = '';
        let state = '';
        let zipCode = '';
        
        if (place.context) {
          place.context.forEach(item => {
            if (item.id.includes('place')) {
              city = item.text;
            } else if (item.id.includes('region')) {
              state = item.text;
            } else if (item.id.includes('postcode')) {
              zipCode = item.text;
            }
          });
        }
        
        address = place.text || place.place_name.split(',')[0];
        
        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(lat.toFixed(8)),
          longitude: parseFloat(lng.toFixed(8)),
          address: address,
          city: city || prev.city,
          state: state || prev.state,
          zipCode: zipCode || prev.zipCode
        }));
        
        setLocationStatus(`✓ Location set: ${place.place_name}`);
      } else {
        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(lat.toFixed(8)),
          longitude: parseFloat(lng.toFixed(8))
        }));
        setLocationStatus('✓ Coordinates saved');
      }
    } catch (error) {
      console.error('Error getting address:', error);
      setFormData(prev => ({
        ...prev,
        latitude: parseFloat(lat.toFixed(8)),
        longitude: parseFloat(lng.toFixed(8))
      }));
      setLocationStatus('✓ Coordinates saved (address lookup failed)');
    }
  };

  // ========== MAPBOX SEARCH ==========
  const searchAddress = async (query) => {
    if (!query.trim()) {
      setMapboxResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `country=PH&` +
        `types=address,place,poi,locality,neighborhood,district&` +
        `language=en&` +
        `limit=8&` +
        `autocomplete=true&` +
        `fuzzyMatch=true`
      );
      
      const data = await response.json();
      setMapboxResults(data.features || []);
    } catch (error) {
      console.error('Search error:', error);
      setMapboxResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapboxSearch) {
        searchAddress(mapboxSearch);
      } else {
        setMapboxResults([]);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [mapboxSearch]);

  const clearSearch = () => {
    setMapboxSearch('');
    setMapboxResults([]);
  };

  const handleSelectSearchResult = (result) => {
    const [lng, lat] = result.center;
    
    if (marker) {
      marker.setLngLat([lng, lat]);
    }
    
    if (map) {
      map.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 1000
      });
    }
    
    updateLocationFromCoordinates(lat, lng);
    setMapboxResults([]);
    setMapboxSearch('');
  };

  // ========== VALIDATION FUNCTIONS ==========
  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!formData.stationName.trim()) newErrors.stationName = 'Station name required';
      if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name required';
      if (!formData.email.trim()) {
        newErrors.email = 'Email required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
      if (!formData.phone.trim()) newErrors.phone = 'Phone number required';
    }
    
    if (step === 2) {
      if (!formData.latitude || !formData.longitude) {
        newErrors.location = 'Please set your station location on the map';
      }
      if (!formData.address.trim()) newErrors.address = 'Address required';
      if (!formData.city.trim()) newErrors.city = 'City required';
      if (!formData.state.trim()) newErrors.state = 'State required';
      if (!formData.zipCode.trim()) newErrors.zipCode = 'ZIP code required';
      if (formData.serviceTypes.length === 0) {
        newErrors.serviceTypes = 'Select at least one service type';
      }
      // NEW: Validate delivery hours if delivery service is selected
      if (formData.serviceTypes.includes('delivery') && formData.deliveryHours.length === 0) {
        newErrors.deliveryHours = 'Add at least one delivery time slot';
      }
    }
    
    if (step === 3) {
      // Pricing is optional
    }
    
    if (step === 4) {
      if (!formData.businessPermitNumber.trim()) {
        newErrors.businessPermitNumber = 'Business permit number required';
      }
      if (!formData.permitFile) {
        newErrors.permitFile = 'Business permit file required';
      }
    }
    
    if (step === 5) {
      if (!formData.password) {
        newErrors.password = 'Password required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      
      if (!formData.termsAccepted) {
        newErrors.termsAccepted = 'You must accept the terms';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      setErrors({});
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(5)) return;
    
    setIsUploading(true);
    const progressInterval = simulateUploadProgress();
    
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      
      const user = userCredential.user;
      
      let businessPermitBase64 = null;
      if (formData.permitFile) {
        businessPermitBase64 = await compressImage(formData.permitFile);
      }
      
      const stationData = {
        stationName: formData.stationName,
        ownerName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        latitude: formData.latitude,
        longitude: formData.longitude,
        businessHours: formData.businessHours,
        serviceTypes: formData.serviceTypes,
        deliveryRadius: Number(formData.deliveryRadius),
        deliveryHours: formData.deliveryHours, 
        pricing_gallon_pure: formData.pricing_gallon_pure ? parseFloat(formData.pricing_gallon_pure) : null,
        pricing_liter_spring: formData.pricing_liter_spring ? parseFloat(formData.pricing_liter_spring) : null,
        pricing_gallon_mineral: formData.pricing_gallon_mineral ? parseFloat(formData.pricing_gallon_mineral) : null,
        pricing_delivery_fee: formData.pricing_delivery_fee ? parseFloat(formData.pricing_delivery_fee) : null,
        businessPermitNumber: formData.businessPermitNumber,
        businessPermitBase64: businessPermitBase64,
        businessPermitFilename: formData.permitFile?.name || null,
        businessPermitFileType: formData.permitFile?.type || null,
        businessPermitFileSize: formData.permitFile?.size || null,
        businessPermitUploadedAt: new Date().toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: user.uid
      };
      
      await set(ref(database, 'waterStations/' + user.uid), stationData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      alert('✅ Registration successful! Please wait for admin approval.');
      window.location.href = '/login';
      
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Registration error:', error);
      
      let errorMessage = 'Registration failed: ';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage += 'Email already registered';
          break;
        case 'auth/invalid-email':
          errorMessage += 'Invalid email format';
          break;
        case 'auth/weak-password':
          errorMessage += 'Password too weak';
          break;
        default:
          errorMessage += error.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card signup-card">
        {/* 🔙 BACK TO HOME BUTTON */}
        <button
          type="button"
          className="btn-home"
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
        <div className="auth-header">
          <h2>Register Your Water Station</h2>
          <p>Join the AQUA-LLERA network</p>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          {[1, 2, 3, 4, 5].map(step => (
            <div 
              key={step} 
              className={`progress-step ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
            >
              <div className="step-number">{step}</div>
              <div className="step-label">
                {step === 1 && 'Basic Info'}
                {step === 2 && 'Location'}
                {step === 3 && 'Pricing'}
                {step === 4 && 'Permit'}
                {step === 5 && 'Account'}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* STEP 1: Basic Information */}
          {currentStep === 1 && (
            <div className="form-step">
              <h3>Station Information</h3>
              
              <div className="form-group">
                <label>Station Name *</label>
                <input
                  type="text"
                  name="stationName"
                  value={formData.stationName}
                  onChange={handleInputChange}
                  placeholder="e.g., Crystal Clear Water Station"
                  className={errors.stationName ? 'error' : ''}
                />
                {errors.stationName && <span className="error-text">{errors.stationName}</span>}
              </div>

              <div className="form-group">
                <label>Owner Name *</label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleInputChange}
                  placeholder="Full name of the owner"
                  className={errors.ownerName ? 'error' : ''}
                />
                {errors.ownerName && <span className="error-text">{errors.ownerName}</span>}
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your@email.com"
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleNumberInputChange}
                  placeholder="09XXXXXXXXX"
                  className={errors.phone ? 'error' : ''}
                />
                {errors.phone && <span className="error-text">{errors.phone}</span>}
              </div>
            </div>
          )}

          {/* STEP 2: Location - WITH DELIVERY HOURS */}
          {currentStep === 2 && (
            <div className="form-step">
              <h3>Station Location</h3>
              <p className="step-description">
                📍 Use the map below to pinpoint your exact station location. 
                You can search for an address or click/drag the marker on the map.
              </p>

              {/* SEARCH BOX */}
              <div className="form-group">
                <label>Search for Your Address</label>
                <div className="mapbox-search-container" ref={searchContainerRef}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={mapboxSearch}
                      onChange={(e) => setMapboxSearch(e.target.value)}
                      placeholder="Type your address, street, or landmark..."
                      className="mapbox-search-input"
                    />
                    
                    {mapboxSearch && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="search-clear-btn"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  {mapboxResults.length > 0 && (
                    <div className="mapbox-results">
                      {mapboxResults.map((result, index) => (
                        <div
                          key={index}
                          className="mapbox-result-item"
                          onClick={() => handleSelectSearchResult(result)}
                        >
                          <div className="result-icon">📍</div>
                          <div className="result-text">
                            <div className="result-title">{result.text}</div>
                            <div className="result-subtitle">{result.place_name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {isSearching && (
                    <div className="search-loading">
                      <div className="spinner-small"></div>
                      Searching...
                    </div>
                  )}
                </div>
              </div>

              {/* INTERACTIVE MAP */}
              <div className="map-container-wrapper">
                <div 
                  ref={mapContainerRef} 
                  className="mapbox-map-container"
                  style={{
                    width: '100%',
                    height: '400px',
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}
                />
                
                <div className="map-instructions">
                  <p><strong>How to set your location:</strong></p>
                  <ul>
                    <li>🔍 Search for your address in the box above</li>
                    <li>🖱️ Click anywhere on the map to move the pin</li>
                    <li>✋ Drag the blue pin to fine-tune your exact location</li>
                  </ul>
                </div>
                
                {locationStatus && (
                  <div className="location-status">
                    {locationStatus}
                    {formData.latitude && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#0369a1' }}>
                        Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                      </div>
                    )}
                  </div>
                )}
                
                {errors.location && <span className="error-text">{errors.location}</span>}
              </div>

              {/* ADDRESS FIELDS */}
              <div className="form-group">
                <label>Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Street address (auto-filled from map)"
                  className={errors.address ? 'error' : ''}
                />
                {errors.address && <span className="error-text">{errors.address}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="City (auto-filled from map)"
                    className={errors.city ? 'error' : ''}
                  />
                  {errors.city && <span className="error-text">{errors.city}</span>}
                </div>

                <div className="form-group">
                  <label>State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="State/Province (auto-filled from map)"
                    className={errors.state ? 'error' : ''}
                  />
                  {errors.state && <span className="error-text">{errors.state}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>ZIP Code *</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  placeholder="12345"
                  className={errors.zipCode ? 'error' : ''}
                />
                {errors.zipCode && <span className="error-text">{errors.zipCode}</span>}
              </div>

              {/* SERVICES */}
              <div className="form-group">
                <label>Services Offered *</label>
                <div className="service-options">
                  <label className="service-option">
                    <input
                      type="checkbox"
                      checked={formData.serviceTypes.includes('delivery')}
                      onChange={() => handleServiceTypeChange('delivery')}
                    />
                    <span>Delivery</span>
                  </label>
                  <label className="service-option">
                    <input
                      type="checkbox"
                      checked={formData.serviceTypes.includes('pickup')}
                      onChange={() => handleServiceTypeChange('pickup')}
                    />
                    <span>Pickup</span>
                  </label>
                </div>
                {errors.serviceTypes && <span className="error-text">{errors.serviceTypes}</span>}
              </div>

              {/* BUSINESS HOURS */}
              <div className="form-group">
                <label>Business Hours</label>
                <div className="hours-input">
                  <div>
                    <label>Open</label>
                    <input
                      type="time"
                      value={formData.businessHours.open}
                      onChange={(e) => handleBusinessHoursChange('open', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Close</label>
                    <input
                      type="time"
                      value={formData.businessHours.close}
                      onChange={(e) => handleBusinessHoursChange('close', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* NEW: DELIVERY HOURS SECTION */}
              {formData.serviceTypes.includes('delivery') && (
                <>
                  <div className="form-group">
                    <label>Delivery Radius (km)</label>
                    <select 
                      name="deliveryRadius" 
                      value={formData.deliveryRadius}
                      onChange={handleInputChange}
                    >
                      <option value="5">5 km</option>
                      <option value="10">10 km</option>
                      <option value="15">15 km</option>
                      <option value="20">20 km</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Delivery Hours *</label>
                    <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
                      Add the times when you deliver water to customers
                    </p>
                    
                    {/* Add Delivery Time */}
                    <div className="delivery-hours-add">
                      <input
                        type="time"
                        value={newDeliveryTime}
                        onChange={(e) => setNewDeliveryTime(e.target.value)}
                        className="delivery-time-input"
                      />
                      <button
                        type="button"
                        onClick={addDeliveryHour}
                        className="btn-add-delivery"
                      >
                        + Add Time
                      </button>
                    </div>

                    {errors.deliveryHours && (
                      <span className="error-text">{errors.deliveryHours}</span>
                    )}

                    {/* Display Delivery Hours */}
                    {formData.deliveryHours.length > 0 && (
                      <div className="delivery-hours-list">
                        {formData.deliveryHours.map((time, index) => (
                          <div key={index} className="delivery-hour-item">
                            <span className="delivery-time-icon">🚚</span>
                            <span className="delivery-time-value">{time}</span>
                            <button
                              type="button"
                              onClick={() => removeDeliveryHour(time)}
                              className="btn-remove-delivery"
                              title="Remove this delivery time"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {formData.deliveryHours.length === 0 && (
                      <div className="delivery-hours-empty">
                        No delivery times added yet
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3: Pricing */}
          {currentStep === 3 && (
            <div className="form-step">
              <h3>Product Pricing (Optional)</h3>
              <p className="pricing-note">
                Set your pricing now or update it later in your dashboard settings.
              </p>

              <div className="pricing-grid">
                <div className="form-group">
                  <label>Gallon Pure Water</label>
                  <div className="price-input">
                    <span className="currency">₱</span>
                    <input
                      type="number"
                      name="pricing_gallon_pure"
                      value={formData.pricing_gallon_pure}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={errors.pricing_gallon_pure ? 'error' : ''}
                    />
                  </div>
                  {errors.pricing_gallon_pure && (
                    <span className="error-text">{errors.pricing_gallon_pure}</span>
                  )}
                  <small className="field-hint">Optional - set later if needed</small>
                </div>

                <div className="form-group">
                  <label>Liter Spring Water</label>
                  <div className="price-input">
                    <span className="currency">₱</span>
                    <input
                      type="number"
                      name="pricing_liter_spring"
                      value={formData.pricing_liter_spring}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={errors.pricing_liter_spring ? 'error' : ''}
                    />
                  </div>
                  {errors.pricing_liter_spring && (
                    <span className="error-text">{errors.pricing_liter_spring}</span>
                  )}
                  <small className="field-hint">Optional - set later if needed</small>
                </div>

                <div className="form-group">
                  <label>Gallon Mineral Water</label>
                  <div className="price-input">
                    <span className="currency">₱</span>
                    <input
                      type="number"
                      name="pricing_gallon_mineral"
                      value={formData.pricing_gallon_mineral}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={errors.pricing_gallon_mineral ? 'error' : ''}
                    />
                  </div>
                  {errors.pricing_gallon_mineral && (
                    <span className="error-text">{errors.pricing_gallon_mineral}</span>
                  )}
                  <small className="field-hint">Optional - set later if needed</small>
                </div>

                <div className="form-group">
                  <label>Delivery Fee (per delivery)</label>
                  <div className="price-input">
                    <span className="currency">₱</span>
                    <input
                      type="number"
                      name="pricing_delivery_fee"
                      value={formData.pricing_delivery_fee}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={errors.pricing_delivery_fee ? 'error' : ''}
                    />
                  </div>
                  {errors.pricing_delivery_fee && (
                    <span className="error-text">{errors.pricing_delivery_fee}</span>
                  )}
                  <small className="field-hint">Optional - set later if needed</small>
                </div>
              </div>

              <div className="pricing-note-footer">
                <small>Note: You can update these prices anytime in your station settings dashboard.</small>
              </div>
            </div>
          )}

          {/* STEP 4: Business Permit */}
          {currentStep === 4 && (
            <div className="form-step">
              <h3>Business Permit Verification</h3>
              <p className="permit-note">
                Upload a clear photo or scan of your valid business permit. 
                This is required for approval to operate on our platform.
              </p>
              
              <div className="form-group">
                <label>Business Permit Number *</label>
                <input
                  type="text"
                  name="businessPermitNumber"
                  value={formData.businessPermitNumber}
                  onChange={handleInputChange}
                  placeholder="Enter your official permit number"
                  className={errors.businessPermitNumber ? 'error' : ''}
                />
                {errors.businessPermitNumber && (
                  <span className="error-text">{errors.businessPermitNumber}</span>
                )}
                <small className="field-hint">
                  This should match the number on your business permit document
                </small>
              </div>

              <div className="form-group">
                <label>Upload Business Permit *</label>
                <div className="file-upload-section">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".jpg,.jpeg,.png,.pdf"
                    style={{ display: 'none' }}
                  />
                  
                  {!formData.permitFile ? (
                    <div className="file-upload-area" onClick={triggerFileInput}>
                      <div className="upload-icon">📄</div>
                      <div className="upload-text">
                        <p className="upload-title">Click to upload business permit</p>
                        <p className="upload-subtitle">
                          Supports JPG, PNG, or PDF (max 5MB)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="file-preview">
                      {formData.permitFileUrl && formData.permitFile.type.startsWith('image/') ? (
                        <div className="image-preview">
                          <img src={formData.permitFileUrl} alt="Business permit preview" />
                          <div className="file-info">
                            <p className="file-name">{formData.permitFile.name}</p>
                            <p className="file-size">
                              {(formData.permitFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="document-preview">
                          <div className="document-icon">📄</div>
                          <div className="file-info">
                            <p className="file-name">{formData.permitFile.name}</p>
                            <p className="file-size">
                              {(formData.permitFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <p className="file-type">PDF Document</p>
                          </div>
                        </div>
                      )}
                      <button 
                        type="button" 
                        className="remove-file-btn"
                        onClick={removeFile}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  
                  {errors.permitFile && (
                    <span className="error-text">{errors.permitFile}</span>
                  )}
                  
                  {isUploading && (
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <span className="progress-text">Processing... {uploadProgress}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="permit-requirements">
                <h4>Requirements:</h4>
                <ul>
                  <li>Document must be valid and not expired</li>
                  <li>Clear photo/scan with all text readable</li>
                  <li>Permit number must match the one entered above</li>
                  <li>File must be less than 5MB</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 5: Account Setup */}
          {currentStep === 5 && (
            <div className="form-step">
              <h3>Account Setup</h3>
              
              {/* Two-column layout for password fields and rules */}
              <div className="signup-step5-container">
                
                {/* LEFT SIDE: Password Fields */}
                <div className="password-section">
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Minimum 6 characters"
                      className={errors.password ? 'error' : ''}
                    />
                    {errors.password && <span className="error-text">{errors.password}</span>}
                  </div>

                  <div className="form-group">
                    <label>Confirm Password *</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Confirm your password"
                      className={errors.confirmPassword ? 'error' : ''}
                    />
                    {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="termsAccepted"
                        checked={formData.termsAccepted}
                        onChange={handleInputChange}
                      />
                      <span>I agree to Terms & Conditions and Data Privacy Policy</span>
                    </label>
                    {errors.termsAccepted && <span className="error-text">{errors.termsAccepted}</span>}
                  </div>
                </div>

                {/* RIGHT SIDE: Rejection Rules */}
                <div className="rejection-rules-sidebar">
                  <h4>📋 Application Requirements</h4>
                  <p className="rules-intro">
                    Please ensure you meet ALL requirements before submitting:
                  </p>

                  <div className="rules-category">
                    <h5>✅ Valid Documents Required:</h5>
                    <ul>
                      <li>Current Business Permit (Mayor's Permit)</li>
                     {/*<li>FDA License to Operate (LTO)</li>*/}
                      {/*<li>Sanitation Permit from Health Office</li>*/}
                      {/*<li>Latest water quality test results</li>*/}
                      {/*<li>Clear, readable document scans</li>*/}
                    </ul>
                  </div>

                  <div className="rules-category">
                    <h5>📍 Location Requirements:</h5>
                    <ul>
                      <li>Valid commercial address</li>
                      <li>Properly zoned for water station</li>
                      <li>Accurate coordinates on map</li>
                      <li>No duplicate at same location</li>
                    </ul>
                  </div>

                  <div className="rules-category compliance-note">
                    <h5>📘 Legal Compliance:</h5>
                    <p>Your station must comply with:</p>
                    <ul>
                      <li>DOH Admin Order 2017-0010</li>
                      <li>Philippine National Standards (PNS)</li>
                      <li>Data Privacy Act (RA 10173)</li>
                      <li>Local sanitation codes</li>
                    </ul>
                  </div>

                  <div className="warning-note">
                    <strong>⚠️ Important:</strong> Providing false information or missing documents will result in immediate rejection. Please double-check everything before submitting.
                  </div>

                  <div className="support-note">
                    <p>
                      <strong>Need Help?</strong><br/>
                      Email: <a href="mailto:support@aquallera.com">support@aquallera.com</a>
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="form-navigation">
            {currentStep > 1 && (
              <button type="button" onClick={prevStep} className="btn-secondary">
                Back
              </button>
            )}
            
            {currentStep < 5 ? (
              <button type="button" onClick={nextStep} className="btn-primary">
                Continue
              </button>
            ) : (
              <button type="submit" className="btn-primary" disabled={isUploading}>
                {isUploading ? 'Processing...' : 'Register'}
              </button>
            )}
          </div>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <a href="/login">Login</a></p>
        </div>
      </div>
    </div>
  );
};

export default Signup;