// src/components/Auth/Signup.js - WITH DELIVERY HOURS
import React, { useState, useRef, useEffect } from 'react';
import AlertCard, { useAlert } from '../admin/AlertCard';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set, get, query, orderByChild, equalTo } from 'firebase/database';
import { auth, database } from '../config/Firebase';
import { useNavigate } from 'react-router-dom';
import TimePickerWheel from '../dashboard/TimePickerWheel';

const convertTo12Hour = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

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
    city: 'Baguio',
    state: 'Benguet',
    zipCode: '2600',
    latitude: null,
    longitude: null,

    // Business Information
    businessHours: { open: '08:00', close: '18:00' },
    serviceTypes: [],
    deliveryRadius: 5,
    deliveryHours: [], // NEW: Array of delivery time slots
    deliveryDays: [], // NEW: Array of delivery days

    // PRICING VARIABLES
    pricing_gallon_pure: '',
    pricing_gallon_spring: '',
    pricing_gallon_mineral: '',
    pricing_delivery_fee: '',

    // Business Documents
    permitDocuments: {
      businessPermit:     { file: null, url: null },
      dtiSecRegistration: { file: null, url: null },
      sanitaryPermit:     { file: null, url: null },
      fdaLto:             { file: null, url: null },
      otherDocument:      { file: null, url: null, label: '' }
    },

    // Login Credentials
    password: '',
    confirmPassword: '',
    termsAccepted: false
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const currentSlotKeyRef = useRef(null);

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
    setErrors(prev => ({ ...prev, [name]: '' }));
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
    setErrors(prev => ({ ...prev, serviceTypes: '' }));
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

    if (formData.deliveryHours.includes(newDeliveryTime)) {
      setErrors(prev => ({ ...prev, deliveryHours: 'This delivery time already exists' }));
      return;
    }

    setErrors(prev => ({ ...prev, deliveryHours: '' }));
    setFormData(prev => ({
      ...prev,
      deliveryHours: [...prev.deliveryHours, newDeliveryTime].sort()
    }));

    setNewDeliveryTime('09:00');
  };

  const removeDeliveryHour = (timeToRemove) => {
    setFormData(prev => ({
      ...prev,
      deliveryHours: prev.deliveryHours.filter(time => time !== timeToRemove)
    }));
  };

  const toggleDeliveryDay = (day) => {
    setErrors(prev => ({ ...prev, deliveryDays: '' }));
    setFormData(prev => {
      const current = [...(prev.deliveryDays || [])];
      if (current.includes(day)) {
        return { ...prev, deliveryDays: current.filter(d => d !== day) };
      } else {
        return { ...prev, deliveryDays: [...current, day] };
      }
    });
  };

  const DOCUMENT_LABELS = {
    businessPermit:     'Business Permit (Mayor\'s Permit)',
    dtiSecRegistration: 'DTI / SEC Registration',
    sanitaryPermit:     'Sanitary Permit (DOH)',
    fdaLto:             'FDA License to Operate (LTO)',
    otherDocument:      'Other Document'
  };

  const DOCUMENT_REQUIRED = {
    businessPermit:     true,
    dtiSecRegistration: true,
    sanitaryPermit:     true,
    fdaLto:             true,
    otherDocument:      false
  };

  const handleDocumentSelect = (slotKey) => {
    currentSlotKeyRef.current = slotKey;
    fileInputRef.current.click();
  };

  const processSelectedFile = (e) => {
    const file = e.target.files[0];
    const slotKey = currentSlotKeyRef.current;
    if (!file || !slotKey) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, [slotKey]: 'Only JPG, PNG, or PDF files allowed' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [slotKey]: 'File size must be less than 5MB' }));
      return;
    }

    setErrors(prev => ({ ...prev, [slotKey]: '' }));

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => {
          const docs = { ...prev.permitDocuments };
          docs[slotKey] = { ...docs[slotKey], file, url: reader.result };
          return { ...prev, permitDocuments: docs };
        });
      };
      reader.readAsDataURL(file);
    } else {
      setFormData(prev => {
        const docs = { ...prev.permitDocuments };
        docs[slotKey] = { ...docs[slotKey], file, url: null };
        return { ...prev, permitDocuments: docs };
      });
    }

    e.target.value = '';
  };

  const removeDocument = (slotKey) => {
    setFormData(prev => {
      const docs = { ...prev.permitDocuments };
      docs[slotKey] = { ...docs[slotKey], file: null, url: null };
      if (slotKey === 'otherDocument') docs[slotKey].label = '';
      return { ...prev, permitDocuments: docs };
    });
    setErrors(prev => ({ ...prev, [slotKey]: '' }));
  };

  const handleOtherLabelChange = (value) => {
    setFormData(prev => {
      const docs = { ...prev.permitDocuments };
      docs.otherDocument = { ...docs.otherDocument, label: value };
      return { ...prev, permitDocuments: docs };
    });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const defaultCenter = [120.5960, 16.4023];

      const center = formData.latitude && formData.longitude
        ? [formData.longitude, formData.latitude]
        : defaultCenter;

      const mapInstance = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: formData.latitude ? 15 : 13
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

        let address = place.text || place.place_name.split(',')[0];

        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(lat.toFixed(8)),
          longitude: parseFloat(lng.toFixed(8)),
          address: address
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

  // ========== INLINE FIELD VALIDATION ==========
  const validateField = (name, value) => {
    switch (name) {
      case 'stationName':
        return value.trim() ? '' : 'Station name required';
      case 'ownerName':
        return value.trim() ? '' : 'Owner name required';
      case 'email':
        if (!value.trim()) return 'Email required';
        return /\S+@\S+\.\S+/.test(value) ? '' : 'Invalid email format';
      case 'phone':
        return value.trim() ? '' : 'Phone number required';
      case 'address':
        return value.trim() ? '' : 'Address required';
      case 'password':
        if (!value) return 'Password required';
        if (value.length < 6) return 'At least 6 characters';
        if (!/[A-Z]/.test(value)) return 'Needs an uppercase letter';
        if (!/[a-z]/.test(value)) return 'Needs a lowercase letter';
        if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) return 'Needs a special character (e.g. @)';
        return '';
      case 'confirmPassword':
        return value === formData.password ? '' : 'Passwords do not match';
      case 'termsAccepted':
        return value ? '' : 'You must accept the terms';
      default:
        return '';
    }
  };

  const handleBlur = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    const error = validateField(name, val);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  // ========== STEP VALIDATION ==========
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
    }

    if (step === 3) {
      if (formData.serviceTypes.length === 0) {
        newErrors.serviceTypes = 'Select at least one service type';
      }
      if (formData.serviceTypes.includes('delivery') && formData.deliveryHours.length === 0) {
        newErrors.deliveryHours = 'Add at least one delivery time slot';
      }
      if (formData.serviceTypes.includes('delivery') && formData.deliveryDays.length === 0) {
        newErrors.deliveryDays = 'Select at least one delivery day';
      }
    }

    if (step === 4) {
      // Pricing is optional
    }

    if (step === 5) {
      if (!formData.permitDocuments.businessPermit.file) {
        newErrors.businessPermit = 'Business Permit is required';
      }
      if (!formData.permitDocuments.dtiSecRegistration.file) {
        newErrors.dtiSecRegistration = 'DTI/SEC Registration is required';
      }
      if (!formData.permitDocuments.sanitaryPermit.file) {
        newErrors.sanitaryPermit = 'Sanitary Permit is required';
      }
      if (!formData.permitDocuments.fdaLto.file) {
        newErrors.fdaLto = 'FDA License to Operate is required';
      }
    }

    if (step === 6) {
      if (!formData.password) {
        newErrors.password = 'Password required';
      } else {
        if (formData.password.length < 6) newErrors.password = 'At least 6 characters';
        else if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Needs an uppercase letter';
        else if (!/[a-z]/.test(formData.password)) newErrors.password = 'Needs a lowercase letter';
        else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password)) newErrors.password = 'Needs a special character (e.g. @)';
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

    if (!validateStep(6)) return;

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

      const businessPermitDocuments = {};
      for (const [key, slot] of Object.entries(formData.permitDocuments)) {
        if (slot.file) {
          businessPermitDocuments[key] = {
            base64: await compressImage(slot.file),
            filename: slot.file.name,
            fileType: slot.file.type,
            fileSize: slot.file.size,
            ...(key === 'otherDocument' && slot.label ? { label: slot.label } : {})
          };
        }
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
        deliveryDays: formData.deliveryDays,
        pricing_gallon_pure: formData.pricing_gallon_pure ? parseFloat(formData.pricing_gallon_pure) : null,
        pricing_gallon_spring: formData.pricing_gallon_spring ? parseFloat(formData.pricing_gallon_spring) : null,
        pricing_gallon_mineral: formData.pricing_gallon_mineral ? parseFloat(formData.pricing_gallon_mineral) : null,
        pricing_delivery_fee: formData.pricing_delivery_fee ? parseFloat(formData.pricing_delivery_fee) : null,
        businessPermitDocuments: businessPermitDocuments,
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
          errorMessage += 'An unexpected error occurred. Please try again.';
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
        {/* BACK TO HOME BUTTON */}
        <button
          type="button"
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors mb-3"
          onClick={() => navigate('/')}
          title="Back to Home"
        >
          <img src="/back.svg" alt="Back to Home" className="w-5 h-5 sm:w-6 sm:h-6 select-none" draggable={false} />
        </button>
        <div className="text-center mb-8">
          <h2 className="text-slate-800 text-3xl mb-2">Register Your Water Station</h2>
          <p className="text-slate-500 text-sm m-0">Join the AQUA-LLERA network</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between gap-1 mb-8 relative">
          {[1, 2, 3, 4, 5, 6].map(step => (
            <div
              key={step}
              className={`flex flex-col items-center relative z-[2] flex-1 ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 border-[3px] border-white transition-all duration-300 ${currentStep > step ? 'bg-secondary text-white border-secondary' : currentStep >= step ? 'bg-primary text-white border-primary' : 'bg-slate-200 text-slate-500'}`}>{step}</div>
              <div className={`text-[11px] leading-tight text-slate-500 font-medium text-center ${currentStep >= step ? 'text-primary font-semibold' : ''}`}>
                {step === 1 && 'Basic Info'}
                {step === 2 && 'Location'}
                {step === 3 && 'Services'}
                {step === 4 && 'Pricing'}
                {step === 5 && 'Documents'}
                {step === 6 && 'Password'}
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
                  onBlur={handleBlur}
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
                  onBlur={handleBlur}
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
                  onBlur={handleBlur}
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
                  onBlur={handleBlur}
                  placeholder="09XXXXXXXXX"
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.phone ? 'border-red-500' : 'border-slate-200'}`}
                />
                {errors.phone && <span className="text-red-500 text-sm mt-1 block">{errors.phone}</span>}
              </div>
            </div>
          )}

          {/* STEP 2: Location */}
          {currentStep === 2 && (
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Station Location</h3>
              <p className="bg-amber-50 border-l-4 border-l-amber-500 p-3 mb-6 rounded text-sm text-amber-600 leading-relaxed">
                Use the map below to pinpoint your exact station location.
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
                          &times;
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
                          <div className="text-xl mr-3 text-slate-500 flex-shrink-0"></div>
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
                    <li className="mb-1.5 text-slate-500 text-xs relative pl-2">Search for your address in the box above</li>
                    <li className="mb-1.5 text-slate-500 text-xs relative pl-2">Click anywhere on the map to move the pin</li>
                    <li className="mb-1.5 text-slate-500 text-xs relative pl-2">Drag the blue pin to fine-tune your exact location</li>
                  </ul>
                </div>

                {locationStatus && (
                  <div className="mt-2 p-2 rounded text-sm text-center bg-slate-50 text-slate-500">
                    {locationStatus}

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
                  onBlur={handleBlur}
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
                    readOnly
                    className="w-full px-4 py-3 border-2 rounded-lg text-base font-sans box-border bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                  />
                </div>

                <div className="mb-6">
                  <label className="block mb-2 text-gray-700 font-medium text-sm">State *</label>
                    <input
                    type="text"
                    name="state"
                    value={formData.state}
                    readOnly
                    className="w-full px-4 py-3 border-2 rounded-lg text-base font-sans box-border bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">ZIP Code *</label>
                  <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  readOnly
                  className="w-full px-4 py-3 border-2 rounded-lg text-base font-sans box-border bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Services */}
          {currentStep === 3 && (
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Services Offered</h3>

              {/* SERVICE TYPES */}
              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Services Offered *</label>
                <div className="flex gap-3 mt-2">
                  {['delivery', 'pickup'].map(type => {
                    const selected = formData.serviceTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleServiceTypeChange(type)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border-2 cursor-pointer transition-all flex-1 justify-center ${
                          selected
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
                        }`}
                      >
                        {selected ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        )}
                        {type === 'delivery' ? 'Delivery' : 'Pickup'}
                      </button>
                    );
                  })}
                </div>
                {errors.serviceTypes && <span className="text-red-500 text-sm mt-1 block">{errors.serviceTypes}</span>}
              </div>

              {/* BUSINESS HOURS */}
              <div className="mb-6">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Business Hours</label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Open</label>
                    <TimePickerWheel
                      value={formData.businessHours.open}
                      onChange={(time) => handleBusinessHoursChange('open', time)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Close</label>
                    <TimePickerWheel
                      value={formData.businessHours.close}
                      onChange={(time) => handleBusinessHoursChange('close', time)}
                    />
                  </div>
                </div>
              </div>

              {/* DELIVERY SECTION */}
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

                    <div className="flex gap-2 mb-4">
                      <div className="flex-1 min-w-0">
                        <TimePickerWheel
                          value={newDeliveryTime}
                          onChange={setNewDeliveryTime}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addDeliveryHour}
                        className="mt-2 bg-secondary text-white border-none rounded-lg px-6 py-3 font-semibold cursor-pointer transition-all whitespace-nowrap text-sm hover:bg-primary-dark hover:-translate-y-0.5 flex-shrink-0"
                      >
                        + Add Time
                      </button>
                    </div>

                    {errors.deliveryHours && (
                      <span className="text-red-500 text-sm mt-1 block">{errors.deliveryHours}</span>
                    )}

                    {formData.deliveryHours.length > 0 && (
                      <div className="flex flex-col gap-2 mt-3">
                        {formData.deliveryHours.map((time, index) => (
                          <div key={index} className="flex items-center bg-surface border border-secondary/20 rounded-md px-4 py-3 transition-all hover:bg-secondary/10">
                            <svg className="w-4 h-4 mr-3 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="flex-1 font-semibold text-slate-700 text-base">{convertTo12Hour(time)}</span>
                            <button
                              type="button"
                              onClick={() => removeDeliveryHour(time)}
                              className="bg-red-50 text-red-600 border border-red-200 rounded w-7 h-7 flex items-center justify-center cursor-pointer transition-all text-base font-semibold flex-shrink-0 hover:bg-red-600 hover:text-white"
                              title="Remove this delivery time"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {formData.deliveryHours.length === 0 && (
                      <div className="flex flex-col items-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300 mt-3">
                        <svg className="w-10 h-10 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm">No delivery times added yet</span>
                      </div>
                    )}
                  </div>

                  {/* DELIVERY DAYS */}
                  <div className="mb-6">
                    <label className="block mb-2 text-gray-700 font-medium text-sm">
                      <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Delivery Days *
                    </label>
                    <p className="block text-slate-400 text-xs mt-1 italic" style={{ marginBottom: '0.75rem' }}>
                      Select the days you deliver water
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => {
                        const selected = (formData.deliveryDays || []).includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDeliveryDay(day)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all ${
                              selected
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
                            }`}
                          >
                            {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                          </button>
                        );
                      })}
                    </div>
                    {formData.serviceTypes.includes('delivery') && formData.deliveryDays.length === 0 && (
                      <span className="text-red-500 text-xs mt-1 block">{errors.deliveryDays}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 4: Pricing */}
          {currentStep === 4 && (
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
                  <label className="block mb-2 text-gray-700 font-medium text-sm">Gallon Spring Water</label>
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

              <div className="mt-8 p-3 rounded-md text-center text-xs" style={{ background: '#1B3B6F', color: '#e2e8f0' }}>
                <small>Note: You can update these prices anytime in your station settings dashboard.</small>
              </div>
            </div>
          )}

          {/* STEP 5: Permit */}
          {currentStep === 5 && (
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Business Documents</h3>
              <p className="text-slate-500 text-sm mb-6 p-3 bg-slate-50 rounded-md border-l-4 border-amber-500">
                Upload clear photos or scans of your required business documents.
                These are required for approval to operate on our platform.
              </p>

              <input
                type="file"
                ref={fileInputRef}
                onChange={processSelectedFile}
                accept=".jpg,.jpeg,.png,.pdf"
                style={{ display: 'none' }}
              />

              {Object.entries(DOCUMENT_LABELS).map(([slotKey, label]) => {
                const slot = formData.permitDocuments[slotKey];
                const isRequired = DOCUMENT_REQUIRED[slotKey];
                const hasFile = slot && slot.file;
                const error = errors[slotKey];

                return (
                  <div key={slotKey} className="mb-5 p-4 border border-slate-200 rounded-lg bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-gray-700 font-medium text-sm">
                        {label}
                        {isRequired && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {slotKey === 'otherDocument' && (
                        <span className="text-xs text-slate-400">Optional</span>
                      )}
                    </div>

                    {slotKey === 'otherDocument' && (
                      <input
                        type="text"
                        value={slot.label || ''}
                        onChange={(e) => handleOtherLabelChange(e.target.value)}
                        placeholder="Specify document type (e.g., Water Potability, CWO Cert)"
                        className="w-full px-3 py-2 mb-3 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)]"
                      />
                    )}

                    {!hasFile ? (
                      <div
                        className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center cursor-pointer transition-all bg-slate-50 hover:border-primary hover:bg-primary/5"
                        onClick={() => handleDocumentSelect(slotKey)}
                      >
                        <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="font-semibold text-slate-700 text-sm mb-1">Click to upload</p>
                        <p className="text-slate-400 text-xs">JPG, PNG, or PDF (max 5MB)</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-lg p-3 bg-white">
                        {slot.url && slot.file.type.startsWith('image/') ? (
                          <div className="flex items-center gap-3">
                            <img src={slot.url} alt={label} className="w-16 h-16 object-cover rounded border border-slate-200" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm truncate">{slot.file.name}</p>
                              <p className="text-slate-500 text-xs">{(slot.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-14 bg-red-50 rounded flex items-center justify-center text-red-500 text-xs font-bold shrink-0">PDF</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm truncate">{slot.file.name}</p>
                              <p className="text-slate-500 text-xs">PDF Document &middot; {(slot.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          className="mt-2 bg-red-50 text-red-600 border border-red-200 rounded px-3 py-1.5 text-xs font-medium cursor-pointer transition-all hover:bg-red-200"
                          onClick={() => removeDocument(slotKey)}
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {error && <span className="text-red-500 text-xs mt-1 block">{error}</span>}
                  </div>
                );
              })}

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
          )}

          {/* STEP 6: Account Setup */}
          {currentStep === 6 && (
            <div>
              <h3 className="text-slate-800 mb-6 text-xl border-b-2 border-slate-100 pb-2">Account Setup</h3>

              {/* Two-column layout for password fields and rules */}
              <div className="flex flex-col gap-0">

                {/* LEFT SIDE: Password Fields */}
                <div className="flex flex-col">
                  <div className="mb-6">
                    <label className="block mb-2 text-gray-700 font-medium text-sm">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        placeholder="Minimum 6 characters"
                        className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.password ? 'border-red-500' : 'border-slate-200'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 text-slate-400 hover:text-primary transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                    {errors.password && <span className="text-red-500 text-sm mt-1 block">{errors.password}</span>}
                    {formData.password && (
                      <div className="mt-1.5 space-y-0.5">
                        {[
                          { met: formData.password.length >= 6, label: 'At least 6 characters' },
                          { met: /[A-Z]/.test(formData.password), label: 'At least one uppercase letter' },
                          { met: /[a-z]/.test(formData.password), label: 'At least one lowercase letter' },
                          { met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password), label: 'At least one special character (e.g. @)' },
                        ].map((rule, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={rule.met ? 'text-green-600' : 'text-slate-400'}>
                              {rule.met ? '✓' : '○'}
                            </span>
                            <span className={`text-xs ${rule.met ? 'text-green-600' : 'text-slate-500'}`}>
                              {rule.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-6">
                    <label className="block mb-2 text-gray-700 font-medium text-sm">Confirm Password *</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        placeholder="Confirm your password"
                        className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all font-sans box-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${errors.confirmPassword ? 'border-red-500' : 'border-slate-200'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 text-slate-400 hover:text-primary transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && <span className="text-red-500 text-sm mt-1 block">{errors.confirmPassword}</span>}
                    {formData.confirmPassword && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={formData.password === formData.confirmPassword ? 'text-green-600' : 'text-slate-400'}>
                          {formData.password === formData.confirmPassword ? '✓' : '○'}
                        </span>
                        <span className={`text-xs ${formData.password === formData.confirmPassword ? 'text-green-600' : 'text-slate-500'}`}>
                          Passwords match
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="termsAccepted"
                        checked={formData.termsAccepted}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        className="w-[18px] h-[18px] m-0"
                      />
                      <span>I agree to Terms & Conditions and Data Privacy Policy</span>
                    </label>
                    {errors.termsAccepted && <span className="text-red-500 text-sm mt-1 block">{errors.termsAccepted}</span>}
                  </div>
                </div>

                {/* RIGHT SIDE: Rejection Rules */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs mt-2">
                  <h4 className="text-slate-800 text-sm font-bold m-0 mb-1.5">Application Requirements</h4>
                  <p className="text-slate-500 m-0 mb-4 text-[0.82rem] leading-relaxed">
                    Please ensure you meet ALL requirements before submitting:
                  </p>

                  <div className="mb-3 p-3 rounded-md bg-green-50 border border-green-200">
                    <h5 className="text-[0.82rem] font-bold m-0 mb-1.5">Valid Documents Required:</h5>
                    <ul className="list-none p-0 m-0">
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed">Current Business Permit (Mayor's Permit)</li>
                      {/*<li>FDA License to Operate (LTO)</li>*/}
                      {/*<li>Sanitation Permit from Health Office</li>*/}
                      {/*<li>Latest water quality test results</li>*/}
                      {/*<li>Clear, readable document scans</li>*/}
                    </ul>
                  </div>

                  <div className="mb-3 p-3 rounded-md bg-primary/5 border border-primary/20">
                    <h5 className="text-[0.82rem] font-bold m-0 mb-1.5 text-slate-600">Location Requirements:</h5>
                    <ul className="list-none p-0 m-0">
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed text-slate-500">Valid commercial address</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed text-slate-500">Properly zoned for water station</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed text-slate-500">Accurate coordinates on map</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed text-slate-500">No duplicate at same location</li>
                    </ul>
                  </div>

                  <div className="mb-3 p-3 rounded-md bg-secondary/5 border border-secondary/20">
                    <h5 className="text-[0.82rem] font-bold m-0 mb-1.5 text-slate-600">Legal Compliance:</h5>
                    <p className="text-slate-500 text-[0.8rem]">Your station must comply with:</p>
                    <ul className="list-none p-0 m-0 mt-1">
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed text-slate-500">DOH Admin Order 2017-0010</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed text-slate-500">Philippine National Standards (PNS)</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed text-slate-500">Data Privacy Act (RA 10173)</li>
                      <li className="text-[0.8rem] py-0.5 pl-5 relative leading-relaxed text-slate-500">Local sanitation codes</li>
                    </ul>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-md p-2.5 text-amber-600 text-[0.78rem] leading-relaxed mt-2">
                    <strong className="block mb-0.5">Important:</strong> Providing false information or missing documents will result in immediate rejection. Please double-check everything before submitting.
                  </div>

                  <div className="mt-2 p-2.5 bg-slate-100 rounded-md text-[0.78rem] text-slate-600 leading-relaxed">
                    <p className="m-0">
                      <strong>Need Help?</strong><br />
                      Email: <a href="mailto:aquallera.main@gmail.com" className="text-primary font-semibold no-underline hover:underline">aquallera.main@gmail.com</a>
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

            {currentStep < 6 ? (
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