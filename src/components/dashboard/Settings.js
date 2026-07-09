import React, { useState, useEffect } from 'react';
import { ref, update } from 'firebase/database';
import { database, auth } from '../config/Firebase';
import TimePickerWheel from './TimePickerWheel';

const convertTo12Hour = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

const Settings = ({ stationData, setStationData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [actualLocation, setActualLocation] = useState('');

  // NEW: Delivery hours state
  const [newDeliveryTime, setNewDeliveryTime] = useState('09:00');

  // Initialize form data
  useEffect(() => {
    if (stationData) {
      setFormData(stationData);
      setOriginalData(stationData);
      if (stationData.latitude && stationData.longitude) {
        convertCoordinatesToAddress(stationData.latitude, stationData.longitude);
      }
    } else {
      const defaultData = {
        stationName: 'My Water Station',
        ownerName: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        latitude: '',
        longitude: '',
        businessHours: {
          open: '08:00',
          close: '18:00'
        },
        serviceTypes: ['pickup'],
        deliveryRadius: 5,
        deliveryHours: [],
        deliveryDays: [],
        pricing_gallon_pure: null,
        pricing_gallon_spring: null,
        pricing_gallon_mineral: null,
        pricing_delivery_fee: null,
        isOnline: false
      };
      setFormData(defaultData);
      setOriginalData(defaultData);
    }
  }, [stationData]);

  // Convert coordinates to actual address
  const convertCoordinatesToAddress = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      
      if (!response.ok) throw new Error('Failed to fetch location');
      
      const data = await response.json();
      
      if (data && data.display_name) {
        setActualLocation(data.display_name);
      } else {
        setActualLocation('Location details not available');
      }
    } catch (error) {
      console.error('Error converting coordinates:', error);
      setActualLocation('Unable to determine location');
    }
  };

  // Get Current Location Function
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by this browser.');
      return;
    }

    setIsGettingLocation(true);
    setLocationStatus('Getting your location...');
    setActualLocation('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(latitude.toFixed(8)),
          longitude: parseFloat(longitude.toFixed(8))
        }));

        await convertCoordinatesToAddress(latitude, longitude);
        
        setLocationStatus('Location captured successfully!');
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Failed to get location: ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please allow location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out.';
            break;
          default:
            errorMessage += 'An unknown error occurred.';
            break;
        }
        setLocationStatus(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('businessHours.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        businessHours: {
          ...prev.businessHours,
          [field]: value
        }
      }));
    } else if (name === 'serviceTypes') {
      const serviceType = value;
      setFormData(prev => {
        const currentTypes = [...(prev.serviceTypes || [])];
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
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // NEW: Delivery Hours Handlers
  const addDeliveryHour = () => {
    if (!newDeliveryTime) return;
    
    const currentHours = formData.deliveryHours || [];
    
    if (currentHours.includes(newDeliveryTime)) {
      setMessage('This delivery time already exists');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      deliveryHours: [...currentHours, newDeliveryTime].sort()
    }));
    
    setNewDeliveryTime('09:00');
  };

  const removeDeliveryHour = (timeToRemove) => {
    setFormData(prev => ({
      ...prev,
      deliveryHours: (prev.deliveryHours || []).filter(time => time !== timeToRemove)
    }));
  };

  const toggleDeliveryDay = (day) => {
    setFormData(prev => {
      const current = [...(prev.deliveryDays || [])];
      if (current.includes(day)) {
        return { ...prev, deliveryDays: current.filter(d => d !== day) };
      } else {
        return { ...prev, deliveryDays: [...current, day] };
      }
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      const stationRef = ref(database, 'waterStations/' + user.uid);
      
      const updates = {};
      let hasChanges = false;
      
      const normalizeValue = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          return trimmed === '' ? null : trimmed;
        }
        if (typeof value === 'number') return value;
        if (Array.isArray(value)) return [...value].sort();
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      };
      
      const hasChanged = (key, newValue, oldValue) => {
        const normalizedNew = normalizeValue(newValue);
        const normalizedOld = normalizeValue(oldValue);
        
        if (Array.isArray(newValue) && Array.isArray(oldValue)) {
          return JSON.stringify([...newValue].sort()) !== JSON.stringify([...oldValue].sort());
        }
        
        if (typeof newValue === 'object' && typeof oldValue === 'object' && 
            !Array.isArray(newValue) && !Array.isArray(oldValue)) {
          return JSON.stringify(newValue) !== JSON.stringify(oldValue);
        }
        
        if (key === 'latitude' || key === 'longitude') {
          const numNew = parseFloat(newValue) || 0;
          const numOld = parseFloat(oldValue) || 0;
          return numNew !== numOld;
        }
        
        if ((newValue === '' && oldValue === null) || (newValue === null && oldValue === '')) {
          return true;
        }
        
        return normalizedNew !== normalizedOld;
      };
      
      Object.keys(formData).forEach(key => {
        if (key === 'isOnline' && !originalData?.hasOwnProperty(key)) return;
        
        const newValue = formData[key];
        const oldValue = originalData ? originalData[key] : undefined;
        
        if (hasChanged(key, newValue, oldValue)) {
          if ((key === 'latitude' || key === 'longitude') && newValue) {
            updates[key] = parseFloat(newValue);
          } 
          else if (key.startsWith('pricing_')) {
            updates[key] = newValue === '' || newValue === null ? null : parseFloat(newValue);
          }
          else if (key === 'deliveryRadius') {
            updates[key] = parseInt(newValue) || 5;
          }
          else if (key === 'serviceTypes' || key === 'deliveryHours' || key === 'deliveryDays') {
            updates[key] = Array.isArray(newValue) ? newValue : [];
          }
          else {
            updates[key] = newValue;
          }
          hasChanges = true;
        }
      });
      
      updates.updatedAt = new Date().toISOString();
      
      console.log('Fields to update:', updates);
      
      if (hasChanges) {
        await update(stationRef, updates);
        
        if (setStationData) {
          setStationData(prev => ({ ...prev, ...updates }));
        }
        
        setOriginalData(prev => ({ 
          ...prev, 
          ...updates,
          latitude: updates.latitude !== undefined ? updates.latitude : prev?.latitude,
          longitude: updates.longitude !== undefined ? updates.longitude : prev?.longitude
        }));
        
        setMessage('Settings updated successfully!');
        setIsEditing(false);
        
        if (updates.latitude || updates.longitude) {
          const lat = updates.latitude || formData.latitude;
          const lng = updates.longitude || formData.longitude;
          convertCoordinatesToAddress(lat, lng);
        }
      } else {
        setMessage('No changes detected');
      }
      
    } catch (error) {
      console.error('Save error:', error);
      setMessage('Error updating settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!formData) {
    return (
      <section className="p-8 max-w-[1200px] mx-auto">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 text-lg">Loading station data...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="p-4 sm:p-8 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-center mb-8 pb-4 border-b-2 border-slate-200 flex-wrap gap-3">
        <h2 className="text-white text-2xl md:text-3xl font-bold m-0">Station Settings</h2>
        <div className="settings-actions">
          {!isEditing ? (
            <button 
              className="bg-primary text-white px-6 py-3 rounded-lg font-semibold cursor-pointer transition-all flex items-center gap-2 hover:bg-primary-dark hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={() => setIsEditing(true)}
            >
              Edit Settings
            </button>
          ) : (
            <div className="flex gap-3 sm:gap-4 items-center flex-wrap">
              <button 
                className="bg-slate-500 text-white px-6 py-3 rounded-lg font-semibold cursor-pointer transition-all hover:bg-slate-600 disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={() => {
                  setIsEditing(false);
                  setFormData(originalData || stationData || formData);
                  if (originalData?.latitude && originalData?.longitude) {
                    convertCoordinatesToAddress(originalData.latitude, originalData.longitude);
                  }
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="bg-primary text-white px-6 py-3 rounded-lg font-semibold cursor-pointer transition-all flex items-center gap-2 hover:bg-primary-dark hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 font-medium text-center ${message.includes('Error') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <h3 className="text-slate-800 text-xl font-semibold m-0 mb-6 pb-3 border-b-2 border-slate-100">Basic Information</h3>
          <div className="mb-5">
            <label className="block mb-2 text-gray-700 font-medium text-sm">Station Name</label>
            <input
              type="text"
              name="stationName"
              value={formData.stationName || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter station name"
              className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
          <div className="mb-5">
            <label className="block mb-2 text-gray-700 font-medium text-sm">Owner Name</label>
            <input
              type="text"
              name="ownerName"
              value={formData.ownerName || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter owner name"
              className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
          <div className="mb-5">
            <label className="block mb-2 text-gray-700 font-medium text-sm">Contact Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter phone number"
              className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
          <div className="mb-5">
            <label className="block mb-2 text-gray-700 font-medium text-sm">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter email address"
              className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Location Information */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <h3 className="text-slate-800 text-xl font-semibold m-0 mb-6 pb-3 border-b-2 border-slate-100">Location</h3>
          <div className="mb-5">
            <label className="block mb-2 text-gray-700 font-medium text-sm">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter street address"
              className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="mb-5">
              <label className="block mb-2 text-gray-700 font-medium text-sm">City</label>
              <input
                type="text"
                name="city"
                value={formData.city || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="City"
                className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
            <div className="mb-5">
              <label className="block mb-2 text-gray-700 font-medium text-sm">State</label>
              <input
                type="text"
                name="state"
                value={formData.state || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="State"
                className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div className="mb-5">
            <label className="block mb-2 text-gray-700 font-medium text-sm">ZIP Code</label>
            <input
              type="text"
              name="zipCode"
              value={formData.zipCode || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="ZIP code"
              className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
          
          {/* Coordinates Display */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <label className="block mb-4 text-gray-700 font-medium text-sm">Station Coordinates</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-200 last:border-b-0">
                <span className="text-slate-500 text-xs font-medium">Latitude</span>
                <span className="text-slate-800 text-xs font-semibold font-mono">
                  {formData.latitude ? 
                    typeof formData.latitude === 'number' ? 
                      formData.latitude.toFixed(6) : 
                      formData.latitude 
                    : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-200 last:border-b-0">
                <span className="text-slate-500 text-xs font-medium">Longitude</span>
                <span className="text-slate-800 text-xs font-semibold font-mono">
                  {formData.longitude ? 
                    typeof formData.longitude === 'number' ? 
                      formData.longitude.toFixed(6) : 
                      formData.longitude 
                    : 'Not set'}
                </span>
              </div>
              
              {(formData.latitude && formData.longitude) && (
                <div className="flex flex-col gap-2 p-4 bg-surface rounded-md border border-secondary/20 mt-3">
                  <span className="text-primary-dark text-sm font-semibold flex items-center gap-2">Actual Location:</span>
                  <span className="text-slate-800 text-xs leading-relaxed italic">{actualLocation || 'Loading location details...'}</span>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-200">
                <button 
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation || !isEditing}
                  className={`w-full py-3 px-4 bg-primary text-white border-none rounded-lg font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 text-base hover:bg-primary-dark hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed ${isGettingLocation ? 'loading' : ''}`}
                >
                  {isGettingLocation ? (
                    <>
                      <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin"></div>
                      Getting Location...
                    </>
                  ) : (
                    'Get Current Location'
                  )}
                </button>
                
                {locationStatus && (
                  <div className={`mt-2 p-3 rounded-md text-sm text-center font-medium ${locationStatus.includes('successfully') ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {locationStatus}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <h3 className="text-slate-800 text-xl font-semibold m-0 mb-6 pb-3 border-b-2 border-slate-100">Business Hours</h3>
          <div className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Opening Time</label>
                <TimePickerWheel
                  value={formData.businessHours?.open || '08:00'}
                  onChange={(time) => {
                    setFormData(prev => ({
                      ...prev,
                      businessHours: { ...prev.businessHours, open: time }
                    }));
                  }}
                  disabled={!isEditing}
                />
              </div>
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Closing Time</label>
                <TimePickerWheel
                  value={formData.businessHours?.close || '18:00'}
                  onChange={(time) => {
                    setFormData(prev => ({
                      ...prev,
                      businessHours: { ...prev.businessHours, close: time }
                    }));
                  }}
                  disabled={!isEditing}
                />
              </div>
            </div>
            <div className="mt-4 p-4 bg-secondary/5 border border-secondary/20 rounded-lg text-center text-primary-dark font-medium">
              <span>Current Hours: </span>
              <strong>{convertTo12Hour(formData.businessHours?.open || '08:00')} - {convertTo12Hour(formData.businessHours?.close || '18:00')}</strong>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <h3 className="text-slate-800 text-xl font-semibold m-0 mb-6 pb-3 border-b-2 border-slate-100">Services</h3>
          <div className="mb-6">
            <label>Available Services</label>
            <div className="flex flex-col gap-4 mt-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 border-2 border-slate-200 rounded-lg transition-all hover:border-primary hover:bg-primary/5">
                <input
                  type="checkbox"
                  name="serviceTypes"
                  value="delivery"
                  checked={(formData.serviceTypes || []).includes('delivery')}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-[18px] h-[18px] cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="font-medium text-gray-700">Delivery Service</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border-2 border-slate-200 rounded-lg transition-all hover:border-primary hover:bg-primary/5">
                <input
                  type="checkbox"
                  name="serviceTypes"
                  value="pickup"
                  checked={(formData.serviceTypes || []).includes('pickup')}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-[18px] h-[18px] cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="font-medium text-gray-700">Pickup Service</span>
              </label>
            </div>
          </div>

          {(formData.serviceTypes || []).includes('delivery') && (
            <>
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-medium text-sm">Delivery Radius (km)</label>
                <select 
                  name="deliveryRadius" 
                  value={formData.deliveryRadius || 5}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="15">15 km</option>
                  <option value="20">20 km</option>
                </select>
              </div>

              {/* Delivery Hours Section */}
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-medium text-sm">
                  <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Delivery Hours
                </label>
                <p className="text-xs text-slate-400 italic mb-3">
                  Times when you deliver water to customers
                </p>

                {isEditing && (
                  <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start">
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
                )}

                {(formData.deliveryHours || []).length > 0 ? (
                  <div className="flex flex-col gap-2 mt-3">
                    {formData.deliveryHours.map((time, index) => (
                      <div key={index} className="flex items-center bg-surface border border-secondary/20 rounded-lg px-4 py-3 transition-all hover:bg-secondary/10">
                        <svg className="w-4 h-4 mr-3 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="flex-1 font-semibold text-slate-800 text-sm">{convertTo12Hour(time)}</span>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => removeDeliveryHour(time)}
                            className="bg-red-50 text-red-600 border border-red-200 rounded w-7 h-7 flex items-center justify-center cursor-pointer transition-all text-base font-semibold flex-shrink-0 hover:bg-red-600 hover:text-white"
                            title="Remove this delivery time"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300 mt-3">
                    <svg className="w-10 h-10 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">No delivery times set</span>
                    {isEditing && <span className="text-xs mt-1">Click the time above and press "Add Time"</span>}
                  </div>
                )}
              </div>

              {/* Delivery Days Section */}
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-medium text-sm">
                  <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Delivery Days *
                </label>
                <p className="text-xs text-slate-400 italic mb-3">
                  Select the days you deliver water
                </p>
                <div className="flex flex-wrap gap-2">
                  {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => {
                    const selected = (formData.deliveryDays || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={!isEditing}
                        onClick={() => toggleDeliveryDay(day)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border-2 cursor-pointer transition-all disabled:cursor-not-allowed ${
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
                {(formData.deliveryDays || []).length === 0 && (formData.serviceTypes || []).includes('delivery') && isEditing && (
                  <span className="text-red-500 text-xs mt-1 block">Select at least one delivery day</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Pricing */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <h3 className="text-slate-800 text-xl font-semibold m-0 mb-6 pb-3 border-b-2 border-slate-100">Pricing</h3>
          <div className="mt-4">
            <div className="mb-5">
              <label className="block mb-2 text-gray-700 font-medium text-sm">Gallon Pure Water (â‚±)</label>
              <input
                type="number"
                name="pricing_gallon_pure"
                value={formData.pricing_gallon_pure || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                min="0"
                step="0.01"
                placeholder="Enter price per gallon"
                className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              {formData.pricing_gallon_pure === null && (
                <div className="text-xs text-slate-500 italic mt-1">Not yet set</div>
              )}
            </div>

            <div className="mb-5">
              <label className="block mb-2 text-gray-700 font-medium text-sm">Gallon Spring Water (â‚±)</label>
              <input
                type="number"
                name="pricing_gallon_spring"
                value={formData.pricing_gallon_spring || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                min="0"
                step="0.01"
                placeholder="Enter price per gallon"
                className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              {formData.pricing_gallon_spring === null && (
                <div className="text-xs text-slate-500 italic mt-1">Not yet set</div>
              )}
            </div>

            <div className="mb-5">
              <label className="block mb-2 text-gray-700 font-medium text-sm">Gallon Mineral Water (â‚±)</label>
              <input
                type="number"
                name="pricing_gallon_mineral"
                value={formData.pricing_gallon_mineral || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                min="0"
                step="0.01"
                placeholder="Enter price per gallon"
                className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              {formData.pricing_gallon_mineral === null && (
                <div className="text-xs text-slate-500 italic mt-1">Not yet set</div>
              )}
            </div>

            <div className="mb-5">
              <label className="block mb-2 text-gray-700 font-medium text-sm">Delivery Fee (â‚±)</label>
              <input
                type="number"
                name="pricing_delivery_fee"
                value={formData.pricing_delivery_fee || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                min="0"
                step="0.01"
                placeholder="Enter delivery fee"
                className="w-full p-3 border-2 border-slate-200 rounded-lg text-sm transition-all bg-white focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              {formData.pricing_delivery_fee === null && (
                <div className="text-xs text-slate-500 italic mt-1">Not yet set</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Settings;
