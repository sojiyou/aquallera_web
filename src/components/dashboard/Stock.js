// src/components/dashboard/Stock.js
import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database, auth } from '../config/Firebase';
import AlertCard, { useAlert } from '../admin/AlertCard';
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
  getYearProjections,
  getConfidenceLevel,
} from '../../utils/revenueProjection';
import {
  getRechartsMonthlyData,
} from '../../utils/chartDataFormatter';
import { getRevenueCache } from '../../utils/revenueCache';

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
  const [alertProps, showAlert, closeAlert] = useAlert();
  const [, setStationData] = useState(null);
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
  const [, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState(false);
  const [tempStock, setTempStock] = useState({
    pureWater: 0,
    springWater: 0,
    mineralWater: 0,
  });
  // ===== View Mode State =====
  const [dataViewMode, setDataViewMode] = useState('monthly'); // 'monthly' or 'annual'

  // ===== Toggle States =====
  const [showConsumptionAnalytics, setShowConsumptionAnalytics] = useState(false);
  const [showRevenueAnalytics, setShowRevenueAnalytics] = useState(true);

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

  const toggleRevenueAnalytics = () => {
    setShowRevenueAnalytics(!showRevenueAnalytics);
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
          title: 'Increase Pure Water Stock',
          message: `Pure Water is your top seller (${pureCount} gallons sold) but stock is low (${stockData.pureWater} left). Consider ordering more to meet demand.`,
          action: 'Restock Pure Water',
        });
      } else {
        insights.push({
          type: 'success',
          title: 'Pure Water Performing Well',
          message: `Pure Water is your best seller with ${pureCount} gallons sold. Current stock (${stockData.pureWater}) looks good!`,
          action: 'Maintain Stock Level',
        });
      }
    } else if (springCount > pureCount && springCount > mineralCount && springCount > 0) {
      if (stockData.springWater < 20) {
        insights.push({
          type: 'warning',
          title: 'Increase Spring Water Stock',
          message: `Spring Water is your top seller (${springCount} gallons sold) but stock is low (${stockData.springWater} left). Consider ordering more to meet demand.`,
          action: 'Restock Spring Water',
        });
      } else {
        insights.push({
          type: 'success',
          title: 'Spring Water Performing Well',
          message: `Spring Water is your best seller with ${springCount} gallons sold. Current stock (${stockData.springWater}) looks good!`,
          action: 'Maintain Stock Level',
        });
      }
    } else if (mineralCount > 0 && mineralCount >= pureCount && mineralCount >= springCount) {
      if (stockData.mineralWater < 20) {
        insights.push({
          type: 'warning',
          title: 'Increase Mineral Water Stock',
          message: `Mineral Water is your top seller (${mineralCount} gallons sold) but stock is low (${stockData.mineralWater} left). Consider ordering more to meet demand.`,
          action: 'Restock Mineral Water',
        });
      } else {
        insights.push({
          type: 'success',
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
        const { year, month, dailyAverage } = projections.currentMonth;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      [name]: value === '' ? '' : parseInt(value, 10),
    }));
  };

  const handleSaveStock = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const stationRef = ref(database, `waterStations/${user.uid}`);

      const saveStock = {
        pureWater: tempStock.pureWater === '' ? 0 : tempStock.pureWater,
        springWater: tempStock.springWater === '' ? 0 : tempStock.springWater,
        mineralWater: tempStock.mineralWater === '' ? 0 : tempStock.mineralWater,
      };

      await update(stationRef, {
        stock_pureWater: saveStock.pureWater,
        stock_springWater: saveStock.springWater,
        stock_mineralWater: saveStock.mineralWater,
        stockUpdatedAt: new Date().toISOString(),
      });

      setStock(saveStock);
      setEditingStock(false);
      showAlert({ type: 'success', message: 'Stock updated successfully!' });
    } catch (error) {
      console.error('Error updating stock:', error);
      showAlert({ type: 'error', message: 'Failed to update stock. Please try again.' });
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
    if (quantity === 0) return { label: 'Out of Stock', bg: '#dc2626' };
    if (quantity < 10) return { label: 'Low Stock', bg: '#d97706' };
    if (quantity < 50) return { label: 'Normal', bg: '#065A82' };
    return { label: 'Stock', bg: '#059669' };
  };

  const formatLastRefreshed = (date) => {
    if (!date) return null;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  if (loading) {
    return (
      <div className="p-8 min-h-screen">
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="border-4 border-slate-200 border-t-primary rounded-full w-[50px] h-[50px] animate-spin mb-4"></div>
          <p>Loading stock data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 min-h-screen">

      {/* Analytics Section */}
      <section className="bg-white rounded-xl p-4 sm:p-8 mb-8 shadow-sm">
        <div className="flex justify-between items-center mb-8 pb-4 border-b-2 border-slate-200 flex-wrap gap-3">
          <h2 className="text-slate-800 text-xl sm:text-2xl m-0">Business Analytics</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="bg-gray-100 rounded-xl p-4 sm:p-6 shadow-lg transition-transform flex items-center gap-4 hover:-translate-y-1">
            <div className="text-4xl"></div>
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-bold m-0 mb-1">{stats.totalOrders}</h3>
              <p className="text-sm m-0 opacity-90">Total Orders</p>
            </div>
          </div>

          <div className="bg-gray-100 rounded-xl p-4 sm:p-6 shadow-lg transition-transform flex items-center gap-4 hover:-translate-y-1">
            <div className="text-4xl"></div>
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-bold m-0 mb-1">{stats.pendingOrders}</h3>
              <p className="text-sm m-0 opacity-90">Pending Orders</p>
            </div>
          </div>

          <div className="bg-gray-100 rounded-xl p-4 sm:p-6 shadow-lg transition-transform flex items-center gap-4 hover:-translate-y-1">
            <div className="text-4xl"></div>
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-bold m-0 mb-1">{stats.completedOrders}</h3>
              <p className="text-sm m-0 opacity-90">Completed Orders</p>
            </div>
          </div>

          <div className="bg-gray-100 rounded-xl p-4 sm:p-6 shadow-lg transition-transform flex items-center gap-4 hover:-translate-y-1">
            <div className="text-4xl"></div>
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-bold m-0 mb-1">{formatCurrency(stats.todaysRevenue)}</h3>
              <p className="text-sm m-0 opacity-90">Total Revenue</p>
            </div>
          </div>

          <div className="bg-gray-100 rounded-xl p-4 sm:p-6 shadow-lg transition-transform flex items-center gap-4 hover:-translate-y-1">
            <div className="text-4xl"></div>
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-bold m-0 mb-1">{stats.mostBoughtWater}</h3>
              <p className="text-sm m-0 opacity-90">Most Popular Water</p>
            </div>
          </div>

          <div className="bg-gray-100 rounded-xl p-4 sm:p-6 shadow-lg transition-transform flex items-center gap-4 hover:-translate-y-1">
            <div className="text-4xl"></div>
            <div className="flex-1">
              <h3 className="text-2xl sm:text-3xl font-bold m-0 mb-1">{stats.topLocation}</h3>
              <p className="text-sm m-0 opacity-90">Top Customer Location</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stock Inventory Section */}
      <section className="bg-white rounded-xl p-4 sm:p-8 mb-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-4 border-b-2 border-slate-200 gap-3">
          <h2 className="text-slate-800 text-xl sm:text-2xl m-0">Water Stock Inventory</h2>
          {!editingStock ? (
            <button className="bg-primary text-white border-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold cursor-pointer transition-all text-sm hover:bg-primary-dark hover:-translate-y-0.5" onClick={() => setEditingStock(true)}>
              Edit Stock
            </button>
          ) : (
            <div className="flex gap-3">
              <button className="bg-secondary text-white border-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold cursor-pointer transition-all text-sm hover:bg-primary-dark hover:-translate-y-0.5" onClick={handleSaveStock}>Save</button>
              <button className="bg-red-500 text-white border-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold cursor-pointer transition-all text-sm hover:bg-red-600 hover:-translate-y-0.5" onClick={handleCancelEdit}>Cancel</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-xl p-4 sm:p-8 text-center text-white shadow-md transition-transform hover:-translate-y-1.5 bg-gradient-to-br from-primary to-primary-dark">
            <div className="text-4xl sm:text-5xl mb-4"></div>
            <h3 className="text-sm sm:text-lg mb-4 font-semibold">Pure Water (Gallons)</h3>
            {editingStock ? (
              <input type="number" name="pureWater" value={tempStock.pureWater} onChange={handleStockChange} className="w-full p-3 text-3xl text-center border-2 border-white/30 rounded-lg bg-white/10 text-white font-bold mb-2 focus:outline-none focus:border-white/60 focus:bg-white/20" min="0" />
            ) : (
              <div className="text-3xl sm:text-5xl font-bold mb-2">{stock.pureWater}</div>
            )}
            <div className="text-sm font-semibold px-4 py-2 rounded-full inline-block text-white" style={{ backgroundColor: getStockStatus(stock.pureWater).bg }}>
              {getStockStatus(stock.pureWater).label}
            </div>
          </div>

          <div className="rounded-xl p-4 sm:p-8 text-center text-white shadow-md transition-transform hover:-translate-y-1.5 bg-gradient-to-br from-secondary to-primary">
            <div className="text-4xl sm:text-5xl mb-4"></div>
            <h3 className="text-sm sm:text-lg mb-4 font-semibold">Spring Water (gallons)</h3>
            {editingStock ? (
              <input type="number" name="springWater" value={tempStock.springWater} onChange={handleStockChange} className="w-full p-3 text-3xl text-center border-2 border-white/30 rounded-lg bg-white/10 text-white font-bold mb-2 focus:outline-none focus:border-white/60 focus:bg-white/20" min="0" />
            ) : (
              <div className="text-3xl sm:text-5xl font-bold mb-2">{stock.springWater}</div>
            )}
            <div className="text-sm font-semibold px-4 py-2 rounded-full inline-block text-white" style={{ backgroundColor: getStockStatus(stock.springWater).bg }}>
              {getStockStatus(stock.springWater).label}
            </div>
          </div>

          <div className="rounded-xl p-4 sm:p-8 text-center text-white shadow-md transition-transform hover:-translate-y-1.5 bg-gradient-to-br from-amber-500 to-red-500">
            <div className="text-4xl sm:text-5xl mb-4"></div>
            <h3 className="text-sm sm:text-lg mb-4 font-semibold">Mineral Water (Gallons)</h3>
            {editingStock ? (
              <input type="number" name="mineralWater" value={tempStock.mineralWater} onChange={handleStockChange} className="w-full p-3 text-3xl text-center border-2 border-white/30 rounded-lg bg-white/10 text-white font-bold mb-2 focus:outline-none focus:border-white/60 focus:bg-white/20" min="0" />
            ) : (
              <div className="text-3xl sm:text-5xl font-bold mb-2">{stock.mineralWater}</div>
            )}
            <div className="text-sm font-semibold px-4 py-2 rounded-full inline-block text-white" style={{ backgroundColor: getStockStatus(stock.mineralWater).bg }}>
              {getStockStatus(stock.mineralWater).label}
            </div>
          </div>
        </div>
      </section>

      {/* Annual Performance Reports Section */}
      <section className="bg-white rounded-xl p-4 sm:p-8 mb-8 shadow-sm">
        <h2 className="text-slate-800 text-xl sm:text-2xl m-0 mb-6">Performance Reports</h2>

        {/* Revenue Analytics Collapsible */}
        <div className="bg-white rounded-xl mb-6 shadow-sm overflow-hidden transition-all border border-slate-200">
          <div className={`flex justify-between items-center px-6 py-5 cursor-pointer transition-all bg-gradient-to-r from-slate-50 to-slate-100 border-l-4 border-l-blue-500 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-200 hover:translate-x-1`} onClick={toggleRevenueAnalytics}>
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className="text-slate-800 text-xl m-0 font-semibold">Revenue Analytics</h3>
              <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[0.7rem] font-semibold tracking-wider">Revenue tracking</span>
            </div>
            <div className={`text-sm text-slate-500 transition-transform bg-white w-7 h-7 flex items-center justify-center rounded-full shadow-sm ${showRevenueAnalytics ? 'rotate-90 text-blue-500 bg-blue-500/10' : ''}`}>&rsaquo;</div>
          </div>
          {showRevenueAnalytics && (
            <div className="p-6 border-t border-slate-200 animate-[toggleSlideDown_0.3s_ease-out]">
              {/* Monthly/Annual Toggle */}
              <div className="flex gap-2 bg-slate-100 p-1 rounded-full mb-6 w-fit">
                <div className="relative group">
                  <button 
                    className={`px-5 py-2 border-none bg-transparent rounded-full font-medium cursor-pointer transition-all text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 ${dataViewMode === 'monthly' ? 'bg-white text-primary shadow-sm' : ''}`}
                    onClick={() => setDataViewMode('monthly')}
                  >
                    Monthly View
                  </button>
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Historical performance by month
                  </span>
                </div>
                <div className="relative group">
                  <button 
                    className={`px-5 py-2 border-none bg-transparent rounded-full font-medium cursor-pointer transition-all text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 ${dataViewMode === 'annual' ? 'bg-white text-primary shadow-sm' : ''}`}
                    onClick={() => setDataViewMode('annual')}
                  >
                    Annual View
                  </button>
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Yearly revenue reports &amp; summaries
                  </span>
                </div>
              </div>

              {/* Revenue Projection Card */}
              {!projectionLoading && revenueProjection && yearForecast?.hasMinimumData ? (
                <div className="bg-gradient-to-br from-primary-dark to-primary-dark rounded-2xl p-4 sm:p-8 mb-8 text-white shadow-lg border border-white/10">
                  <div className="flex flex-col lg:flex-row justify-between items-start mb-8 gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                      <div>
                        <h3 className="text-2xl m-0 mb-1 text-white">{revenueProjection.monthName} {revenueProjection.year} Revenue Projection</h3>
                        <p className="text-white m-0 text-sm">Based on {revenueProjection.daysPassed} days of actual data • {revenueProjection.daysRemaining} days remaining</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-3 justify-end flex-shrink-0 min-w-0">
                      {projectionConfidence && (
                        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-full text-[11px] sm:text-sm font-semibold whitespace-nowrap" style={{ backgroundColor: `${projectionConfidence.color}20`, color: projectionConfidence.color }}>
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: projectionConfidence.color }}></span>
                          {projectionConfidence.level} Confidence
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="relative group">
                          <button className={`flex items-center gap-1 sm:gap-2 bg-white/10 text-white border border-white/20 px-2 sm:px-4 py-1 sm:py-2 rounded-full text-[11px] sm:text-sm font-semibold cursor-pointer transition-all backdrop-blur hover:bg-blue-500/30 hover:border-blue-500 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed ${isRefreshing ? 'refreshing' : ''}`} onClick={handleRefreshProjections} disabled={isRefreshing}>
                            <span className={`text-sm sm:text-lg inline-block leading-none ${isRefreshing ? 'spin' : ''}`}></span>
                            {isRefreshing ? 'Refreshing...' : 'Refresh'}
                          </button>
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Recalculate revenue &amp; consumption projections
                          </span>
                        </div>
                        {lastRefreshed && !isRefreshing && <span className="text-slate-500 text-[0.6rem] sm:text-[0.75rem] whitespace-nowrap">Updated {formatLastRefreshed(lastRefreshed)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-8">
                    <div className="bg-white/10 rounded-xl p-3 sm:p-5 backdrop-blur border border-white/10">
                      <span className="block text-xs sm:text-base uppercase tracking-wider mb-2">Revenue to Date</span>
                      <span className="block text-xl sm:text-3xl font-bold mb-1 text-white">₱{revenueProjection.currentRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      <span className="block text-slate-400 text-xs">{revenueProjection.daysPassed} days</span>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 sm:p-5 backdrop-blur border border-white/10">
                      <span className="block text-xs sm:text-base uppercase tracking-wider mb-2">Projected End of Month</span>
                      <span className="block text-xl sm:text-3xl font-bold mb-1 text-white">₱{revenueProjection.projectedRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      <span className="block text-slate-400 text-xs">Target</span>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 sm:p-5 backdrop-blur border border-white/10">
                      <span className="block text-xs sm:text-base uppercase tracking-wider mb-2">Daily Average</span>
                      <span className="block text-xl sm:text-3xl font-bold mb-1 text-white">₱{revenueProjection.dailyAverage?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      <span className="block text-slate-400 text-xs">per day</span>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 sm:p-5 backdrop-blur border border-white/10">
                      <span className="block text-xs sm:text-base uppercase tracking-wider mb-2">Remaining Potential</span>
                      <span className="block text-xl sm:text-3xl font-bold mb-1 text-white">₱{(revenueProjection.projectedRevenue - revenueProjection.currentRevenue)?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      <span className="block text-slate-400 text-xs">{revenueProjection.daysRemaining} days left</span>
                    </div>
                  </div>

                  {chartData.length > 0 && (
                    <div className="bg-white rounded-xl p-4 sm:p-6 mb-8">
                      <h4 className="text-slate-800 text-sm m-0 mb-4 font-semibold hidden md:block">Daily Revenue vs Projection</h4>
                      <div className="hidden md:block">
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="day" tickFormatter={(day) => `Day ${day}`} stroke="#64748b" />
                            <YAxis tickFormatter={(value) => `₱${(value/1000).toFixed(0)}k`} stroke="#64748b" />
                            <Tooltip formatter={(value) => [`₱${value?.toLocaleString() || 0}`, 'Revenue']} labelFormatter={(label) => `Day ${label}`} />
                            <Legend />
                            <Line type="monotone" dataKey="actual" stroke="#065A82" strokeWidth={3} dot={{ r: 4, fill: "#065A82" }} name="Actual Revenue" />
                            <Line type="monotone" dataKey="projected" stroke="#94a3b8" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3, fill: "#94a3b8" }} name="Projected Revenue" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="block md:hidden text-center py-6 px-4 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-400 mb-2 block">Charts are available on tablet and desktop views</span>
                      </div>
                    </div>
                  )}

                  {yearForecast?.futureMonths?.length > 0 && (
                    <div className="bg-white/5 rounded-xl p-4 sm:p-6 mb-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
                        <h4 className="text-white m-0 text-base sm:text-lg">{yearForecast.year} Year Forecast</h4>
                        <span className="text-yellow-500 font-bold text-xl sm:text-2xl">Total: ₱{yearForecast.totalYearProjection?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-4">
                        <div className="bg-primary/20 border border-primary rounded-lg p-4 text-center relative">
                          <span className="block text-white text-base font-semibold mb-2">{revenueProjection.monthName}</span>
                          <span className="block text-white font-bold text-lg sm:text-2xl">₱{revenueProjection.projectedRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          <span className="absolute -top-2 right-2 bg-primary text-white text-[0.7rem] px-2 py-1 rounded-full">Current</span>
                        </div>
                        {yearForecast.futureMonths.map((month, index) => (
                          <div key={index} className="bg-white/3 rounded-lg p-4 text-center relative">
                            <span className="block text-white text-base font-semibold mb-2">{month.monthName}</span>
                            <span className="block text-white font-bold text-lg sm:text-2xl">₱{month.projectedRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {yearComparison && yearComparison.hasPreviousYearData && (
                    <div className="bg-white/5 rounded-xl p-4 sm:p-6">
                      <div>
                        <h4 className="text-white m-0 mb-6 text-lg">{yearComparison.previousYear} vs {yearComparison.currentYear}</h4>
                      </div>
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <span className="min-w-[60px] text-slate-400 font-semibold">{yearComparison.previousYear}</span>
                          <div className="flex-1 h-10 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full flex items-center px-4 text-white font-semibold text-sm transition-all bg-gradient-to-r from-slate-500 to-slate-600" style={{ width: `${Math.min((yearComparison.previousYearTotal / (yearComparison.currentYearTotal || 1)) * 100, 100)}%` }}>
                              ₱{yearComparison.previousYearTotal?.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mb-4">
                          <span className="min-w-[60px] text-slate-400 font-semibold">{yearComparison.currentYear}</span>
                          <div className="flex-1 h-10 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full flex items-center px-4 text-white font-semibold text-sm transition-all bg-gradient-to-r from-blue-500 to-blue-600" style={{ width: '100%' }}>₱{yearComparison.currentYearTotal?.toLocaleString()}</div>
                          </div>
                        </div>
                        {yearComparison.growthPercentage !== null && (
                          <div className="mt-4 pt-4 border-t border-white/10 text-slate-400 flex items-center gap-2">
                            {Math.abs(yearComparison.growthPercentage).toFixed(1)}% {yearComparison.growthPercentage > 0 ? 'growth' : 'decline'} from last year
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-primary-dark to-primary-dark rounded-2xl p-6 sm:p-12 text-center text-white mb-8">
                  <h3 className="text-white mb-2">Monthly Revenue Prediction</h3>
                  <p className="text-slate-400 mb-6">{projectionLoading ? 'Loading revenue projections...' : `Predictions will be available on ${new Date(new Date().getFullYear(), new Date().getMonth(), 4).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`}</p>
                  {!projectionLoading && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex gap-2">
                        <span className="w-2 h-2 bg-primary rounded-full animate-[pulse_1.5s_infinite]"></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-[pulse_1.5s_infinite]"></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-[pulse_1.5s_infinite]"></span>
                      </div>
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
            </div>
          )}
        </div>

        {/* Water Consumption Analytics Section */}
        <div className="bg-white rounded-xl mb-6 shadow-sm overflow-hidden transition-all border border-slate-200">
          <div className={`flex justify-between items-center px-6 py-5 cursor-pointer transition-all bg-gradient-to-r from-slate-50 to-slate-100 border-l-4 border-l-blue-500 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-200 hover:translate-x-1`} onClick={toggleConsumptionAnalytics}>
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className="text-slate-800 text-xl m-0 font-semibold">Water Consumption</h3>
              <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-[0.7rem] font-semibold tracking-wider">Volume tracking</span>
            </div>
            <div className={`text-sm text-slate-500 transition-transform bg-white w-7 h-7 flex items-center justify-center rounded-full shadow-sm ${showConsumptionAnalytics ? 'rotate-90 text-blue-500 bg-blue-500/10' : ''}`}>&rsaquo;</div>
          </div>
          {showConsumptionAnalytics && (
            <div className="p-6 border-t border-slate-200 animate-[toggleSlideDown_0.3s_ease-out]">
              <WaterConsumptionAnalytics stationId={auth.currentUser?.uid} currentStock={stock} />
            </div>
          )}
        </div>
      </section>

      {alertProps && <AlertCard {...alertProps} onClose={closeAlert} />}
    </div>
  );
};

export default Stock;