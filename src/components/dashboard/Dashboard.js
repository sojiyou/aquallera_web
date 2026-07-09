// src/components/Dashboard/Dashboard.js
import React, { useState, useEffect } from 'react';
import { ref, onValue, update, set, onDisconnect } from 'firebase/database';
import { database, auth } from '../config/Firebase';
import AlertCard, { useAlert } from '../admin/AlertCard';
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
      pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
      Pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
      confirmed: { bg: '#eff6ff', color: '#1e40af', label: 'Confirmed' },
      Confirmed: { bg: '#eff6ff', color: '#1e40af', label: 'Confirmed' },
      preparing: { bg: '#dbeafe', color: '#1e3a8a', label: 'Preparing' },
      Preparing: { bg: '#dbeafe', color: '#1e3a8a', label: 'Preparing' },
      on_delivery: { bg: '#93c5fd', color: '#1e3a8a', label: 'For Delivery' },
      ready: { bg: '#bfdbfe', color: '#1e3a8a', label: 'For Pickup' },
      Ready: { bg: '#bfdbfe', color: '#1e3a8a', label: 'Ready' },
      completed: { bg: '#e2e8f0', color: '#475569', label: 'Completed' },
      Completed: { bg: '#e2e8f0', color: '#475569', label: 'Completed' },
      delivered: { bg: '#e2e8f0', color: '#475569', label: 'Delivered' },
      Delivered: { bg: '#e2e8f0', color: '#475569', label: 'Delivered' },
      cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
      Cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
    };
    return statusConfig[status] || { bg: '#f1f5f9', color: '#475569', label: status };
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toFixed(2)}`;
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl shadow-sm">
        <div className="text-5xl mb-4"></div>
        <h3 className="text-slate-800 m-0 mb-2">No orders found</h3>
        <p className="text-slate-500 m-0">There are no orders matching your current filter.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Desktop Table - hidden below md */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="w-[120px] px-4 py-3 text-slate-700 font-semibold text-xs uppercase tracking-wider">Order #</th>
              <th className="min-w-[180px] px-4 py-3 text-slate-700 font-semibold text-xs uppercase tracking-wider">Customer</th>
              <th className="w-[110px] px-4 py-3 text-slate-700 font-semibold text-xs uppercase tracking-wider">Type</th>
              <th className="w-[120px] px-4 py-3 text-slate-700 font-semibold text-xs uppercase tracking-wider">Amount</th>
              <th className="w-[140px] px-4 py-3 text-slate-700 font-semibold text-xs uppercase tracking-wider">Status</th>
              <th className="w-[80px] text-center px-4 py-3 text-slate-700 font-semibold text-xs uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentOrders.map((order, index) => {
              const statusInfo = getStatusBadge(order.status);
              const orderId = order.orderId || order.id || 'N/A';
              const customerName = order.customerName || 'N/A';
              const orderType = order.orderType || 'N/A';
              const grandTotal = order.grandTotal || (order.waterSubtotal || 0) + (order.transactionFee || 0);

              return (
                <tr 
                  key={orderId} 
                  className={`border-b border-slate-200 cursor-pointer transition-all hover:bg-primary/5 last:border-b-0 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  onClick={() => onOrderClick(order)}
                >
                  <td className="w-[120px] px-4 py-3">
                    <span className="font-semibold text-primary font-mono text-xs">#{orderId}</span>
                  </td>
                  <td className="min-w-[180px] px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-800 text-base">{customerName}</span>
                      <span className="text-slate-500 text-sm">{order.customerPhone || ''}</span>
                    </div>
                  </td>
                  <td className="w-[110px] px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${orderType === 'Delivery' ? 'bg-primary/15 text-primary-dark' : 'bg-emerald-100 text-emerald-800'}`}>
                      {orderType}
                    </span>
                  </td>
                  <td className="w-[120px] px-4 py-3">
                    <span className="font-bold text-slate-800 text-sm">{formatCurrency(grandTotal)}</span>
                  </td>
                  <td className="w-[140px] px-4 py-3">
                    <span 
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm"
                      style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="w-[80px] text-center px-4 py-3">
                    <button className="bg-primary text-white border-none px-4 py-2 rounded-md cursor-pointer text-xs font-semibold transition-all hover:bg-primary-dark hover:-translate-y-0.5 hover:shadow-md active:translate-y-0" onClick={(e) => { e.stopPropagation(); onOrderClick(order); }}>
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards - hidden on md+ */}
      <div className="md:hidden divide-y divide-slate-200">
        {currentOrders.map((order, index) => {
          const orderId = order.orderId || order.id || 'N/A';
          const customerName = order.customerName || 'N/A';
          const grandTotal = order.grandTotal || (order.waterSubtotal || 0) + (order.transactionFee || 0);

          return (
            <div 
              key={orderId}
              className="px-4 py-4 cursor-pointer transition-all hover:bg-primary/5 active:bg-primary/10"
              onClick={() => onOrderClick(order)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="font-semibold text-slate-800 text-[15px] leading-tight truncate">{customerName}</div>
                  {order.customerPhone && (
                    <div className="text-slate-400 text-xs mt-0.5">{order.customerPhone}</div>
                  )}
                </div>
                <button 
                  className="flex-shrink-0 bg-primary text-white border-none px-4 py-[7px] rounded-md cursor-pointer text-xs font-semibold transition-all hover:bg-primary-dark active:scale-95"
                  onClick={(e) => { e.stopPropagation(); onOrderClick(order); }}
                >
                  View
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary font-mono text-[11px]">#{orderId}</span>
                <span className="font-bold text-slate-700 text-xs ml-auto">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-5 py-4 bg-slate-100 border-t border-slate-200 gap-3">
        <div className="text-slate-600 text-sm font-medium">
          Showing {startIndex + 1}-{Math.min(endIndex, orders.length)} of {orders.length} orders
        </div>
        
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Rows per page:</span>
            <select 
              value={rowsPerPage} 
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white cursor-pointer font-medium"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              className="w-8 h-8 border border-slate-300 bg-white rounded-md cursor-pointer flex items-center justify-center text-sm transition-all hover:bg-primary hover:text-white hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              title="First page"
            >
              &laquo;
            </button>
            <button 
              className="w-8 h-8 border border-slate-300 bg-white rounded-md cursor-pointer flex items-center justify-center text-sm transition-all hover:bg-primary hover:text-white hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous page"
            >
              &lsaquo;
            </button>
            
            <span className="text-sm text-slate-700 font-semibold px-3 whitespace-nowrap">
              Page {currentPage} of {totalPages}
            </span>
            
            <button 
              className="w-8 h-8 border border-slate-300 bg-white rounded-md cursor-pointer flex items-center justify-center text-sm transition-all hover:bg-primary hover:text-white hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Next page"
            >
              &rsaquo;
            </button>
            <button 
              className="w-8 h-8 border border-slate-200 bg-white rounded-md cursor-pointer flex items-center justify-center text-xs transition-all hover:bg-primary hover:text-white hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              title="Last page"
            >
              &raquo;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== ORDER DETAIL MODAL COMPONENT =====
const OrderDetailModal = ({ order, onClose, onStatusUpdate, showAlert }) => {
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(true);
  const [showRawLocation, setShowRawLocation] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchAddress = async () => {
      if (order.deliveryAddress) {
        setAddress(order.deliveryAddress);
        setAddressLoading(false);
        return;
      }

      if (order.locationDetails) {
        setAddress(order.locationDetails);
        setAddressLoading(false);
        return;
      }

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
      confirmed: '#60a5fa', Confirmed: '#60a5fa',
      preparing: '#3b82f6', Preparing: '#3b82f6',
      on_delivery: '#1d4ed8',
      ready: '#2563eb',
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
      showAlert({ type: 'success', message: `Order status updated to: ${getStatusText(newStatus)}` });
    } catch (error) {
      console.error('Error updating order status:', error);
      showAlert({ type: 'error', message: 'Failed to update order status. Please try again.' });
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4 animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[650px] max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h2>Order Details</h2>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold text-xs font-mono">#{order.orderId || order.id || 'N/A'}</span>
          </div>
          <button className="w-9 h-9 border-none bg-slate-100 rounded-full cursor-pointer text-lg text-slate-500 flex items-center justify-center transition-all hover:bg-slate-200 hover:text-slate-800" onClick={onClose}>&times;</button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-5">
            <div 
              className="inline-block px-4 py-1.5 rounded-full font-semibold text-xs"
              style={{ backgroundColor: getStatusColor(order.status), color: 'white' }}
            >
              {getStatusText(order.status)}
            </div>
          </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Customer</span>
              <span className="text-sm text-slate-800 font-medium">{order.customerName || 'N/A'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Phone</span>
              <span className="text-sm text-slate-800 font-medium">{order.customerPhone || 'Not provided'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Type</span>
              <span className="text-sm text-slate-800 font-medium">{order.orderType || 'N/A'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Date</span>
              <span className="text-sm text-slate-800 font-medium">
                {order.date && order.time 
                  ? `${order.date} at ${order.time}`
                  : order.createdAt 
                    ? new Date(order.createdAt).toLocaleString(undefined, { hour12: true })
                    : 'N/A'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 font-medium">Reference</span>
              <span className="text-sm text-slate-800 font-medium">{order.referenceNumber || 'N/A'}</span>
            </div>
          </div>

          {order.orderType === 'Delivery' && (
            <div className="bg-surface p-4 rounded-xl mb-6 border border-secondary/20">
              <h4 className="m-0 mb-2 text-primary-dark text-sm">Delivery Address</h4>
              {addressLoading ? (
                <p className="text-slate-400 italic">Loading address...</p>
              ) : (
                <>
                  <p className="m-0 mb-2 text-slate-800 font-medium">{address}</p>
                  {order.additionalDetails && (
                    <div className="my-2 p-3 bg-amber-50 rounded-md border-l-3 border-l-amber-500">
                      <span className="font-semibold text-amber-800 text-xs">Additional Instructions:</span>
                      <p className="m-1 text-amber-700 text-sm">{order.additionalDetails}</p>
                    </div>
                  )}
                  {coords && (
                    <div className="mt-2">
                      <button 
                        className="bg-none border-none text-primary cursor-pointer text-xs p-0 underline"
                        onClick={() => setShowRawLocation(!showRawLocation)}
                      >
                        {showRawLocation ? 'Hide Map' : 'Show on Map'}
                      </button>
                      {showRawLocation && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                          <iframe
                            title="Delivery Location"
                            width="100%"
                            height="250"
                            frameBorder="0"
                            scrolling="no"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(coords.lng) - 0.005},${parseFloat(coords.lat) - 0.005},${parseFloat(coords.lng) + 0.005},${parseFloat(coords.lat) + 0.005}&layer=mapnik&marker=${coords.lat},${coords.lng}`}
                            style={{ border: 0 }}
                          />
                          <div className="text-xs text-center text-slate-400 p-1 bg-slate-50">
                            <a 
                              href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}&zoom=15`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline"
                            >
                              View Larger Map
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mb-6">
            <h4 className="m-0 mb-3 text-slate-800 text-base">Order Items</h4>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b-2 border-slate-200 text-slate-500 font-semibold text-xs">Item</th>
                  <th className="text-left p-2 border-b-2 border-slate-200 text-slate-500 font-semibold text-xs">Qty</th>
                  <th className="text-left p-2 border-b-2 border-slate-200 text-slate-500 font-semibold text-xs">Price</th>
                </tr>
              </thead>
              <tbody>
                {order.pureWaterQty > 0 && (
                  <tr>
                    <td className="p-2.5 border-b border-slate-100">Pure Water (Gallon)</td>
                    <td className="p-2.5 border-b border-slate-100">×{order.pureWaterQty}</td>
                    <td className="p-2.5 border-b border-slate-100">₱{parseFloat(pureTotal).toFixed(2)}</td>
                  </tr>
                )}
                {order.springWaterQty > 0 && (
                  <tr>
                    <td className="p-2.5 border-b border-slate-100">Spring Water (Gallon)</td>
                    <td className="p-2.5 border-b border-slate-100">×{order.springWaterQty}</td>
                    <td className="p-2.5 border-b border-slate-100">₱{parseFloat(springTotal).toFixed(2)}</td>
                  </tr>
                )}
                {order.mineralWaterQty > 0 && (
                  <tr>
                    <td className="p-2.5 border-b border-slate-100">Mineral Water (Gallon)</td>
                    <td className="p-2.5 border-b border-slate-100">×{order.mineralWaterQty}</td>
                    <td className="p-2.5 border-b border-slate-100">₱{parseFloat(mineralTotal).toFixed(2)}</td>
                  </tr>
                )}
                {order.orderType === 'Delivery' && deliveryFee > 0 && (
                  <tr>
                    <td className="p-2.5 border-b border-slate-100">Delivery Fee</td>
                    <td className="p-2.5 border-b border-slate-100"></td>
                    <td className="p-2.5 border-b border-slate-100">₱{parseFloat(deliveryFee).toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                    <td className="p-2.5 border-b border-slate-100">Transaction Fee</td>
                    <td className="p-2.5 border-b border-slate-100"></td>
                    <td className="p-2.5 border-b border-slate-100">₱{parseFloat(transactionFee).toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2" className="border-b-0 border-t-2 border-slate-200 pt-3"><strong>Total</strong></td>
                  <td className="border-b-0 border-t-2 border-slate-200 pt-3"><strong>₱{parseFloat(grandTotal).toFixed(2)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="modal-status-actions">
            <h4 className="m-0 mb-3 text-slate-800 text-base">Update Status</h4>
            <div className="flex gap-3 flex-wrap">
              {(order.status === 'pending' || order.status === 'Pending') && (
                <>
                  <button onClick={() => handleStatusUpdate('confirmed')} disabled={isUpdating} className="px-5 py-2.5 border-none rounded-lg cursor-pointer font-semibold text-xs transition-all flex-1 min-w-[140px] flex items-center justify-center gap-2 shadow-sm text-white hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed bg-secondary hover:bg-primary-dark">
                    Confirm Order
                  </button>
                  <button onClick={() => handleStatusUpdate('cancelled')} disabled={isUpdating} className="px-5 py-2.5 border-none rounded-lg cursor-pointer font-semibold text-xs transition-all flex-1 min-w-[140px] flex items-center justify-center gap-2 shadow-sm text-white hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed bg-red-500 hover:bg-red-600">
                    Cancel Order
                  </button>
                </>
              )}
              {(order.status === 'confirmed' || order.status === 'Confirmed') && (
                <button onClick={() => handleStatusUpdate('preparing')} disabled={isUpdating} className="px-5 py-2.5 border-none rounded-lg cursor-pointer font-semibold text-xs transition-all flex-1 min-w-[140px] flex items-center justify-center gap-2 shadow-sm text-white hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed bg-primary hover:bg-primary-dark">
                  Start Preparing
                </button>
              )}
              {(order.status === 'preparing' || order.status === 'Preparing') && (
                <>
                  {order.orderType === 'Delivery' ? (
                    <button onClick={() => handleStatusUpdate('on_delivery')} disabled={isUpdating} className="px-5 py-2.5 border-none rounded-lg cursor-pointer font-semibold text-xs transition-all flex-1 min-w-[140px] flex items-center justify-center gap-2 shadow-sm text-white hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed bg-primary hover:bg-primary-dark">
                      Out for Delivery
                    </button>
                  ) : (
                    <button onClick={() => handleStatusUpdate('ready')} disabled={isUpdating} className="px-5 py-2.5 border-none rounded-lg cursor-pointer font-semibold text-xs transition-all flex-1 min-w-[140px] flex items-center justify-center gap-2 shadow-sm text-white hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-600">
                      Ready for Pickup
                    </button>
                  )}
                </>
              )}
              {(order.status === 'on_delivery' || order.status === 'On_Delivery' || order.status === 'ready' || order.status === 'Ready') && (
                <button onClick={() => handleStatusUpdate('completed')} disabled={isUpdating} className="px-5 py-2.5 border-none rounded-lg cursor-pointer font-semibold text-xs transition-all flex-1 min-w-[140px] flex items-center justify-center gap-2 shadow-sm text-white hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed bg-secondary hover:bg-primary-dark">
                  Mark as Completed
                </button>
              )}
              {(order.status === 'completed' || order.status === 'Completed' || 
                order.status === 'cancelled' || order.status === 'Cancelled' ||
                order.status === 'delivered' || order.status === 'Delivered') && (
                <div className="text-center p-3 bg-slate-100 rounded-lg text-slate-500 font-medium">
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
  const [alertProps, showAlert, closeAlert] = useAlert();
  const [activeSection, setActiveSection] = useState('orders');
  const [stationData, setStationData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todaysRevenue: 0,
    mostBoughtWater: 'N/A',
    topLocation: 'N/A'
  });
  const [activeTab, setActiveTab] = useState('all');
  const [, setLoading] = useState(true);
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
        mostBought = `Spring Water (${springCount} gallons)`;
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

  const getFilteredOrders = () => {
    if (activeTab === 'all') return orders;
    
    return orders.filter(order => {
      const status = (order.status || '').toLowerCase();
      
      if (activeTab === 'pending') return status === 'pending';
      if (activeTab === 'confirmed') return status === 'confirmed';
      if (activeTab === 'preparing') return status === 'preparing';
      if (activeTab === 'for_pickup') return status === 'ready';
      if (activeTab === 'for_delivery') return status === 'on_delivery';
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
    setSelectedOrder(prev => 
      prev && (prev.orderId || prev.id) === orderId
        ? { ...prev, status: newStatus }
        : prev
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
              console.log("DASHBOARD - Matched order:", order.id || order.orderId, "StationId:", order.stationId);
            }
            return matches;
          });

          console.log("DASHBOARD - Station orders filtered:", stationOrders.length);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showAlert({ type: 'error', message: 'Failed to logout. Please try again.' });
    }
  };

  if (stationData && stationData.status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark font-sans relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 1440 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#9EB3C2" d="M0,200L48,213.3C96,226.7,192,253.3,288,250.7C384,248,480,216,576,213.3C672,210.7,768,237.3,864,245.3C960,253.3,1056,242.7,1152,224C1248,205.3,1344,178.7,1392,165.3L1440,152L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
          <path fill="#ffffff" d="M0,350L48,338.7C96,327.3,192,304.7,288,320C384,335.3,480,388.7,576,396C672,403.3,768,364.7,864,346.7C960,328.7,1056,331.3,1152,352C1248,372.7,1344,411.3,1392,430.7L1440,450L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
          <path fill="#9EB3C2" d="M0,550L48,565.3C96,580.7,192,611.3,288,608C384,604.7,480,568,576,554.7C672,541.3,768,552,864,578.7C960,605.3,1056,648,1152,632C1248,616,1344,541.3,1392,504L1440,466.7L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
        </svg>
        <div className="relative z-10">
          <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-6 shadow-sm">
            <div className="flex justify-between items-center max-w-[1200px] mx-auto flex-wrap gap-4">
              <div className="header-info">
                <h1 className="text-slate-800 m-0 mb-1 text-2xl md:text-3xl">Pending Approval</h1>
                <p className="text-slate-600 text-sm m-1 flex items-center gap-1">
                  {stationData.stationName || 'Your Station'}
                </p>
              </div>
              <button onClick={handleLogout} className="bg-primary-darkest text-white border-none px-4 py-2 rounded-md cursor-pointer font-medium ml-auto hover:brightness-110">
                Logout
              </button>
            </div>
          </header>

        <div className="max-w-[800px] mx-auto my-8 p-6 sm:p-12 bg-white rounded-xl shadow-sm text-center">
          <div className="text-4xl md:text-6xl mb-6 opacity-70"></div>
          <h2 className="text-slate-800 mb-4">Your station is pending admin approval</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">Thank you for registering! An administrator will review your application soon.</p>
          <p className="text-slate-500 mb-8 leading-relaxed">You will receive an email notification once your station is approved.</p>
          
          <div className="text-left max-w-md mx-auto">
            <h3 className="text-slate-800 mb-4 text-lg">What happens next?</h3>
            <ul className="list-disc pl-5 text-left">
              <li className="mb-2 text-slate-600">Admin reviews your business permit and station details</li>
              <li className="mb-2 text-slate-600">You'll receive an email notification (usually within 24-48 hours)</li>
              <li className="mb-2 text-slate-600">Once approved, you can start accepting orders!</li>
            </ul>
          </div>
          
          <div className="flex gap-4 justify-center mt-8">
            <button 
              className="bg-slate-500 text-white px-8 py-4 rounded-lg font-semibold cursor-pointer transition-all hover:bg-slate-600"
              onClick={() => window.location.href = 'mailto:support@aquallera.com'}
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
      </div>
    );
  }

  if (stationData && stationData.status === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark font-sans relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 1440 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#9EB3C2" d="M0,200L48,213.3C96,226.7,192,253.3,288,250.7C384,248,480,216,576,213.3C672,210.7,768,237.3,864,245.3C960,253.3,1056,242.7,1152,224C1248,205.3,1344,178.7,1392,165.3L1440,152L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
          <path fill="#ffffff" d="M0,350L48,338.7C96,327.3,192,304.7,288,320C384,335.3,480,388.7,576,396C672,403.3,768,364.7,864,346.7C960,328.7,1056,331.3,1152,352C1248,372.7,1344,411.3,1392,430.7L1440,450L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
          <path fill="#9EB3C2" d="M0,550L48,565.3C96,580.7,192,611.3,288,608C384,604.7,480,568,576,554.7C672,541.3,768,552,864,578.7C960,605.3,1056,648,1152,632C1248,616,1344,541.3,1392,504L1440,466.7L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
        </svg>
        <div className="relative z-10">
          <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-6 shadow-sm">
            <div className="flex justify-between items-center max-w-[1200px] mx-auto flex-wrap gap-4">
              <div className="header-info">
                <h1 className="text-slate-800 m-0 mb-1 text-2xl md:text-3xl">Registration Rejected</h1>
                <p className="text-slate-600 text-sm m-1 flex items-center gap-1">
                  {stationData.stationName || 'Your Station'}
                </p>
              </div>
              <button onClick={handleLogout} className="bg-primary-darkest text-white border-none px-4 py-2 rounded-md cursor-pointer font-medium ml-auto hover:brightness-110">
                Logout
              </button>
            </div>
          </header>

        <div className="max-w-[800px] mx-auto my-8 p-6 sm:p-12 bg-white rounded-xl shadow-sm text-center">
          <div className="text-4xl md:text-6xl mb-6 text-red-600"></div>
          <h2 className="text-slate-800 mb-4">Station Registration Rejected</h2>
          
          {stationData.rejectionReason && (
            <div className="bg-red-50 p-6 rounded-lg my-8 border border-red-200 text-left">
              <h3 className="text-red-600 mb-2">Reason for Rejection:</h3>
              <p className="text-red-800 leading-relaxed">{stationData.rejectionReason}</p>
            </div>
          )}
          
          <div className="flex gap-4 justify-center mt-8 flex-wrap">
            <button 
              className="bg-primary text-white px-8 py-4 rounded-lg font-semibold cursor-pointer transition-all hover:bg-primary-dark"
              onClick={() => navigate('/signup')}
            >
              Re-apply with Corrections
            </button>
            <button 
              className="bg-slate-500 text-white px-8 py-4 rounded-lg font-semibold cursor-pointer transition-all hover:bg-slate-600"
              onClick={() => window.location.href = 'mailto:support@aquallera.com'}
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark font-sans relative overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 1440 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#9EB3C2" d="M0,200L48,213.3C96,226.7,192,253.3,288,250.7C384,248,480,216,576,213.3C672,210.7,768,237.3,864,245.3C960,253.3,1056,242.7,1152,224C1248,205.3,1344,178.7,1392,165.3L1440,152L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
        <path fill="#ffffff" d="M0,350L48,338.7C96,327.3,192,304.7,288,320C384,335.3,480,388.7,576,396C672,403.3,768,364.7,864,346.7C960,328.7,1056,331.3,1152,352C1248,372.7,1344,411.3,1392,430.7L1440,450L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
        <path fill="#9EB3C2" d="M0,550L48,565.3C96,580.7,192,611.3,288,608C384,604.7,480,568,576,554.7C672,541.3,768,552,864,578.7C960,605.3,1056,648,1152,632C1248,616,1344,541.3,1392,504L1440,466.7L1440,900L1392,900C1344,900,1248,900,1152,900C1056,900,960,900,864,900C768,900,672,900,576,900C480,900,384,900,288,900C192,900,96,900,48,900L0,900Z"/>
      </svg>
      <div className="relative z-10">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 sm:py-6 shadow-sm">
          <div className="flex justify-between items-start sm:items-center max-w-[1200px] mx-auto flex-col sm:flex-row gap-4">
            <div className="header-info">
              <h1 className="text-slate-800 m-0 mb-1 text-2xl md:text-3xl">
                {stationData && stationData.stationName 
                  ? `${stationData.stationName} Dashboard`
                  : "Station Dashboard"
                }
              </h1>
            
            {stationData && (stationData.city || stationData.address) && (
              <p className="text-slate-600 text-sm m-1 flex items-center gap-1">
                {stationData.address || ''} 
                {stationData.address && stationData.city ? ', ' : ''}
                {stationData.city || ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex gap-1 sm:gap-2">
              <button 
                className={`px-2 sm:px-6 py-1.5 sm:py-3 border-2 rounded-lg cursor-pointer transition-all font-medium flex items-center gap-2 text-[11px] sm:text-sm ${activeSection === 'orders' ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-gray-700 hover:border-primary hover:bg-slate-50'}`}
                onClick={() => setActiveSection('orders')}
              >
                Orders
              </button>
              <button 
                className={`px-2 sm:px-6 py-1.5 sm:py-3 border-2 rounded-lg cursor-pointer transition-all font-medium flex items-center gap-2 text-[11px] sm:text-sm ${activeSection === 'stock' ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-gray-700 hover:border-primary hover:bg-slate-50'}`}
                onClick={() => setActiveSection('stock')}
              >
                Stock & Analytics
              </button>
              <button 
                className={`px-2 sm:px-6 py-1.5 sm:py-3 border-2 rounded-lg cursor-pointer transition-all font-medium flex items-center gap-2 text-[11px] sm:text-sm ${activeSection === 'settings' ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-gray-700 hover:border-primary hover:bg-slate-50'}`}
                onClick={() => setActiveSection('settings')}
              >
                Settings
              </button>
            </div>
            <div className="flex items-center gap-2 bg-secondary/5 px-2 sm:px-4 py-1 sm:py-2 rounded-full border border-secondary/20 text-[10px] sm:text-sm text-primary-dark">
              <div className="w-2 h-2 rounded-full bg-secondary animate-[pulse_2s_infinite]"></div>
              <span>Online</span>
            </div>
            <button onClick={handleLogout} className="bg-primary-darkest text-white border-none px-3 py-1 rounded cursor-pointer text-xs sm:text-sm hover:brightness-110">
              Logout
            </button>
          </div>
        </div>
      </header>

      {activeSection === 'orders' && (
        <>
          <section className="max-w-[1200px] mx-auto px-4 sm:px-8 py-4 sm:py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <h2 className="text-white m-0 text-xl md:text-2xl">Order Management</h2>
              <div className="relative">
                <select 
                  className="appearance-none bg-white border-2 border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-slate-800 cursor-pointer min-w-[200px] transition-all hover:border-primary focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.15)]"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="for_pickup">For Pickup</option>
                  <option value="for_delivery">For Delivery</option>
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
              showAlert={showAlert}
            />
          )}
        </>
      )}

      {activeSection === 'stock' && <Stock />}
      {activeSection === 'settings' && <Settings stationData={stationData} setStationData={setStationData} />}

      {alertProps && <AlertCard {...alertProps} onClose={closeAlert} />}
      </div>
    </div>
  );
};

export default Dashboard;