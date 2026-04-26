// src/components/Dashboard/Dashboard.js
import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { ref, onValue, update, set, onDisconnect } from 'firebase/database';
import { database, auth } from '../config/Firebase';
import Settings from './Settings';
import Stock from './Stock';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

// Mapbox Geocoding Function using YOUR token
const convertCoordinatesToAddress = async (lat, lng) => {
  try {
    if (!lat || !lng) return 'No location provided';
    
    // Parse coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return 'Invalid coordinates';
    }
    
    // YOUR Mapbox token
    const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    
    // Mapbox Reverse Geocoding
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
      `access_token=${MAPBOX_TOKEN}&` +
      `types=address,place,poi,neighborhood&` +
      `language=en&` +
      `limit=1`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mapbox API error:', response.status, errorText);
      // Fallback to coordinates
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      let address = feature.place_name;
      
      // Clean up the address if it's too long
      if (address && address.length > 100) {
        address = address.split(',')[0];
      }
      
      return address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } else {
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
    
  } catch (error) {
    console.error('Mapbox geocoding error:', error);
    
    // Fallback: Return formatted coordinates
    const latitude = parseFloat(lat) || 0;
    const longitude = parseFloat(lng) || 0;
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
};

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState('orders');
  const [stationData, setStationData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todaysRevenue: 0,
    mostBoughtWater: 'N/A',
    topLocation: 'N/A'
  });
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

const extractLatLng = (locationString) => {
  if (!locationString) return null;

  try {
    const latMatch = locationString.match(/Lat:\s*([-\d.]+)/);
    const lngMatch = locationString.match(/Lng:\s*([-\d.]+)/);

    if (latMatch && lngMatch) {
      return {
        lat: parseFloat(latMatch[1]),
        lng: parseFloat(lngMatch[1])
      };
    }
  } catch (error) {
    console.error("Failed to extract coordinates:", error);
  }

  return null;
};


  // CalculateStats function
  const calculateStats = async (orderList) => {
    const total = orderList.length;
    const pending = orderList.filter(order => 
      order.status === 'pending' || order.status === 'Pending'
    ).length;
    const completed = orderList.filter(order => 
      order.status === 'completed' || order.status === 'Completed' || 
      order.status === 'delivered' || order.status === 'Delivered'
    ).length;
    
    // Calculate revenue from completed/delivered orders
    const revenue = orderList
      .filter(order => order.status === 'completed' || order.status === 'Completed' || 
                    order.status === 'delivered' || order.status === 'Delivered')
      .reduce((sum, order) => {
        const pureTotal = parseFloat(order.pureWaterTotal) || 0;
        const springTotal = parseFloat(order.springWaterTotal) || 0;
        const mineralTotal = parseFloat(order.mineralWaterTotal) || 0;
        const deliveryFee = parseFloat(order.deliveryFee) || 0;
        return sum + pureTotal + springTotal + mineralTotal + deliveryFee;
      }, 0);

    // NEW: Calculate most bought water type
    let pureCount = 0, springCount = 0, mineralCount = 0;
    orderList.forEach(order => {
      const pureQty = parseInt(order.pureWaterQty) || 0;
      const springQty = parseInt(order.springWaterQty) || 0;
      const mineralQty = parseInt(order.mineralWaterQty) || 0;
      
      pureCount += pureQty;
      springCount += springQty;
      mineralCount += mineralQty;
    });
    
    let mostBought = 'No orders yet';
    if (pureCount > 0 || springCount > 0 || mineralCount > 0) {
      if (pureCount >= springCount && pureCount >= mineralCount) {
        mostBought = `Pure Water (${pureCount} gallons)`;
      } else if (springCount >= pureCount && springCount >= mineralCount) {
        mostBought = `Spring Water (${springCount} liters)`;
      } else {
        mostBought = `Mineral Water (${mineralCount} gallons)`;
      }
    }

    // NEW: Calculate top location (city with most orders)
    const locationCounts = {};

    for (const order of orderList) {
      if (!order.locationDetails) continue;

      const coords = extractLatLng(order.locationDetails);
      if (!coords) continue;

      const address = await convertCoordinatesToAddress(
        coords.lat,
        coords.lng
      );

      if (address && address !== "Unknown") {
        locationCounts[address] =
          (locationCounts[address] || 0) + 1;
      }
    }


    
    let topLocation = 'No orders yet';
    if (Object.keys(locationCounts).length > 0) {
      const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
      const topCity = sortedLocations[0];
      topLocation = `${topCity[0]} (${topCity[1]} orders)`;
    }

    setStats({
      totalOrders: total,
      pendingOrders: pending,
      completedOrders: completed,
      todaysRevenue: revenue,
      mostBoughtWater: mostBought,
      topLocation: topLocation
    });
  };

