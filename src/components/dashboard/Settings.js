import React, { useState, useEffect } from 'react';
import './Settings.css';
import { ref, update, onValue } from 'firebase/database';
import { database, auth } from '../config/Firebase';

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
        deliveryHours: [], // NEW: Initialize empty array
        pricing_gallon_pure: null,
        pricing_liter_spring: null,
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
          else if (key === 'serviceTypes' || key === 'deliveryHours') {
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
      <section className="settings-section">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading station data...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <div className="settings-header">
        <h2>Station Settings</h2>
        <div className="settings-actions">
          {!isEditing ? (
            <button 
              className="btn-primary"
              onClick={() => setIsEditing(true)}
            >
              ✏️ Edit Settings
            </button>
          ) : (
            <div className="edit-actions">
              <button 
                className="btn-secondary"
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
                className="btn-primary"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner-small"></div>
                    Saving...
                  </>
                ) : (
                  '💾 Save Changes'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="settings-grid">
        {/* Basic Information */}
        <div className="settings-card">
          <h3>📋 Basic Information</h3>
          <div className="form-group">
            <label>Station Name</label>
            <input
              type="text"
              name="stationName"
              value={formData.stationName || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter station name"
            />
          </div>
          <div className="form-group">
            <label>Owner Name</label>
            <input
              type="text"
              name="ownerName"
              value={formData.ownerName || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter owner name"
            />
          </div>
          <div className="form-group">
            <label>Contact Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter phone number"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter email address"
            />
          </div>
        </div>

        {/* Location Information */}
        <div className="settings-card">
          <h3>📍 Location</h3>
          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              name="address"
              value={formData.address || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Enter street address"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="City"
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                name="state"
                value={formData.state || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="State"
              />
            </div>
          </div>
          <div className="form-group">
            <label>ZIP Code</label>
            <input
              type="text"
              name="zipCode"
              value={formData.zipCode || ''}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="ZIP code"
            />
          </div>
          
          {/* Coordinates Display */}
          <div className="coordinates-section">
            <label>Station Coordinates</label>
            <div className="coordinates-display">
              <div className="coordinate-item">
                <span className="coordinate-label">📍 Latitude</span>
                <span className="coordinate-value">
                  {formData.latitude ? 
                    typeof formData.latitude === 'number' ? 
                      formData.latitude.toFixed(6) : 
                      formData.latitude 
                    : 'Not set'}
                </span>
              </div>
              <div className="coordinate-item">
                <span className="coordinate-label">📍 Longitude</span>
                <span className="coordinate-value">
                  {formData.longitude ? 
                    typeof formData.longitude === 'number' ? 
                      formData.longitude.toFixed(6) : 
                      formData.longitude 
                    : 'Not set'}
                </span>
              </div>
              
              {(formData.latitude && formData.longitude) && (
                <div className="actual-location">
                  <span className="location-label">🏠 Actual Location:</span>
                  <span className="location-value">{actualLocation || 'Loading location details...'}</span>
                </div>
              )}

              <div className="location-actions">
                <button 
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation || !isEditing}
                  className={`location-btn ${isGettingLocation ? 'loading' : ''}`}
                >
                  {isGettingLocation ? (
                    <>
                      <div className="spinner-small"></div>
                      Getting Location...
                    </>
                  ) : (
                    '📍 Get Current Location'
                  )}
                </button>
                
                {locationStatus && (
                  <div className={`location-status ${locationStatus.includes('successfully') ? 'success' : 'error'}`}>
                    {locationStatus}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="settings-card">
          <h3>🕒 Business Hours</h3>
          <div className="business-hours-settings">
            <div className="form-row">
              <div className="form-group">
                <label>Opening Time</label>
                <input
                  type="time"
                  name="businessHours.open"
                  value={formData.businessHours?.open || '08:00'}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              </div>
              <div className="form-group">
                <label>Closing Time</label>
                <input
                  type="time"
                  name="businessHours.close"
                  value={formData.businessHours?.close || '18:00'}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
              </div>
            </div>
            <div className="business-hours-preview">
              <span>Current Hours: </span>
              <strong>{formData.businessHours?.open || '08:00'} - {formData.businessHours?.close || '18:00'}</strong>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="settings-card">
          <h3>🚚 Services</h3>
          <div className="service-types-settings">
            <label>Available Services</label>
            <div className="service-checkboxes">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="serviceTypes"
                  value="delivery"
                  checked={(formData.serviceTypes || []).includes('delivery')}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
                <span>🚚 Delivery Service</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="serviceTypes"
                  value="pickup"
                  checked={(formData.serviceTypes || []).includes('pickup')}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                />
                <span>🏪 Pickup Service</span>
              </label>
            </div>
          </div>

          {(formData.serviceTypes || []).includes('delivery') && (
            <>
              <div className="form-group">
                <label>Delivery Radius (km)</label>
                <select 
                  name="deliveryRadius" 
                  value={formData.deliveryRadius || 5}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="15">15 km</option>
                  <option value="20">20 km</option>
                </select>
              </div>

              {/* NEW: Delivery Hours Section */}
              <div className="form-group">
                <label>Delivery Hours</label>
                <p className="field-hint" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
                  Times when you deliver water to customers
                </p>

                {isEditing && (
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
                )}

                {(formData.deliveryHours || []).length > 0 ? (
                  <div className="delivery-hours-list">
                    {formData.deliveryHours.map((time, index) => (
                      <div key={index} className="delivery-hour-item">
                        <span className="delivery-time-icon">🚚</span>
                        <span className="delivery-time-value">{time}</span>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => removeDeliveryHour(time)}
                            className="btn-remove-delivery"
                            title="Remove this delivery time"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="delivery-hours-empty">
                    No delivery times set
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Pricing */}
        <div className="settings-card">
          <h3>💰 Pricing</h3>
          <div className="pricing-settings">
            <div className="form-group">
              <label>Gallon Pure Water (₱)</label>
              <input
                type="number"
                name="pricing_gallon_pure"
                value={formData.pricing_gallon_pure || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                min="0"
                step="0.01"
                placeholder="Enter price per gallon"
              />
              {formData.pricing_gallon_pure === null && (
                <div className="price-note">Not yet set</div>
              )}
            </div>

            <div className="form-group">
              <label>Liter Spring Water (₱)</label>
              <input
                type="number"
                name="pricing_liter_spring"
                value={formData.pricing_liter_spring || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                min="0"
                step="0.01"
                placeholder="Enter price per liter"
              />
              {formData.pricing_liter_spring === null && (
                <div className="price-note">Not yet set</div>
              )}
            </div>

            <div className="form-group">
              <label>Gallon Mineral Water (₱)</label>
              <input
                type="number"
                name="pricing_gallon_mineral"
                value={formData.pricing_gallon_mineral || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                min="0"
                step="0.01"
                placeholder="Enter price per gallon"
              />
              {formData.pricing_gallon_mineral === null && (
                <div className="price-note">Not yet set</div>
              )}
            </div>

            <div className="form-group">
              <label>Delivery Fee (₱)</label>
              <input
                type="number"
                name="pricing_delivery_fee"
                value={formData.pricing_delivery_fee || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
                min="0"
                step="0.01"
                placeholder="Enter delivery fee"
              />
              {formData.pricing_delivery_fee === null && (
                <div className="price-note">Not yet set</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Settings;