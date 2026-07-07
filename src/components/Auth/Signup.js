// src/components/Auth/Signup.js - WITH DELIVERY HOURS
import React, { useState, useRef, useEffect } from 'react';
import AlertCard, { useAlert } from '../admin/AlertCard';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set, get, query, orderByChild, equalTo } from 'firebase/database';
import { auth, database } from '../config/Firebase';
import { useNavigate } from 'react-router-dom';

const Signup = () => {

  const [alertProps, showAlert, closeAlert] = useAlert();
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
    pricing_gallon_spring: '',
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

  // ========== DELIVERY HOURS HANDLERS ==========
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
        color: '#065A82'
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
      const existingStationSnap = await get(query(ref(database, 'waterStations'), orderByChild('email'), equalTo(formData.email)));
      if (existingStationSnap.exists()) {
        showAlert({ type: 'warning', message: 'This email is already registered as a station owner. Please log in instead.' });
        clearInterval(progressInterval);
        setIsUploading(false);
        return;
      }

      let user;
      try {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        user = cred.user;
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          const existingCred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
          user = existingCred.user;
        } else {
          throw createErr;
        }
      }

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
        pricing_gallon_spring: formData.pricing_gallon_spring ? parseFloat(formData.pricing_gallon_spring) : null,
        pricing_gallon_mineral: formData.pricing_gallon_mineral ? parseFloat(formData.pricing_gallon_mineral) : null,
        pricing_delivery_fee: formData.pricing_delivery_fee ? parseFloat(formData.pricing_delivery_fee) : null,
        businessPermitNumber: formData.businessPermitNumber,
        businessPermitBase64: businessPermitBase64,
        businessPermitFilename: formData.permitFile?.name || null,
        businessPermitFileType: formData.permitFile?.type || null,
        businessPermitFileSize: formData.permitFile?.size || null,
        businessPermitUploadedAt: new Date().toISOString(),
        password: formData.password,
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: user.uid
      };

      await set(ref(database, 'waterStations/' + user.uid), stationData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      showAlert({ type: 'success', message: 'Registration successful! Please wait for admin approval.' });
      setTimeout(() => { window.location.href = '/login'; }, 2000);

    } catch (error) {
      clearInterval(progressInterval);
      console.error('Registration error:', error);

      let errorMessage = 'Registration failed: ';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage += 'Email already registered. Check your password and try again.';
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

      showAlert({ type: 'error', message: errorMessage });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-8 font-sans relative overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 1440 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#9EB3C2" d="M0,200L48,213.3C96,226.7,192,253.3,288,250.7C384,248,480,216,576,213.3C672,210.7,768,237.3,864,245.3C960,253.3,1056,242.7,1152,224C1248,205.3,1344,178.7,1392,165.3L1440,152L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
        <path fill="#ffffff" d="M0,350L48,338.7C96,327.3,192,304.7,288,320C384,335.3,480,388.7,576,396C672,403.3,768,364.7,864,346.7C960,328.7,1056,331.3,1152,352C1248,372.7,1344,411.3,1392,430.7L1440,450L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
        <path fill="#9EB3C2" d="M0,550L48,565.3C96,580.7,192,611.3,288,608C384,604.7,480,568,576,554.7C672,541.3,768,552,864,578.7C960,605.3,1056,648,1152,632C1248,616,1344,541.3,1392,504L1440,466.7L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
      </svg>
      <div className="bg-white rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] p-10 w-full max-w-md relative z-10">
        {/* 🔙 BACK TO HOME BUTTON */}
        <button
          type="button"
          className="bg-primary text-white p-2 rounded-md border-none text-base text-sm cursor-pointer mb-3 text-left hover:bg-dark cursor:pointer"
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
        <div className="text-center mb-8">
          <h2 className="text-slate-800 text-3xl mb-2">Register Your Water Station</h2>
          <p className="text-slate-500 text-sm m-0">Join the AQUA-LLERA network</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 relative">
          {[1, 2, 3, 4, 5].map(step => (
            <div
              key={step}
              className={`flex flex-col items-center relative z-[2] flex-1 ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 border-[3px] border-white transition-all duration-300 ${currentStep > step ? 'bg-secondary text-white border-secondary' : currentStep >= step ? 'bg-primary text-white border-primary' : 'bg-slate-200 text-slate-500'}`}>{step}</div>
              <div className={`text-xs text-slate-500 font-medium text-center ${currentStep >= step ? 'text-primary font-semibold' : ''}`}>
                {step === 1 && 'Basic Info'}
                {step === 2 && 'Location'}
                {step === 3 && 'Pricing'}
                {step === 4 && 'Permit'}
                {step === 5 && 'Account'}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* STEP 1: Basic Information */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Station Information</h3>

              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Station Name *</label>
                <input
                  type="text"
                  name="stationName"
                  value={formData.stationName}
                  onChange={handleInputChange}
                  placeholder="e.g., Crystal Clear Water Station"
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.stationName ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.stationName && <span className="text-red-500 text-sm mt-1 block">{errors.stationName}</span>}
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Owner Name *</label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleInputChange}
                  placeholder="Full name of the owner"
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.ownerName ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.ownerName && <span className="text-red-500 text-sm mt-1 block">{errors.ownerName}</span>}
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your@email.com"
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.email ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.email && <span className="text-red-500 text-sm mt-1 block">{errors.email}</span>}
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleNumberInputChange}
                  placeholder="09XXXXXXXXX"
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.phone ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.phone && <span className="text-red-500 text-sm mt-1 block">{errors.phone}</span>}
              </div>
            </div>
          )}

          {/* STEP 2: Location - WITH DELIVERY HOURS */}
          {currentStep === 2 && (
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Station Location</h3>
              <p className="bg-amber-50 border-l-4 border-l-amber-500 p-3 mb-6 rounded text-sm text-amber-800 leading-relaxed">
                📍 Use the map below to pinpoint your exact station location.
                You can search for an address or click/drag the marker on the map.
              </p>

              {/* SEARCH BOX */}
              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Search for Your Address</label>
                <div className="relative mb-2" ref={searchContainerRef}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={mapboxSearch}
                      onChange={(e) => setMapboxSearch(e.target.value)}
                      placeholder="Type your address, street, or landmark..."
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-base transition-all box-border pr-10 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)]"
                    />

                    {mapboxSearch && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-slate-200 border-none rounded-full w-6 h-6 flex items-center justify-center cursor-pointer text-slate-500 text-sm transition-all z-10 hover:bg-slate-300 hover:text-slate-800 active:scale-95"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {mapboxResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 max-h-[300px] overflow-y-auto z-[100] shadow-lg">
                      {mapboxResults.map((result, index) => (
                        <div
                          key={index}
                          className="flex items-center px-4 py-3 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                          onClick={() => handleSelectSearchResult(result)}
                        >
                          <div className="text-xl mr-3 text-slate-500 flex-shrink-0">📍</div>
                          <div className="flex-1">
                            <div className="font-semibold text-slate-800 mb-1">{result.text}</div>
                            <div className="text-xs text-slate-500 leading-tight">{result.place_name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isSearching && (
                    <div className="flex items-center gap-2 text-slate-500 text-sm mt-2 p-2">
                      <div className="w-4 h-4 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
                      Searching...
                    </div>
                  )}
                </div>
              </div>

              {/* INTERACTIVE MAP */}
              <div className="my-6">
                <div
                  ref={mapContainerRef}
                  className="border-2 border-slate-200 rounded-lg overflow-hidden shadow-md"
                  style={{
                    width: '100%',
                    height: '400px',
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}
                />

                <div className="bg-slate-50 border border-slate-200 rounded-md p-4 mb-4">
                  <p className="m-0 mb-2 font-semibold text-slate-800 text-sm"><strong>How to set your location:</strong></p>
                  <ul className="m-0 pl-6 list-none">
                    <li className="mb-1.5 text-slate-500 text-xs relative pl-2">🔍 Search for your address in the box above</li>
                    <li className="mb-1.5 text-slate-500 text-xs relative pl-2">🖱️ Click anywhere on the map to move the pin</li>
                    <li className="mb-1.5 text-slate-500 text-xs relative pl-2">✋ Drag the blue pin to fine-tune your exact location</li>
                  </ul>
                </div>

                {locationStatus && (
                  <div className="mt-2 p-2 rounded text-sm text-center bg-slate-50 text-slate-500">
                    {locationStatus}
                    {formData.latitude && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#1B3B6F' }}>
                        Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                      </div>
                    )}
                  </div>
                )}

                {errors.location && <span className="text-red-500 text-sm mt-1 block">{errors.location}</span>}
              </div>

              {/* ADDRESS FIELDS */}
              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Street address (auto-filled from map)"
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.address ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.address && <span className="text-red-500 text-sm mt-1 block">{errors.address}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="mb-6">
                  <label className="block mb-2 text-gray-700 font-medium text-sm">City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="City (auto-filled from map)"
                    className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.city ? 'border-red-500' : 'border-slate-200'}`}
                  />
                  {errors.city && <span className="text-red-500 text-sm mt-1 block">{errors.city}</span>}
                </div>

                <div className="mb-6">
                  <label className="block mb-2 text-gray-700 font-medium text-sm">State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="State/Province (auto-filled from map)"
                    className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.state ? 'border-red-500' : 'border-slate-200'}`}
                  />
                  {errors.state && <span className="text-red-500 text-sm mt-1 block">{errors.state}</span>}
                </div>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">ZIP Code *</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  placeholder="12345"
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.zipCode ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.zipCode && <span className="text-red-500 text-sm mt-1 block">{errors.zipCode}</span>}
              </div>

              {/* SERVICES */}
              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Services Offered *</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg transition-colors hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={formData.serviceTypes.includes('delivery')}
                      onChange={() => handleServiceTypeChange('delivery')}
                    />
                    <span>Delivery</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg transition-colors hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={formData.serviceTypes.includes('pickup')}
                      onChange={() => handleServiceTypeChange('pickup')}
                    />
                    <span>Pickup</span>
                  </label>
                </div>
                {errors.serviceTypes && <span className="text-red-500 text-sm mt-1 block">{errors.serviceTypes}</span>}
              </div>

              {/* BUSINESS HOURS */}
              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Business Hours</label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Open</label>
                    <input
                      type="time"
                      value={formData.businessHours.open}
                      onChange={(e) => handleBusinessHoursChange('open', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Close</label>
                    <input
                      type="time"
                      value={formData.businessHours.close}
                      onChange={(e) => handleBusinessHoursChange('close', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)]"
                    />
                  </div>
                </div>
              </div>

              {/* NEW: DELIVERY HOURS SECTION */}
              {formData.serviceTypes.includes('delivery') && (
                <>
                  <div className="mb-6">
                    <label className="block mb-2 text-gray-700 font-medium text-sm">Delivery Radius (km)</label>
                    <select
                      name="deliveryRadius"
                      value={formData.deliveryRadius}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)]"
                    >
                      <option value="5">5 km</option>
                      <option value="10">10 km</option>
                      <option value="15">15 km</option>
                      <option value="20">20 km</option>
                    </select>
                  </div>

                  <div className="mb-6">
                    <label className="block mb-2 text-gray-700 font-medium text-sm">Delivery Hours *</label>
                    <p className="block text-slate-400 text-xs mt-1 italic" style={{ marginBottom: '0.75rem' }}>
                      Add the times when you deliver water to customers
                    </p>

                    {/* Add Delivery Time */}
                    <div className="flex gap-2 mb-4">
                      <input
                        type="time"
                        value={newDeliveryTime}
                        onChange={(e) => setNewDeliveryTime(e.target.value)}
                        className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-lg text-base transition-all font-sans focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)]"
                      />
                      <button
                        type="button"
                        onClick={addDeliveryHour}
                        className="bg-secondary text-white border-none rounded-lg px-6 py-3 font-semibold cursor-pointer transition-all whitespace-nowrap text-sm hover:bg-primary-dark hover:-translate-y-0.5"
                      >
                        + Add Time
                      </button>
                    </div>

                    {errors.deliveryHours && (
                      <span className="text-red-500 text-sm mt-1 block">{errors.deliveryHours}</span>
                    )}

                    {/* Display Delivery Hours */}
                    {formData.deliveryHours.length > 0 && (
                      <div className="flex flex-col gap-2 mt-3">
                        {formData.deliveryHours.map((time, index) => (
                          <div key={index} className="flex items-center bg-surface border border-secondary/20 rounded-md px-4 py-3 transition-all hover:bg-secondary/10">
                            <span className="text-lg mr-3">🚚</span>
                            <span className="flex-1 font-semibold text-slate-800 text-base">{time}</span>
                            <button
                              type="button"
                              onClick={() => removeDeliveryHour(time)}
                              className="bg-red-50 text-red-600 border border-red-200 rounded w-7 h-7 flex items-center justify-center cursor-pointer transition-all text-base font-semibold flex-shrink-0 hover:bg-red-600 hover:text-white"
                              title="Remove this delivery time"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {formData.deliveryHours.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-md border border-dashed border-slate-300 mt-3">
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
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Product Pricing (Optional)</h3>
              <p className="text-slate-500 text-sm mb-6 p-3 bg-slate-50 rounded-md border-l-4 border-primary">
                Set your pricing now or update it later in your dashboard settings.
              </p>

              <div>
                <div className="mb-6">
                  <label className="block mb-2 text-gray-700 font-medium text-sm">Gallon Pure Water</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-semibold z-[2]">₱</span>
                    <input
                      type="number"
                      name="pricing_gallon_pure"
                      value={formData.pricing_gallon_pure}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border pl-10 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.pricing_gallon_pure ? 'border-red-500' : 'border-slate-200'}`}
                    />
                  </div>
                  {errors.pricing_gallon_pure && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.pricing_gallon_pure}</span>
                  )}
                  <small className="block text-slate-400 text-xs mt-1 italic">Optional - set later if needed</small>
                </div>

                <div className="mb-6">
                  <label className="block mb-2 text-gray-700 font-medium text-sm">gallon Spring Water</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-semibold z-[2]">₱</span>
                    <input
                      type="number"
                      name="pricing_gallon_spring"
                      value={formData.pricing_gallon_spring}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border pl-10 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.pricing_gallon_spring ? 'border-red-500' : 'border-slate-200'}`}
                    />
                  </div>
                  {errors.pricing_gallon_spring && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.pricing_gallon_spring}</span>
                  )}
                  <small className="block text-slate-400 text-xs mt-1 italic">Optional - set later if needed</small>
                </div>

                <div className="mb-6">
                  <label className="block mb-2 text-gray-700 font-medium text-sm">Gallon Mineral Water</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-semibold z-[2]">₱</span>
                    <input
                      type="number"
                      name="pricing_gallon_mineral"
                      value={formData.pricing_gallon_mineral}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border pl-10 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.pricing_gallon_mineral ? 'border-red-500' : 'border-slate-200'}`}
                    />
                  </div>
                  {errors.pricing_gallon_mineral && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.pricing_gallon_mineral}</span>
                  )}
                  <small className="block text-slate-400 text-xs mt-1 italic">Optional - set later if needed</small>
                </div>

                <div className="mb-6">
                  <label className="block mb-2 text-gray-700 font-medium text-sm">Delivery Fee (per delivery)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-semibold z-[2]">₱</span>
                    <input
                      type="number"
                      name="pricing_delivery_fee"
                      value={formData.pricing_delivery_fee}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border pl-10 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.pricing_delivery_fee ? 'border-red-500' : 'border-slate-200'}`}
                    />
                  </div>
                  {errors.pricing_delivery_fee && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.pricing_delivery_fee}</span>
                  )}
                  <small className="block text-slate-400 text-xs mt-1 italic">Optional - set later if needed</small>
                </div>
              </div>

              <div className="mt-8 p-3 bg-slate-100 rounded-md text-center text-slate-500 text-xs border border-dashed border-slate-300">
                <small>Note: You can update these prices anytime in your station settings dashboard.</small>
              </div>
            </div>
          )}

          {/* STEP 4: Business Permit */}
          {currentStep === 4 && (
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Business Permit Verification</h3>
              <p className="text-slate-500 text-sm mb-6 p-3 bg-slate-50 rounded-md border-l-4 border-amber-500">
                Upload a clear photo or scan of your valid business permit.
                This is required for approval to operate on our platform.
              </p>

              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Business Permit Number *</label>
                <input
                  type="text"
                  name="businessPermitNumber"
                  value={formData.businessPermitNumber}
                  onChange={handleInputChange}
                  placeholder="Enter your official permit number"
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.businessPermitNumber ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.businessPermitNumber && (
                  <span className="text-red-500 text-sm mt-1 block">{errors.businessPermitNumber}</span>
                )}
                <small className="block text-slate-400 text-xs mt-1 italic">
                  This should match the number on your business permit document
                </small>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Upload Business Permit *</label>
                <div className="mt-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".jpg,.jpeg,.png,.pdf"
                    style={{ display: 'none' }}
                  />

                  {!formData.permitFile ? (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer transition-all bg-slate-50 hover:border-primary hover:bg-primary/5" onClick={triggerFileInput}>
                      <div className="text-4xl mb-3 text-slate-500">📄</div>
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">Click to upload business permit</p>
                        <p className="text-slate-500 text-sm">
                          Supports JPG, PNG, or PDF (max 5MB)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-slate-200 rounded-lg p-4 bg-white">
                      {formData.permitFileUrl && formData.permitFile.type.startsWith('image/') ? (
                        <div className="flex items-center gap-4 mb-4">
                          <img src={formData.permitFileUrl} alt="Business permit preview" className="w-[100px] h-[100px] object-cover rounded border border-slate-200" />
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800 mb-1 break-all">{formData.permitFile.name}</p>
                            <p className="text-slate-500 text-sm mb-1">
                              {(formData.permitFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 mb-4">
                          <div className="text-4xl text-primary">📄</div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800 mb-1 break-all">{formData.permitFile.name}</p>
                            <p className="text-slate-500 text-sm mb-1">
                              {(formData.permitFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <p className="text-slate-500 text-xs bg-slate-100 px-2 py-0.5 rounded inline-block">PDF Document</p>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="bg-red-50 text-red-600 border border-red-200 rounded px-4 py-2 text-sm font-medium cursor-pointer transition-all hover:bg-red-200 block ml-auto"
                        onClick={removeFile}
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {errors.permitFile && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.permitFile}</span>
                  )}

                  {isUploading && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-md">
                      <div className="h-1.5 bg-slate-200 rounded overflow-hidden mb-2">
                        <div
                          className="h-full bg-secondary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-slate-500 text-center block">Processing... {uploadProgress}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 p-4 bg-surface rounded-lg border border-secondary/20">
                <h4 className="text-primary-dark mb-3 text-sm font-semibold">Requirements:</h4>
                <ul className="list-none p-0 m-0">
                  <li className="text-slate-500 text-xs py-1 pl-6 relative">Document must be valid and not expired</li>
                  <li className="text-slate-500 text-xs py-1 pl-6 relative">Clear photo/scan with all text readable</li>
                  <li className="text-slate-500 text-xs py-1 pl-6 relative">Permit number must match the one entered above</li>
                  <li className="text-slate-500 text-xs py-1 pl-6 relative">File must be less than 5MB</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 5: Account Setup */}
          {currentStep === 5 && (
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Account Setup</h3>

              {/* Two-column layout for password fields and rules */}
              <div className="flex flex-col gap-0">

                {/* LEFT SIDE: Password Fields */}
                <div className="flex flex-col">
                  <div className="mb-6">
                    <label className="block mb-2 text-gray-700 font-medium text-sm">Password *</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Minimum 6 characters"
                      className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.password ? 'border-red-500' : 'border-slate-200'}`}
                    />
                    {errors.password && <span className="text-red-500 text-sm mt-1 block">{errors.password}</span>}
                  </div>

                  <div className="mb-6">
                    <label className="block mb-2 text-gray-700 font-medium text-sm">Confirm Password *</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Confirm your password"
                      className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.confirmPassword ? 'border-red-500' : 'border-slate-200'}`}
                    />
                    {errors.confirmPassword && <span className="text-red-500 text-sm mt-1 block">{errors.confirmPassword}</span>}
                  </div>

                  <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="termsAccepted"
                        checked={formData.termsAccepted}
                        onChange={handleInputChange}
                        className="w-[18px] h-[18px] m-0"
                      />
                      <span>I agree to Terms & Conditions and Data Privacy Policy</span>
                    </label>
                    {errors.termsAccepted && <span className="text-red-500 text-sm mt-1 block">{errors.termsAccepted}</span>}
                  </div>
                </div>

                {/* RIGHT SIDE: Rejection Rules */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs mt-2">
                  <h4 className="text-slate-800 text-sm font-bold m-0 mb-1.5">📋 Application Requirements</h4>
                  <p className="text-slate-500 m-0 mb-4 text-[0.82rem] leading-relaxed">
                    Please ensure you meet ALL requirements before submitting:
                  </p>

                  <div className="mb-3 p-3 rounded-md bg-green-50 border border-green-200">
                    <h5 className="text-[0.82rem] font-bold m-0 mb-1.5">✅ Valid Documents Required:</h5>
                    <ul className="list-none p-0 m-0">
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">Current Business Permit (Mayor's Permit)</li>
                      {/*<li>FDA License to Operate (LTO)</li>*/}
                      {/*<li>Sanitation Permit from Health Office</li>*/}
                      {/*<li>Latest water quality test results</li>*/}
                      {/*<li>Clear, readable document scans</li>*/}
                    </ul>
                  </div>

                  <div className="mb-3 p-3 rounded-md bg-primary/5 border border-primary/20">
                    <h5 className="text-[0.82rem] font-bold m-0 mb-1.5">📍 Location Requirements:</h5>
                    <ul className="list-none p-0 m-0">
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">Valid commercial address</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">Properly zoned for water station</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">Accurate coordinates on map</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">No duplicate at same location</li>
                    </ul>
                  </div>

                  <div className="mb-3 p-3 rounded-md bg-secondary/5 border border-secondary/20">
                    <h5 className="text-[0.82rem] font-bold m-0 mb-1.5">📘 Legal Compliance:</h5>
                    <p className="text-slate-500 text-[0.8rem]">Your station must comply with:</p>
                    <ul className="list-none p-0 m-0 mt-1">
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">DOH Admin Order 2017-0010</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">Philippine National Standards (PNS)</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">Data Privacy Act (RA 10173)</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">Local sanitation codes</li>
                    </ul>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-md p-2.5 text-amber-800 text-[0.78rem] leading-relaxed mt-2">
                    <strong className="block mb-0.5">⚠️ Important:</strong> Providing false information or missing documents will result in immediate rejection. Please double-check everything before submitting.
                  </div>

                  <div className="mt-2 p-2.5 bg-slate-100 rounded-md text-[0.78rem] text-slate-600 leading-relaxed">
                    <p className="m-0">
                      <strong>Need Help?</strong><br />
                      Email: <a href="mailto:support@aquallera.com" className="text-primary font-semibold no-underline hover:underline">support@aquallera.com</a>
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 gap-4">
            {currentStep > 1 && (
              <button type="button" onClick={prevStep} className="bg-slate-500 text-white px-8 py-3 rounded-lg font-semibold cursor-pointer transition-all text-base min-w-[120px] hover:bg-slate-600 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed">
                Back
              </button>
            )}

            {currentStep < 5 ? (
              <button type="button" onClick={nextStep} className="bg-primary text-white px-8 py-3 rounded-lg font-semibold cursor-pointer transition-all text-base min-w-[120px] hover:bg-primary-dark hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed">
                Continue
              </button>
            ) : (
              <button type="submit" className="bg-primary text-white px-8 py-3 rounded-lg font-semibold cursor-pointer transition-all text-base min-w-[120px] hover:bg-primary-dark hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed" disabled={isUploading}>
                {isUploading ? 'Processing...' : 'Register'}
              </button>
            )}
          </div>
        </form>

        <div className="text-center pt-6 border-t border-slate-200">
          <p>Already have an account? <a href="/login" className="text-primary hover:underline font-medium">Login</a></p>
        </div>
      </div>

      {alertProps && <AlertCard {...alertProps} onClose={() => { closeAlert(); if (alertProps.type === 'success') { window.location.href = '/login'; } }} />}
    </div>
  );
};

export default Signup;