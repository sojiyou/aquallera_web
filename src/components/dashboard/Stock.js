// src/components/dashboard/Stock.js
import React, { useState, useEffect, useRef } from 'react';
import './Stock.css';
import { ref, onValue, update } from 'firebase/database';
import { database, auth } from '../config/Firebase';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import HistoricalPerformance from './HistoricalPerformance';
import AnnualReports from './AnnualReports';
import WaterConsumptionAnalytics from './WaterConsumptionAnalytics';
// predictive analytics imports
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getCurrentDateInfo } from '../../utils/revenueCalculator';
import {
  getCurrentMonthProjection,
  getYearProjections,
  getConfidenceLevel,
} from '../../utils/revenueProjection';
import {
  getRechartsMonthlyData,
  getChartConfig,
} from '../../utils/chartDataFormatter';
import { getRevenueCache, useYearComparison } from '../../utils/revenueCache';

// Mapbox Geocoding Function (same as Dashboard.js)
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

const Stock = () => {
  const [stationData, setStationData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stock, setStock] = useState({
    pureWater: 0,
    springWater: 0,
    mineralWater: 0,
  });
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todaysRevenue: 0,
    mostBoughtWater: 'N/A',
    topLocation: 'N/A',
  });
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState(false);
  const [tempStock, setTempStock] = useState({
    pureWater: 0,
    springWater: 0,
    mineralWater: 0,
  });
  const navigate = useNavigate();

  // ===== View Mode State =====
  const [dataViewMode, setDataViewMode] = useState('monthly'); // 'monthly' or 'annual'

  // ===== Toggle States =====
  const [showConsumptionAnalytics, setShowConsumptionAnalytics] = useState(false);

  // ===== Predictive Revenue State =====
  const [revenueProjection, setRevenueProjection] = useState(null);
  const [yearForecast, setYearForecast] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [yearComparison, setYearComparison] = useState(null);
  const [projectionConfidence, setProjectionConfidence] = useState(null);
  const [projectionLoading, setProjectionLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const cacheRef = useRef(null);
  // =====================================

  // ===== Toggle Functions =====
  const toggleConsumptionAnalytics = () => {
    setShowConsumptionAnalytics(!showConsumptionAnalytics);
  };

  // Extract coordinates from location string
  const extractLatLng = (locationString) => {
    if (!locationString) return null;

    try {
      const latMatch = locationString.match(/Lat:\s*([-\d.]+)/);
      const lngMatch = locationString.match(/Lng:\s*([-\d.]+)/);

      if (latMatch && lngMatch) {
        return {
          lat: parseFloat(latMatch[1]),
          lng: parseFloat(lngMatch[1]),
        };
      }
    } catch (error) {
      console.error('Failed to extract coordinates:', error);
    }

    return null;
  };

  // Calculate stats from orders
  const calculateStats = async (orderList) => {
    const total = orderList.length;
    const pending = orderList.filter(
      (order) => order.status === 'pending' || order.status === 'Pending'
    ).length;
    const completed = orderList.filter(
      (order) =>
        order.status === 'completed' ||
        order.status === 'Completed' ||
        order.status === 'delivered' ||
        order.status === 'Delivered'
    ).length;

    const revenue = orderList
      .filter(
        (order) =>
          order.status === 'completed' ||
          order.status === 'Completed' ||
          order.status === 'delivered' ||
          order.status === 'Delivered'
      )
      .reduce((sum, order) => {
        const pureTotal = parseFloat(order.pureWaterTotal) || 0;
        const springTotal = parseFloat(order.springWaterTotal) || 0;
        const mineralTotal = parseFloat(order.mineralWaterTotal) || 0;
        const deliveryFee = parseFloat(order.deliveryFee) || 0;
        return sum + pureTotal + springTotal + mineralTotal + deliveryFee;
      }, 0);

    let pureCount = 0, springCount = 0, mineralCount = 0;
    orderList.forEach((order) => {
      pureCount += parseInt(order.pureWaterQty) || 0;
      springCount += parseInt(order.springWaterQty) || 0;
      mineralCount += parseInt(order.mineralWaterQty) || 0;
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

      const address = await convertCoordinatesToAddress(coords.lat, coords.lng);

      if (
        address &&
        address !== 'Unknown' &&
        address !== 'No location provided'
      ) {
        locationCounts[address] = (locationCounts[address] || 0) + 1;
      }
    }

    let topLocation = 'No orders yet';
    if (Object.keys(locationCounts).length > 0) {
      const sortedLocations = Object.entries(locationCounts).sort(
        (a, b) => b[1] - a[1]
      );
      const topCity = sortedLocations[0];
      topLocation = `${topCity[0]} (${topCity[1]} orders)`;
    }

    setStats({
      totalOrders: total,
      pendingOrders: pending,
      completedOrders: completed,
      todaysRevenue: revenue,
      mostBoughtWater: mostBought,
      topLocation: topLocation,
    });
  };

  // Generate predictive insights
  const generateInsights = (orderList, stockData) => {
    const insights = [];

    let pureCount = 0, springCount = 0, mineralCount = 0;
    orderList.forEach((order) => {
      pureCount += parseInt(order.pureWaterQty) || 0;
      springCount += parseInt(order.springWaterQty) || 0;
      mineralCount += parseInt(order.mineralWaterQty) || 0;
    });

    if (pureCount > springCount && pureCount > mineralCount && pureCount > 0) {
      if (stockData.pureWater < 20) {
        insights.push({
          type: 'warning',
          icon: '💧',
          title: 'Increase Pure Water Stock',
          message: `Pure Water is your top seller (${pureCount} gallons sold) but stock is low (${stockData.pureWater} left). Consider ordering more to meet demand.`,
          action: 'Restock Pure Water',
        });
      } else {
        insights.push({
          type: 'success',
          icon: '💧',
          title: 'Pure Water Performing Well',
          message: `Pure Water is your best seller with ${pureCount} gallons sold. Current stock (${stockData.pureWater}) looks good!`,
          action: 'Maintain Stock Level',
        });
      }
    } else if (springCount > pureCount && springCount > mineralCount && springCount > 0) {
      if (stockData.springWater < 20) {
        insights.push({
          type: 'warning',
          icon: '🌊',
          title: 'Increase Spring Water Stock',
          message: `Spring Water is your top seller (${springCount} liters sold) but stock is low (${stockData.springWater} left). Consider ordering more to meet demand.`,
          action: 'Restock Spring Water',
        });
      } else {
        insights.push({
          type: 'success',
          icon: '🌊',
          title: 'Spring Water Performing Well',
          message: `Spring Water is your best seller with ${springCount} liters sold. Current stock (${stockData.springWater}) looks good!`,
          action: 'Maintain Stock Level',
        });
      }
    } else if (mineralCount > 0 && mineralCount >= pureCount && mineralCount >= springCount) {
      if (stockData.mineralWater < 20) {
        insights.push({
          type: 'warning',
          icon: '⛰️',
          title: 'Increase Mineral Water Stock',
          message: `Mineral Water is your top seller (${mineralCount} gallons sold) but stock is low (${stockData.mineralWater} left). Consider ordering more to meet demand.`,
          action: 'Restock Mineral Water',
        });
      } else {
        insights.push({
          type: 'success',
          icon: '⛰️',
          title: 'Mineral Water Performing Well',
          message: `Mineral Water is your best seller with ${mineralCount} gallons sold. Current stock (${stockData.mineralWater}) looks good!`,
          action: 'Maintain Stock Level',
        });
      }
    }

    return insights;
  };

  // ===== Core projection loader =====
  const loadProjectionData = async (forceRefresh = false) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const stationId = user.uid;

      if (!cacheRef.current) {
        cacheRef.current = getRevenueCache(stationId);
      }

      let projections;

      if (!forceRefresh && !cacheRef.current.shouldRecalculate()) {
        const cached = cacheRef.current.getCachedYearProjection();
        if (cached) {
          projections = cached;
          setYearForecast(projections);
        }
      }

      if (!projections || forceRefresh) {
        projections = await getYearProjections(stationId);
        setYearForecast(projections);

        if (projections.hasMinimumData) {
          await cacheRef.current.cacheYearProjection(projections);
        }
      }

      if (projections?.currentMonth) {
        const { year, month, projectedRevenue, dailyAverage } = projections.currentMonth;

        const chart = await getRechartsMonthlyData(
          stationId,
          year,
          month,
          dailyAverage || 0
        );
        setChartData(chart.chartData || []);

        const { year: currentYear, month: currentMonth, day } = getCurrentDateInfo();
        if (currentMonth === month && currentYear === year) {
          const confidence = getConfidenceLevel(day);
          setProjectionConfidence(confidence);
        }

        setRevenueProjection(projections.currentMonth);
      }

      const comparison = await cacheRef.current.getYearComparison();
      setYearComparison(comparison);

      const today = new Date();
      if (today.getMonth() === 0 && today.getDate() === 1) {
        await cacheRef.current.archiveYearData();
      }

      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error loading revenue projections:', error);
    }
  };

  // ===== Manual Refresh Handler =====
  const handleRefreshProjections = async () => {
    setIsRefreshing(true);
    await loadProjectionData(true);
    setIsRefreshing(false);
  };

  // ===== Update Projections When Orders Change =====
  useEffect(() => {
    const updateProjections = async () => {
      try {
        const user = auth.currentUser;
        if (!user || !orders.length) return;

        const stationId = user.uid;

        if (cacheRef.current?.shouldRecalculate()) {
          const projections = await getYearProjections(stationId);
          setYearForecast(projections);

          if (projections.hasMinimumData) {
            await cacheRef.current.cacheYearProjection(projections);
          }

          if (projections?.currentMonth) {
            const { year, month, dailyAverage } = projections.currentMonth;
            const chart = await getRechartsMonthlyData(
              stationId,
              year,
              month,
              dailyAverage || 0
            );
            setChartData(chart.chartData || []);
            setRevenueProjection(projections.currentMonth);

            const { day } = getCurrentDateInfo();
            const confidence = getConfidenceLevel(day);
            setProjectionConfidence(confidence);
          }

          const comparison = await cacheRef.current.getYearComparison();
          setYearComparison(comparison);
        }

        if (cacheRef.current) {
          const currentYear = new Date().getFullYear();
          let total = 0;
          for (let month = 0; month <= 11; month++) {
            const { calculateMonthlyRevenue } = await import('../../utils/revenueCalculator');
            total += await calculateMonthlyRevenue(stationId, currentYear, month);
          }
          await cacheRef.current.updateYearlyTotal(currentYear, total);
        }
      } catch (error) {
        console.error('Error updating projections:', error);
      }
    };

    if (orders.length > 0 && cacheRef.current) {
      updateProjections();
    }
  }, [orders]);

  // ===== Initialize Revenue Cache and Load Projections =====
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadProjectionData(false).finally(() => setProjectionLoading(false));
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Fetch data
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const stationRef = ref(database, `waterStations/${user.uid}`);
      const unsubscribeStation = onValue(stationRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setStationData(data);

          const stockData = {
            pureWater: data.stock_pureWater || 0,
            springWater: data.stock_springWater || 0,
            mineralWater: data.stock_mineralWater || 0,
          };

          setStock(stockData);
          setTempStock(stockData);
        } else {
          setStationData(null);
        }
        setLoading(false);
      });

      const ordersRef = ref(database, 'orders');
      const unsubscribeOrders = onValue(ordersRef, async (snapshot) => {
        if (snapshot.exists()) {
          const ordersData = snapshot.val();
          const ordersArray = Object.entries(ordersData).map(([key, value]) => ({
            id: key,
            ...value,
          }));

          const stationOrders = ordersArray.filter(
            (order) => order.stationId === user.uid
          );

          setOrders(stationOrders);
          await calculateStats(stationOrders);

          const newInsights = generateInsights(stationOrders, stock);
          setInsights(newInsights);
        } else {
          setOrders([]);
          await calculateStats([]);

          const newInsights = generateInsights([], stock);
          setInsights(newInsights);
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

  // Update insights when stock changes
  useEffect(() => {
    if (orders.length >= 0) {
      const newInsights = generateInsights(orders, stock);
      setInsights(newInsights);
    }
  }, [stock, orders]);

  const handleStockChange = (e) => {
    const { name, value } = e.target;
    setTempStock((prev) => ({
      ...prev,
      [name]: parseInt(value) || 0,
    }));
  };

  const handleSaveStock = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const stationRef = ref(database, `waterStations/${user.uid}`);

      await update(stationRef, {
        stock_pureWater: tempStock.pureWater,
        stock_springWater: tempStock.springWater,
        stock_mineralWater: tempStock.mineralWater,
        stockUpdatedAt: new Date().toISOString(),
      });

      setStock(tempStock);
      setEditingStock(false);
      alert('✅ Stock updated successfully!');
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('❌ Failed to update stock. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setTempStock(stock);
    setEditingStock(false);
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toFixed(2)}`;
  };

  const getStockStatus = (quantity) => {
    if (quantity === 0) return { label: 'Out of Stock', color: '#183229' };
    if (quantity < 10) return { label: 'Low Stock', color: '#183229' };
    if (quantity < 50) return { label: 'Normal', color: '#183229' };
    return { label: 'Stock', color: '#183229' };
  };

  const formatLastRefreshed = (date) => {
    if (!date) return null;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="stock-container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading stock data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stock-container">
      <div className="stock-header">
        <div className="header-info">
          <h1>📦 Stock & Analytics</h1>
          <p>Manage your inventory and view business insights</p>
        </div>
      </div>

      {/* Analytics Section */}
      <section className="analytics-section">
        <div className="section-header">
          <h2>📊 Business Analytics</h2>
        </div>

        <div className="stats-overview">
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
              <p>Completed Orders</p>
            </div>
          </div>

          <div className="stat-card revenue">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <h3>{formatCurrency(stats.todaysRevenue)}</h3>
              <p>Total Revenue</p>
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
        </div>
      </section>

      {/* Stock Inventory Section */}
      <section className="stock-inventory-section">
        <div className="section-header">
          <h2>💧 Water Stock Inventory</h2>
          {!editingStock ? (
            <button className="btn-edit-stock" onClick={() => setEditingStock(true)}>
              ✏️ Edit Stock
            </button>
          ) : (
            <div className="edit-actions">
              <button className="btn-save" onClick={handleSaveStock}>✓ Save</button>
              <button className="btn-cancel" onClick={handleCancelEdit}>✕ Cancel</button>
            </div>
          )}
        </div>

        <div className="stock-grid">
          <div className="stock-card pure">
            <div className="stock-icon">💧</div>
            <h3>Pure Water (Gallons)</h3>
            {editingStock ? (
              <input type="number" name="pureWater" value={tempStock.pureWater} onChange={handleStockChange} className="stock-input" min="0" />
            ) : (
              <div className="stock-quantity">{stock.pureWater}</div>
            )}
            <div className="stock-status" style={{ color: getStockStatus(stock.pureWater).color }}>
              {getStockStatus(stock.pureWater).label}
            </div>
          </div>

          <div className="stock-card spring">
            <div className="stock-icon">🌊</div>
            <h3>Spring Water (Liters)</h3>
            {editingStock ? (
              <input type="number" name="springWater" value={tempStock.springWater} onChange={handleStockChange} className="stock-input" min="0" />
            ) : (
              <div className="stock-quantity">{stock.springWater}</div>
            )}
            <div className="stock-status" style={{ color: getStockStatus(stock.springWater).color }}>
              {getStockStatus(stock.springWater).label}
            </div>
          </div>

          <div className="stock-card mineral">
            <div className="stock-icon">⛰️</div>
            <h3>Mineral Water (Gallons)</h3>
            {editingStock ? (
              <input type="number" name="mineralWater" value={tempStock.mineralWater} onChange={handleStockChange} className="stock-input" min="0" />
            ) : (
              <div className="stock-quantity">{stock.mineralWater}</div>
            )}
            <div className="stock-status" style={{ color: getStockStatus(stock.mineralWater).color }}>
              {getStockStatus(stock.mineralWater).label}
            </div>
          </div>
        </div>
      </section>

      {/* Stock Alerts */}
      <section className="stock-alerts-section">
        <h3>⚠️ Stock Alerts</h3>
        <div className="alerts-list">
          {stock.pureWater === 0 && <div className="alert alert-danger"><span className="alert-icon">🚨</span><span>Pure Water is out of stock!</span></div>}
          {stock.pureWater > 0 && stock.pureWater < 10 && <div className="alert alert-warning"><span className="alert-icon">⚠️</span><span>Pure Water is running low ({stock.pureWater} gallons left)</span></div>}
          {stock.springWater === 0 && <div className="alert alert-danger"><span className="alert-icon">🚨</span><span>Spring Water is out of stock!</span></div>}
          {stock.springWater > 0 && stock.springWater < 10 && <div className="alert alert-warning"><span className="alert-icon">⚠️</span><span>Spring Water is running low ({stock.springWater} liters left)</span></div>}
          {stock.mineralWater === 0 && <div className="alert alert-danger"><span className="alert-icon">🚨</span><span>Mineral Water is out of stock!</span></div>}
          {stock.mineralWater > 0 && stock.mineralWater < 10 && <div className="alert alert-warning"><span className="alert-icon">⚠️</span><span>Mineral Water is running low ({stock.mineralWater} liters left)</span></div>}
          {stock.pureWater >= 10 && stock.springWater >= 10 && stock.mineralWater >= 10 && (
            <div className="alert alert-success"><span className="alert-icon">✅</span><span>All water types are well stocked!</span></div>
          )}
        </div>
      </section>

      {/* Annual Performance Reports Section with Toggle */}
      <section className="predictive-insights-section">
        <div className="section-header">
          <h2>📊 Performance Reports</h2>
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${dataViewMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setDataViewMode('monthly')}
            >
              📅 Monthly View
            </button>
            <button 
              className={`toggle-btn ${dataViewMode === 'annual' ? 'active' : ''}`}
              onClick={() => setDataViewMode('annual')}
            >
              📈 Annual View
            </button>
          </div>
        </div>

        {/* Revenue Projection Card - ALWAYS VISIBLE */}
        {!projectionLoading && revenueProjection && yearForecast?.hasMinimumData ? (
          <div className="revenue-projection-big-card">
            <div className="revenue-projection-header">
              <div className="revenue-title-section">
                <span className="revenue-icon">📈</span>
                <div>
                  <h3>{revenueProjection.monthName} {revenueProjection.year} Revenue Projection</h3>
                  <p className="revenue-subtitle">Based on {revenueProjection.daysPassed} days of actual data • {revenueProjection.daysRemaining} days remaining</p>
                </div>
              </div>
              <div className="revenue-header-right">
                {projectionConfidence && (
                  <div className="confidence-badge" style={{ backgroundColor: `${projectionConfidence.color}20`, color: projectionConfidence.color }}>
                    <span className="confidence-dot" style={{ backgroundColor: projectionConfidence.color }}></span>
                    {projectionConfidence.level} Confidence
                  </div>
                )}
                <div className="refresh-controls">
                  <button className={`btn-refresh-projection ${isRefreshing ? 'refreshing' : ''}`} onClick={handleRefreshProjections} disabled={isRefreshing}>
                    <span className={`refresh-icon ${isRefreshing ? 'spin' : ''}`}>↻</span>
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                  {lastRefreshed && !isRefreshing && <span className="last-refreshed">Updated {formatLastRefreshed(lastRefreshed)}</span>}
                </div>
              </div>
            </div>

            <div className="revenue-stats-grid">
              <div className="revenue-stat-item">
                <span className="stat-label">Revenue to Date</span>
                <span className="stat-value actual">₱{revenueProjection.currentRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                <span className="stat-period">{revenueProjection.daysPassed} days</span>
              </div>
              <div className="revenue-stat-item">
                <span className="stat-label">Projected End of Month</span>
                <span className="stat-value projected">₱{revenueProjection.projectedRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                <span className="stat-period">Target</span>
              </div>
              <div className="revenue-stat-item">
                <span className="stat-label">Daily Average</span>
                <span className="stat-value daily-average">₱{revenueProjection.dailyAverage?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                <span className="stat-period">per day</span>
              </div>
              <div className="revenue-stat-item">
                <span className="stat-label">Remaining Potential</span>
                <span className="stat-value potential">₱{(revenueProjection.projectedRevenue - revenueProjection.currentRevenue)?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                <span className="stat-period">{revenueProjection.daysRemaining} days left</span>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="revenue-chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tickFormatter={(day) => `Day ${day}`} stroke="#64748b" />
                    <YAxis tickFormatter={(value) => `₱${(value/1000).toFixed(0)}k`} stroke="#64748b" />
                    <Tooltip formatter={(value) => [`₱${value?.toLocaleString() || 0}`, 'Revenue']} labelFormatter={(label) => `Day ${label}`} />
                    <Legend />
                    <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: "#2563eb" }} name="Actual Revenue" />
                    <Line type="monotone" dataKey="projected" stroke="#94a3b8" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: "#94a3b8" }} name="Projected Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {yearForecast?.futureMonths?.length > 0 && (
              <div className="year-forecast-section">
                <div className="forecast-header">
                  <h4>📅 {yearForecast.year} Year Forecast</h4>
                  <span className="total-projection">Total Projected: ₱{yearForecast.totalYearProjection?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="forecast-grid">
                  <div className="forecast-month current-month">
                    <span className="month-name">{revenueProjection.monthName}</span>
  <span className="month-value">₱{revenueProjection.projectedRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    <span className="month-badge">Current</span>
                  </div>
                  {yearForecast.futureMonths.map((month, index) => (
                    <div key={index} className="forecast-month">
                      <span className="month-name">{month.monthName}</span>
                      <span className="month-value">₱{month.projectedRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {yearComparison && yearComparison.hasPreviousYearData && (
              <div className="year-comparison-section">
                <div className="comparison-header">
                  <h4>📊 {yearComparison.previousYear} vs {yearComparison.currentYear}</h4>
                </div>
                <div className="comparison-bars">
                  <div className="comparison-item">
                    <span className="comparison-year">{yearComparison.previousYear}</span>
                    <div className="bar-container">
                      <div className="bar previous" style={{ width: `${Math.min((yearComparison.previousYearTotal / (yearComparison.currentYearTotal || 1)) * 100, 100)}%` }}>
                        ₱{yearComparison.previousYearTotal?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="comparison-item">
                    <span className="comparison-year">{yearComparison.currentYear}</span>
                    <div className="bar-container">
                      <div className="bar current" style={{ width: '100%' }}>₱{yearComparison.currentYearTotal?.toLocaleString()}</div>
                    </div>
                  </div>
                  {yearComparison.growthPercentage !== null && (
                    <div className="growth-indicator">
                      {yearComparison.growthPercentage > 0 ? '📈' : '📉'} {Math.abs(yearComparison.growthPercentage).toFixed(1)}% {yearComparison.growthPercentage > 0 ? 'growth' : 'decline'} from last year
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="revenue-projection-placeholder">
            <div className="placeholder-icon">📊</div>
            <h3>Monthly Revenue Prediction</h3>
            <p>{projectionLoading ? 'Loading revenue projections...' : `Predictions will be available on ${new Date(new Date().getFullYear(), new Date().getMonth(), 4).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`}</p>
            {!projectionLoading && (
              <div className="placeholder-progress">
                <div className="progress-dots"><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
                <span>We're calibrating the prediction system. Check back in {4 - new Date().getDate()} day{4 - new Date().getDate() !== 1 ? 's' : ''}!</span>
              </div>
            )}
          </div>
        )}

        {/* Conditional: Monthly View vs Annual View */}
        {dataViewMode === 'monthly' ? (
          <HistoricalPerformance stationId={auth.currentUser?.uid} />
        ) : (
          <AnnualReports stationId={auth.currentUser?.uid} />
        )}
      </section>

      {/* Water Consumption Analytics Section */}
      <div className="toggle-section-wrapper">
        <div className="toggle-section-header" onClick={toggleConsumptionAnalytics}>
          <div className="toggle-section-title">
            <span className="toggle-section-icon">💧</span>
            <h3>Water Consumption</h3>
            <span className="toggle-section-badge">Volume tracking</span>
          </div>
          <div className={`toggle-section-arrow ${showConsumptionAnalytics ? 'rotated' : ''}`}>▶</div>
        </div>
        {showConsumptionAnalytics && (
          <div className="toggle-section-content">
            <WaterConsumptionAnalytics stationId={auth.currentUser?.uid} currentStock={stock} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Stock;