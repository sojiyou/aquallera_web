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
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return 'Invalid coordinates';
    }
    
    const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    
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
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      let address = feature.place_name;
      
      if (address && address.length > 100) {
        address = address.split(',')[0];
      }
      
      return address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } else {
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
    
  } catch (error) {
    console.error('Mapbox geocoding error:', error);
    const latitude = parseFloat(lat) || 0;
    const longitude = parseFloat(lng) || 0;
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
};

// ===== ORDERS TABLE COMPONENT =====
const OrdersTable = ({ orders, onOrderClick }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const totalPages = Math.ceil(orders.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentOrders = orders.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [orders.length, rowsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: '#fef3c7', color: '#92400e', icon: '⏳', label: 'Pending' },
      Pending: { bg: '#fef3c7', color: '#92400e', icon: '⏳', label: 'Pending' },
      confirmed: { bg: '#dbeafe', color: '#1e40af', icon: '✓', label: 'Confirmed' },
      Confirmed: { bg: '#dbeafe', color: '#1e40af', icon: '✓', label: 'Confirmed' },
      preparing: { bg: '#ede9fe', color: '#5b21b6', icon: '🔨', label: 'Preparing' },
      Preparing: { bg: '#ede9fe', color: '#5b21b6', icon: '🔨', label: 'Preparing' },
      on_delivery: { bg: '#dbeafe', color: '#1e40af', icon: '🚚', label: 'On Delivery' },
      ready: { bg: '#d1fae5', color: '#065f46', icon: '✅', label: 'Ready' },
      completed: { bg: '#e2e8f0', color: '#475569', icon: '✅', label: 'Completed' },
      Completed: { bg: '#e2e8f0', color: '#475569', icon: '✅', label: 'Completed' },
      delivered: { bg: '#e2e8f0', color: '#475569', icon: '✅', label: 'Delivered' },
      Delivered: { bg: '#e2e8f0', color: '#475569', icon: '✅', label: 'Delivered' },
      cancelled: { bg: '#fee2e2', color: '#991b1b', icon: '✕', label: 'Cancelled' },
      Cancelled: { bg: '#fee2e2', color: '#991b1b', icon: '✕', label: 'Cancelled' },
    };
    return statusConfig[status] || { bg: '#f1f5f9', color: '#475569', icon: '📋', label: status };
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toFixed(2)}`;
  };

  if (orders.length === 0) {
    return (
      <div className="no-orders-table">
        <div className="no-orders-icon">📭</div>
        <h3>No orders found</h3>
        <p>There are no orders matching your current filter.</p>
      </div>
    );
  }

  return (
    <div className="orders-table-container">
      <table className="orders-table">
        <thead>
          <tr>
            <th className="col-order">Order #</th>
            <th className="col-customer">Customer</th>
            <th className="col-type">Type</th>
            <th className="col-amount">Amount</th>
            <th className="col-status">Status</th>
            <th className="col-action">Action</th>
          </tr>
        </thead>
        <tbody>
          {currentOrders.map((order) => {
            const statusInfo = getStatusBadge(order.status);
            const orderId = order.orderId || order.id || 'N/A';
            const customerName = order.customerName || 'N/A';
            const orderType = order.orderType || 'N/A';
            const grandTotal = order.grandTotal || (order.waterSubtotal || 0) + (order.transactionFee || 0);

            return (
              <tr 
                key={orderId} 
                className="order-table-row"
                onClick={() => onOrderClick(order)}
              >
                <td className="col-order" data-label="Order #">
                  <span className="order-id-cell">#{orderId}</span>
                </td>
                <td className="col-customer" data-label="Customer">
                  <div className="customer-cell">
                    <span className="customer-name">{customerName}</span>
                    <span className="customer-phone">{order.customerPhone || ''}</span>
                  </div>
                </td>
                <td className="col-type" data-label="Type">
                  <span className={`type-badge ${orderType === 'Delivery' ? 'delivery' : 'pickup'}`}>
                    {orderType === 'Delivery' ? '🚚' : '🏪'} {orderType}
                  </span>
                </td>
                <td className="col-amount" data-label="Amount">
                  <span className="amount-value">{formatCurrency(grandTotal)}</span>
                </td>
                <td className="col-status" data-label="Status">
                  <span 
                    className="status-badge-table"
                    style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                  >
                    {statusInfo.icon} {statusInfo.label}
                  </span>
                </td>
                <td className="col-action" data-label="Action">
                  <button className="view-order-btn" onClick={(e) => { e.stopPropagation(); onOrderClick(order); }}>
                    👁️ View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="table-pagination">
        <div className="pagination-info">
          Showing {startIndex + 1}-{Math.min(endIndex, orders.length)} of {orders.length} orders
        </div>
        
        <div className="pagination-controls">
          <div className="rows-per-page">
            <span>Rows per page:</span>
            <select 
              value={rowsPerPage} 
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="rows-select"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          
          <div className="page-navigation">
            <button 
              className="page-btn"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              title="First page"
            >
              ⏮
            </button>
            <button 
              className="page-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous page"
            >
              ◀
            </button>
            
            <span className="page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            
            <button 
              className="page-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Next page"
            >
              ▶
            </button>
            <button 
              className="page-btn"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              title="Last page"
            >
              ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== ORDER DETAIL MODAL COMPONENT =====
const OrderDetailModal = ({ order, onClose, onStatusUpdate }) => {
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
      
      const cacheKey = `mapbox_addr_${lat}_${lng}`;
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);
      const now = Date.now();
      
      if (cached && cacheTime && (now - parseInt(cacheTime)) < 3600000) {
        setAddress(cached);
        setAddressLoading(false);
        return;
      }
      
      setAddressLoading(true);
      try {
        const result = await convertCoordinatesToAddress(lat, lng);
        setAddress(result);
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

  const formatCoordinates = () => {
    const lat = order.deliveryLatitude || order.latitude;
    const lng = order.deliveryLongitude || order.longitude;
    if (!lat || !lng) return null;
    return {
      lat: parseFloat(lat).toFixed(6),
      lng: parseFloat(lng).toFixed(6)
    };
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b', Pending: '#f59e0b',
      confirmed: '#3b82f6', Confirmed: '#3b82f6',
      preparing: '#8b5cf6', Preparing: '#8b5cf6',
      on_delivery: '#3b82f6',
      ready: '#10b981',
      completed: '#6b7280', Completed: '#10b981',
      cancelled: '#ef4444', Cancelled: '#ef4444',
      delivered: '#10b981', Delivered: '#10b981',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: 'Pending', Pending: 'Pending',
      confirmed: 'Confirmed', Confirmed: 'Confirmed',
      preparing: 'Preparing', Preparing: 'Preparing',
      on_delivery: 'On Delivery',
      ready: 'Ready for Pickup',
      completed: 'Completed', Completed: 'Completed',
      cancelled: 'Cancelled', Cancelled: 'Cancelled',
      delivered: 'Delivered', Delivered: 'Delivered',
    };
    return statusMap[status] || status;
  };

  const handleStatusUpdate = async (newStatus) => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    try {
      const orderRef = ref(database, `orders/${order.orderId || order.id}`);
      await update(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      if (onStatusUpdate) {
        onStatusUpdate(order.orderId || order.id, newStatus);
      }
      alert(`✅ Order status updated to: ${getStatusText(newStatus)}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('❌ Failed to update order status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const coords = formatCoordinates();
  const pureTotal = order.pureWaterTotal || 0;
  const springTotal = order.springWaterTotal || 0;
  const mineralTotal = order.mineralWaterTotal || 0;
  const deliveryFee = order.deliveryFee || 0;
  const transactionFee = order.transactionFee || 0;
  const grandTotal = order.grandTotal || (order.waterSubtotal || 0) + (order.transactionFee || 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content order-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-section">
            <h2>📋 Order Details</h2>
            <span className="modal-order-id">#{order.orderId || order.id || 'N/A'}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-status-row">
            <div 
              className="order-status-badge"
              style={{ backgroundColor: getStatusColor(order.status), color: 'white' }}
            >
              {getStatusText(order.status)}
            </div>
          </div>

          <div className="modal-info-grid">
            <div className="info-item">
              <span className="info-label">👤 Customer</span>
              <span className="info-value">{order.customerName || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">📞 Phone</span>
              <span className="info-value">{order.customerPhone || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">📦 Type</span>
              <span className="info-value">{order.orderType || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">📅 Date</span>
              <span className="info-value">
                {order.date && order.time 
                  ? `${order.date} at ${order.time}`
                  : order.createdAt 
                    ? new Date(order.createdAt).toLocaleString()
                    : 'N/A'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">🔢 Reference</span>
              <span className="info-value">{order.referenceNumber || 'N/A'}</span>
            </div>
          </div>

          {order.orderType === 'Delivery' && (
            <div className="modal-delivery-section">
              <h4>📍 Delivery Address</h4>
              {addressLoading ? (
                <p className="loading-text">Loading address...</p>
              ) : (
                <>
                  <p className="delivery-address-text">{address}</p>
                  {order.additionalDetails && (
                    <div className="additional-instructions">
                      <span className="instructions-label">📝 Additional Instructions:</span>
                      <p>{order.additionalDetails}</p>
                    </div>
                  )}
                  {coords && (
                    <button 
                      className="toggle-coords-link"
                      onClick={() => setShowRawLocation(!showRawLocation)}
                    >
                      {showRawLocation ? '📍 Show Address' : '🗺️ Show Coordinates'}
                    </button>
                  )}
                  {showRawLocation && coords && (
                    <div className="coordinates-display">
                      Lat: {coords.lat}, Lng: {coords.lng}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="modal-order-items">
            <h4>🛒 Order Items</h4>
            <table className="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {order.pureWaterQty > 0 && (
                  <tr>
                    <td>💧 Pure Water (Gallon)</td>
                    <td>×{order.pureWaterQty}</td>
                    <td>₱{parseFloat(pureTotal).toFixed(2)}</td>
                  </tr>
                )}
                {order.springWaterQty > 0 && (
                  <tr>
                    <td>🌊 Spring Water (Liter)</td>
                    <td>×{order.springWaterQty}</td>
                    <td>₱{parseFloat(springTotal).toFixed(2)}</td>
                  </tr>
                )}
                {order.mineralWaterQty > 0 && (
                  <tr>
                    <td>⛰️ Mineral Water (Gallon)</td>
                    <td>×{order.mineralWaterQty}</td>
                    <td>₱{parseFloat(mineralTotal).toFixed(2)}</td>
                  </tr>
                )}
                {order.orderType === 'Delivery' && deliveryFee > 0 && (
                  <tr>
                    <td>🚚 Delivery Fee</td>
                    <td></td>
                    <td>₱{parseFloat(deliveryFee).toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td>💳 Transaction Fee</td>
                  <td></td>
                  <td>₱{parseFloat(transactionFee).toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2"><strong>Total</strong></td>
                  <td><strong>₱{parseFloat(grandTotal).toFixed(2)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="modal-status-actions">
            <h4>📝 Update Status</h4>
            <div className="status-buttons">
              {(order.status === 'pending' || order.status === 'Pending') && (
                <>
                  <button onClick={() => handleStatusUpdate('confirmed')} disabled={isUpdating} className="status-btn confirm">
                    ✓ Confirm Order
                  </button>
                  <button onClick={() => handleStatusUpdate('cancelled')} disabled={isUpdating} className="status-btn cancel">
                    ✕ Cancel Order
                  </button>
                </>
              )}
              {(order.status === 'confirmed' || order.status === 'Confirmed') && (
                <button onClick={() => handleStatusUpdate('preparing')} disabled={isUpdating} className="status-btn prepare">
                  🔨 Start Preparing
                </button>
              )}
              {(order.status === 'preparing' || order.status === 'Preparing') && (
                <>
                  {order.orderType === 'Delivery' ? (
                    <button onClick={() => handleStatusUpdate('on_delivery')} disabled={isUpdating} className="status-btn deliver">
                      🚚 Out for Delivery
                    </button>
                  ) : (
                    <button onClick={() => handleStatusUpdate('ready')} disabled={isUpdating} className="status-btn ready">
                      ✓ Ready for Pickup
                    </button>
                  )}
                </>
              )}
              {(order.status === 'on_delivery' || order.status === 'ready') && (
                <button onClick={() => handleStatusUpdate('completed')} disabled={isUpdating} className="status-btn complete">
                  ✅ Mark as Completed
                </button>
              )}
              {(order.status === 'completed' || order.status === 'Completed' || 
                order.status === 'cancelled' || order.status === 'Cancelled' ||
                order.status === 'delivered' || order.status === 'Delivered') && (
                <div className="status-final-message">
                  Order {getStatusText(order.status)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
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

  const calculateStats = async (orderList) => {
    const total = orderList.length;
    const pending = orderList.filter(order => 
      order.status === 'pending' || order.status === 'Pending'
    ).length;
    const completed = orderList.filter(order => 
      order.status === 'completed' || order.status === 'Completed' || 
      order.status === 'delivered' || order.status === 'Delivered'
    ).length;
    
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

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toFixed(2)}`;
  };

  const getFilteredOrders = () => {
    if (activeTab === 'all') return orders;
    
    return orders.filter(order => {
      const status = (order.status || '').toLowerCase();
      
      if (activeTab === 'pending') return status === 'pending';
      if (activeTab === 'confirmed') return status === 'confirmed';
      if (activeTab === 'preparing') return status === 'preparing';
      if (activeTab === 'completed') return status === 'completed' || status === 'delivered';
      if (activeTab === 'cancelled') return status === 'cancelled';
      
      return true;
    });
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedOrder(null);
  };

  const handleStatusUpdate = (orderId, newStatus) => {
    setOrders(prevOrders => 
      prevOrders.map(order => 
        (order.orderId || order.id) === orderId 
          ? { ...order, status: newStatus }
          : order
      )
    );
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const onlineRef = ref(database, `waterStations/${user.uid}/isOnline`);
      set(onlineRef, true);
      onDisconnect(onlineRef).set(false);

      const stationRef = ref(database, `waterStations/${user.uid}`);
      const unsubscribeStation = onValue(stationRef, (snapshot) => {
        console.log("STATION SNAPSHOT EXISTS:", snapshot.exists());
        console.log("STATION RAW VALUE:", snapshot.val());

        if (snapshot.exists()) {
          setStationData(snapshot.val());
        } else {
          setStationData(null);
        }

        setLoading(false);
      });

      const ordersRef = ref(database, "orders");
      const unsubscribeOrders = onValue(ordersRef, async (snapshot) => {
        if (snapshot.exists()) {
          const ordersData = snapshot.val();
          const ordersArray = Object.entries(ordersData).map(([key, value]) => ({
            id: key,
            ...value
          }));

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

      return () => {
        unsubscribeStation();
        unsubscribeOrders();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    try {
      const user = auth.currentUser;

      if (user) {
        const onlineRef = ref(database, `waterStations/${user.uid}/isOnline`);
        await set(onlineRef, false);
      }

      await auth.signOut();
      navigate('/login');

    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to logout. Please try again.');
    }
  };

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

  return (
    <div className="dashboard-container">
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
            <button onClick={handleLogout} className="logout-btn-small">
              Logout
            </button>
          </div>
        </div>
      </header>

      {activeSection === 'orders' && (
        <>
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

          <section className="orders-section">
            <div className="section-header">
              <h2>📦 Order Management</h2>
              <div className="order-filter-dropdown-wrapper">
                <select 
                  className="order-filter-dropdown"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <OrdersTable orders={getFilteredOrders()} onOrderClick={handleOrderClick} />
          </section>

          {showModal && selectedOrder && (
            <OrderDetailModal 
              order={selectedOrder} 
              onClose={handleCloseModal}
              onStatusUpdate={handleStatusUpdate}
            />
          )}
        </>
      )}

      {activeSection === 'stock' && <Stock />}
      {activeSection === 'settings' && <Settings stationData={stationData} setStationData={setStationData} />}
    </div>
  );
};

export default Dashboard;