// Order Item Component with Mapbox address conversion
const OrderItem = ({ order }) => {
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(true);
  const [showRawLocation, setShowRawLocation] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  useEffect(() => {
    const fetchAddress = async () => {
      const lat = order.deliveryLatitude || order.latitude;
      const lng = order.deliveryLongitude || order.longitude;
      
      if (!lat || !lng || order.orderType !== 'Delivery') {
        setAddress('Pickup order');
        setAddressLoading(false);
        return;
      }
      
      // Generate cache key
      const cacheKey = `mapbox_addr_${lat}_${lng}`;
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);
      const now = Date.now();
      
      // Use cache if less than 1 hour old
      if (cached && cacheTime && (now - parseInt(cacheTime)) < 3600000) {
        setAddress(cached);
        setAddressLoading(false);
        return;
      }
      
      setAddressLoading(true);
      try {
        const result = await convertCoordinatesToAddress(lat, lng);
        setAddress(result);
        
        // Cache the result
        localStorage.setItem(cacheKey, result);
        localStorage.setItem(`${cacheKey}_time`, now.toString());
      } catch (error) {
        console.error('Failed to get address:', error);
        setAddress(`${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`);
      } finally {
        setAddressLoading(false);
      }
    };
    
    
    fetchAddress();
  }, [order]);
  
  // Format coordinates for display
  const formatCoordinates = () => {
    const lat = order.deliveryLatitude || order.latitude;
    const lng = order.deliveryLongitude || order.longitude;
    
    if (!lat || !lng) return null;
    
    return {
      lat: parseFloat(lat).toFixed(6),
      lng: parseFloat(lng).toFixed(6)
    };
  };
  
  // Calculate totals
  const pureTotal = order.pureWaterTotal || 0;
  const springTotal = order.springWaterTotal || 0;
  const mineralTotal = order.mineralWaterTotal || 0;
  const deliveryFee = order.deliveryFee || 0;
  const grandTotal = order.grandTotal || (order.waterSubtotal || 0) + (order.transactionFee || 0);
  
  const coords = formatCoordinates();
  
  // Status update function
  const handleStatusUpdate = async (newStatus) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    
    try {
      // Create a reference to this specific order
      const orderRef = ref(database, `orders/${order.orderId || order.id}`);
      
      // Update the order status in Firebase
      await update(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      // Show success message
      alert(`✅ Order status updated to: ${getStatusText(newStatus)}`);
      
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('❌ Failed to update order status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#8b5cf6',
      on_delivery: '#3b82f6',
      ready: '#10b981',
      completed: '#6b7280',
      cancelled: '#ef4444',
      // Android app statuses
      Pending: '#f59e0b',
      Confirmed: '#3b82f6',
      Preparing: '#8b5cf6',
      Completed: '#10b981',
      Cancelled: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      on_delivery: 'On Delivery',
      ready: 'Ready for Pickup',
      completed: 'Completed',
      cancelled: 'Cancelled',
      // Android app statuses
      Pending: 'Pending',
      Confirmed: 'Confirmed',
      Preparing: 'Preparing',
      Completed: 'Completed',
      Cancelled: 'Cancelled'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="order-card">
      <div className="order-header">
        <div className="order-id">
          <span className="id-label">Order #</span>
          <span className="id-value">{order.orderId || order.id || 'N/A'}</span>
        </div>
        <div 
          className="order-status" 
          style={{ 
            background: getStatusColor(order.status),
            color: 'white',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: '600'
          }}
        >
          {getStatusText(order.status)}
        </div>
      </div>

      <div className="order-details">
        <div className="detail-row">
          <span className="detail-label">Customer:</span>
          <span className="detail-value">{order.customerName || 'N/A'}</span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">Phone:</span>
          <span className="detail-value">
            {order.customerPhone ? order.customerPhone : 'Not provided'}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Type:</span>
          <span className="detail-value">{order.orderType || 'N/A'}</span>
        </div>

        {order.orderType === 'Delivery' && (
          <>
            <div className="detail-row delivery-address">
              <span className="detail-label">Delivery to:</span>
              <div className="address-container">
                {addressLoading ? (
                  <span className="detail-value loading">Loading address...</span>
                ) : (
                  <>
                    <span className="detail-value">{address}</span>
                    {coords && (
                      <button 
                        className="toggle-coords-btn"
                        onClick={() => setShowRawLocation(!showRawLocation)}
                        title={showRawLocation ? "Show address" : "Show coordinates"}
                      >
                        {showRawLocation ? '📍 Address' : '🗺️ Coords'}
                      </button>
                    )}
                  </>
                )}
              </div>
              {showRawLocation && coords && (
                <div className="raw-coordinates">
                  <small>
                    Lat: {coords.lat}, Lng: {coords.lng}
                  </small>
                </div>
              )}
            </div>

            {/* NEW: Additional Delivery Instructions */}
            {order.additionalDetails && (
              <div className="detail-row delivery-instructions">
                <span className="detail-label"> Additional Instructions:</span>
                <div className="instructions-container">
                  <span className="detail-value instructions-text">
                    {order.additionalDetails}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="detail-row">
          <span className="detail-label">Date & Time:</span>
          <span className="detail-value">
            {order.date && order.time 
              ? `${order.date} at ${order.time}`
              : order.createdAt 
                ? new Date(order.createdAt).toLocaleString()
                : 'N/A'
            }
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Reference #:</span>
          <span className="detail-value">
            {order.referenceNumber || 'N/A'}
          </span>
        </div>
      </div>

      <div className="order-items">
        <h4>Order Items:</h4>
        {order.pureWaterQty > 0 && (
          <div className="item-row">
            <span>Pure Water (Gallon)</span>
            <span>×{order.pureWaterQty}</span>
            <span>₱{parseFloat(order.pureWaterTotal || 0).toFixed(2)}</span>
          </div>
        )}
        {order.springWaterQty > 0 && (
          <div className="item-row">
            <span>Spring Water (Liter)</span>
            <span>×{order.springWaterQty}</span>
            <span>₱{parseFloat(order.springWaterTotal || 0).toFixed(2)}</span>
          </div>
        )}
        {order.mineralWaterQty > 0 && (
          <div className="item-row">
            <span>Mineral Water (Gallon)</span>
            <span>×{order.mineralWaterQty}</span>
            <span>₱{parseFloat(order.mineralWaterTotal || 0).toFixed(2)}</span>
          </div>
        )}
        {order.orderType === 'Delivery' && order.deliveryFee > 0 && (
          <div className="item-row">
            <span>Delivery Fee</span>
            <span></span>
            <span>₱{parseFloat(order.deliveryFee || 0).toFixed(2)}</span>
          </div>
        )}

          <div className="item-row">
            <span>Transaction Fee</span>
            <span></span>
            <span>₱{parseFloat(order.transactionFee || 0).toFixed(2)}</span>
          </div>

        
      


      </div>

      <div className="order-total">
        <span>Total Amount:</span>
        <span className="total-amount">
          ₱{parseFloat(order.grandTotal || (order.waterSubtotal + (order.transactionFee || 0))).toFixed(2)}
        </span>
      </div>

      {/* Status Update Buttons - WITH COLORS */}
      <div className="order-actions">
        <h4>Update Status:</h4>
        <div className="status-buttons">
          {order.status === 'pending' || order.status === 'Pending' ? (
            <>
              <button 
                onClick={() => handleStatusUpdate('confirmed')}
                disabled={isUpdating}
                className="status-btn confirm"
              >
                {isUpdating ? 'Updating...' : '✓ Confirm Order'}
              </button>
              <button 
                onClick={() => handleStatusUpdate('cancelled')}
                disabled={isUpdating}
                className="status-btn cancel"
              >
                {isUpdating ? 'Updating...' : '✕ Cancel Order'}
              </button>
            </>
          ) : order.status === 'confirmed' || order.status === 'Confirmed' ? (
            <button 
              onClick={() => handleStatusUpdate('preparing')}
              disabled={isUpdating}
              className="status-btn prepare"
            >
              {isUpdating ? 'Updating...' : '🔨 Start Preparing'}
            </button>
          ) : order.status === 'preparing' || order.status === 'Preparing' ? (
            <>
              {order.orderType === 'Delivery' ? (
                <button 
                  onClick={() => handleStatusUpdate('on_delivery')}
                  disabled={isUpdating}
                  className="status-btn deliver"
                >
                  {isUpdating ? 'Updating...' : '🚚 Out for Delivery'}
                </button>
              ) : (
                <button 
                  onClick={() => handleStatusUpdate('ready')}
                  disabled={isUpdating}
                  className="status-btn ready"
                >
                  {isUpdating ? 'Updating...' : '✓ Ready for Pickup'}
                </button>
              )}
            </>
          ) : (order.status === 'on_delivery' || order.status === 'ready') ? (
            <button 
              onClick={() => handleStatusUpdate('completed')}
              disabled={isUpdating}
              className="status-btn complete"
            >
              {isUpdating ? 'Updating...' : '✅ Mark as Completed'}
            </button>
          ) : (
            <div className={`status-final ${order.status === 'completed' || order.status === 'Completed' ? 'completed' : 'cancelled'}`}>
              Order {order.status === 'completed' || order.status === 'Completed' ? 'Completed' : 'Cancelled'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

  // Currency formatting
  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Filter orders based on active tab
  const getFilteredOrders = () => {
    if (activeTab === 'all') return orders;
    
    return orders.filter(order => {
      const status = (order.status || '').toLowerCase();
      
      if (activeTab === 'pending') {
        return status === 'pending';
      }
      if (activeTab === 'confirmed') {
        return status === 'confirmed';
      }
      if (activeTab === 'preparing') {
        return status === 'preparing';
      }
      if (activeTab === 'completed') {
        return status === 'completed' || status === 'delivered';
      }
      if (activeTab === 'cancelled') {
        return status === 'cancelled';
      }
      
      return true;
    });
  };

  // Fetch station data and orders
  useEffect(() => {
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

      // ✅ SET STATION ONLINE
    const onlineRef = ref(database, `waterStations/${user.uid}/isOnline`);
    set(onlineRef, true);

    // ✅ SET OFFLINE ON DISCONNECT
    onDisconnect(onlineRef).set(false); 

    // 🔹 Station listener
    const stationRef = ref(database, `waterStations/${user.uid}`);
    const unsubscribeStation = onValue(stationRef, (snapshot) => {
      console.log("STATION SNAPSHOT EXISTS:", snapshot.exists());
      console.log("STATION RAW VALUE:", snapshot.val());

      if (snapshot.exists()) {
        setStationData(snapshot.val());
      } else {
        setStationData(null);
      }

      // optional but recommended
      setLoading(false);
    });

    // 🔹 Orders listener
  const ordersRef = ref(database, "orders");
  const unsubscribeOrders = onValue(ordersRef, async (snapshot) => {
    if (snapshot.exists()) {
      const ordersData = snapshot.val();
      const ordersArray = Object.entries(ordersData).map(([key, value]) => ({
        id: key,
        ...value
      }));


      // ✅ FILTER ORDERS BY STATION ID
      const stationOrders = ordersArray.filter(order => {
        const matches = order.stationId === user.uid;
        if (matches) {
          console.log("✅ DASHBOARD - Matched order:", order.id || order.orderId, "StationId:", order.stationId);
        }
        return matches;
      });

      console.log("📊 DASHBOARD - Station orders filtered:", stationOrders.length);

      setOrders(stationOrders);
      await calculateStats(stationOrders);
          } else {
            setOrders([]);
            calculateStats([]);
          }
          setLoading(false);
        });

        // ✅ CLEANUP BOTH
        return () => {
          unsubscribeStation();
          unsubscribeOrders();
        };
      });

    // ✅ Cleanup auth listener
    return () => unsubscribeAuth();

  }, []);



  const handleLogout = async () => {
    try {
      const user = auth.currentUser;

      if (user) {
        const onlineRef = ref(database, `waterStations/${user.uid}/isOnline`);
        await set(onlineRef, false); // ✅ SET OFFLINE
      }

      await auth.signOut();
      navigate('/login');

    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to logout. Please try again.');
    }
  };


  // Check if station is pending approval
  if (stationData && stationData.status === 'pending') {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-info">
              <h1>⏳ Pending Approval</h1>
              <p className="station-location">
                {stationData.stationName || 'Your Station'}
              </p>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </header>

        <div className="pending-approval">
          <div className="pending-icon">⏳</div>
          <h2>Your station is pending admin approval</h2>
          <p>Thank you for registering! An administrator will review your application soon.</p>
          <p>You will receive an email notification once your station is approved.</p>
          
          <div className="pending-details">
            <h3>What happens next?</h3>
            <ul>
              <li>Admin reviews your business permit and station details</li>
              <li>You'll receive an email notification (usually within 24-48 hours)</li>
              <li>Once approved, you can start accepting orders!</li>
            </ul>
          </div>
          
          <div className="pending-actions">
            <button 
              className="btn-secondary"
              onClick={() => window.location.href = 'mailto:support@aquallera.com'}
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ADDED: Check if station is rejected
  if (stationData && stationData.status === 'rejected') {
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-info">
              <h1>❌ Registration Rejected</h1>
              <p className="station-location">
                {stationData.stationName || 'Your Station'}
              </p>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </header>

        <div className="rejected-station">
          <div className="rejected-icon">❌</div>
          <h2>Station Registration Rejected</h2>
          
          {stationData.rejectionReason && (
            <div className="rejection-reason">
              <h3>Reason for Rejection:</h3>
              <p>{stationData.rejectionReason}</p>
            </div>
          )}
          
          <div className="action-buttons">
            <button 
              className="btn-primary"
              onClick={() => navigate('/signup')}
            >
              Re-apply with Corrections
            </button>
            <button 
              className="btn-secondary"
              onClick={() => window.location.href = 'mailto:support@aquallera.com'}
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    );
  }




  // Orders Section Component
  const OrdersSection = () => (
    <>
      {/* Stats Overview */}
      <section className="stats-overview">
        <div className="stat-card total">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <h3>{stats.totalOrders}</h3>
            <p>Total Orders</p>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>{stats.pendingOrders}</h3>
            <p>Pending Orders</p>
          </div>
        </div>
        <div className="stat-card completed">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.completedOrders}</h3>
            <p>Completed Today</p>
          </div>
        </div>
        <div className="stat-card revenue">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>{formatCurrency(stats.todaysRevenue)}</h3>
            <p>Today's Revenue</p>
          </div>
        </div>
        {/* NEW STAT CARDS */}
        <div className="stat-card popular">
          <div className="stat-icon">💧</div>
          <div className="stat-info">
            <h3>{stats.mostBoughtWater}</h3>
            <p>Most Popular Water</p>
          </div>
        </div>
        <div className="stat-card location">
          <div className="stat-icon">📍</div>
          <div className="stat-info">
            <h3>{stats.topLocation}</h3>
            <p>Top Customer Location</p>
          </div>
        </div>
      </section>

      {/* Orders Management */}
      <section className="orders-section">
        <div className="section-header">
          <h2>Order Management</h2>
          <div className="order-filters">
            <button 
              className={`filter-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Orders
            </button>
            <button 
              className={`filter-btn ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending
            </button>
            <button 
              className={`filter-btn ${activeTab === 'confirmed' ? 'active' : ''}`}
              onClick={() => setActiveTab('confirmed')}
            >
              Confirmed
            </button>
            <button 
              className={`filter-btn ${activeTab === 'preparing' ? 'active' : ''}`}
              onClick={() => setActiveTab('preparing')}
            >
              Preparing
            </button>
            <button 
              className={`filter-btn ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed
            </button>
            <button 
              className={`filter-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
              onClick={() => setActiveTab('cancelled')}
            >
              Cancelled
            </button>
          </div>
        </div>

        <div className="orders-grid">
          {getFilteredOrders().map(order => (
            <OrderItem key={order.id || order.orderId} order={order} />
          ))}

          {getFilteredOrders().length === 0 && (
            <div className="no-orders">
              <div className="no-orders-icon">📭</div>
              <h3>No orders found</h3>
              <p>There are no orders matching your current filter.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-info">
            <h1>
              {stationData && stationData.stationName 
                ? `${stationData.stationName} Dashboard`
                : "Station Dashboard"
              }
            </h1>
            <p>Welcome back! Here's your business overview</p>
            
            {/* Optional: Show station location if you want */}
            {stationData && (stationData.city || stationData.address) && (
              <p className="station-location">
                📍 {stationData.address || ''} 
                {stationData.address && stationData.city ? ', ' : ''}
                {stationData.city || ''}
              </p>
            )}
          </div>
          <div className="header-actions">
            <div className="dashboard-nav">
              <button 
                className={`nav-btn ${activeSection === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveSection('orders')}
              >
                📦 Orders
              </button>
              <button 
                className={`nav-btn ${activeSection === 'stock' ? 'active' : ''}`}
                onClick={() => setActiveSection('stock')}
              >
                💧 Stock & Analytics
              </button>
              <button 
                className={`nav-btn ${activeSection === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveSection('settings')}
              >
                ⚙️ Settings
              </button>
            </div>
            <div className="station-status">
              <div className="status-indicator online"></div>
              <span>Online</span>
            </div>
            {/* ADDED: Logout button in header for approved stations */}
            <button onClick={handleLogout} className="logout-btn-small">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Conditional Rendering */}
      {activeSection === 'orders' && <OrdersSection />}
      {activeSection === 'stock' && <Stock />}
      {activeSection === 'settings' && <Settings stationData={stationData} setStationData={setStationData} />}
    </div>
  );
};

export default Dashboard;