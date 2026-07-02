// src/components/dashboard/HistoricalPerformance.jsx
// UPDATED: Auto-calculates from orders when archives don't exist
import React, { useState, useEffect } from 'react';
import { getArchivedYear } from '../../utils/monthlyArchiver';
import { calculateMonthlyRevenue, getDailyRevenueForArchive } from '../../utils/revenueCalculator';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

const HistoricalPerformance = ({ stationId }) => {
  const [historicalData, setHistoricalData] = useState([]);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Generate dynamic sample data based on current date
  const generateSkeletonData = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    const completedMonths = [];
    for (let i = 1; i <= 3; i++) {
      let targetMonth = currentMonth - i;
      let targetYear = currentYear;
      
      if (targetMonth < 0) {
        targetMonth += 12;
        targetYear--;
      }
      
      completedMonths.push({
        monthIndex: targetMonth,
        year: targetYear
      });
    }
    
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    return completedMonths.map(({ monthIndex, year }) => {
      const monthName = monthNames[monthIndex];
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      
      const baseRevenue = 15000 + Math.random() * 10000;
      const dailyData = Array.from({ length: daysInMonth }, (_, day) => ({
        day: day + 1,
        date: new Date(year, monthIndex, day + 1).toISOString(),
        revenue: (baseRevenue / daysInMonth) * (0.7 + Math.random() * 0.6)
      }));
      
      const actual = dailyData.reduce((sum, d) => sum + d.revenue, 0);
      const projected = actual * (0.92 + Math.random() * 0.16);
      const orders = Math.floor(Math.random() * 50) + 30;
      
      return {
        monthKey: monthName,
        monthIndex,
        monthName: monthNames[monthIndex],
        year,
        projected: Math.round(projected * 100) / 100,
        actual: Math.round(actual * 100) / 100,
        orders,
        accuracy: Math.round((actual / projected) * 100 * 10) / 10,
        dailyData,
        isSkeleton: true
      };
    });
  };

  // NEW: Calculate historical data directly from orders (for unarchived months)
  const calculateFromOrders = async (targetYear, targetMonth) => {
    try {
      // Get monthly revenue
      const actualRevenue = await calculateMonthlyRevenue(stationId, targetYear, targetMonth);
      
      // If no revenue, return null
      if (actualRevenue === 0) return null;
      
      // Get daily breakdown
      const { dailyData, total } = await getDailyRevenueForArchive(stationId, targetYear, targetMonth);
      
      // Count orders for the month
      const { db } = await import('firebase/database');
      const { ref, get } = await import('firebase/database');
      const { database } = await import('../components/config/Firebase');
      
      const ordersRef = ref(database, 'orders');
      const ordersSnapshot = await get(ordersRef);
      let orderCount = 0;
      
      if (ordersSnapshot.exists()) {
        const orders = ordersSnapshot.val();
        orderCount = Object.values(orders).filter(order => {
          if (order.stationId !== stationId) return false;
          const orderDate = new Date(order.createdAt);
          return orderDate.getMonth() === targetMonth && 
                 orderDate.getFullYear() === targetYear &&
                 (order.status === 'completed' || 
                  order.status === 'Completed' ||
                  order.status === 'delivered' ||
                  order.status === 'Delivered');
        }).length;
      }
      
      // Calculate projection (use actual as projection for unarchived months)
      const projectedRevenue = actualRevenue;
      const accuracy = 100; // Perfect accuracy since we're using actual
      
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ];
      
      return {
        monthKey: monthNames[targetMonth],
        monthIndex: targetMonth,
        monthName: monthNames[targetMonth],
        year: targetYear,
        projected: projectedRevenue,
        actual: actualRevenue,
        orders: orderCount,
        accuracy: accuracy,
        dailyData: dailyData,
        isSkeleton: false,
        fromOrders: true // Flag to indicate this came from raw orders
      };
    } catch (error) {
      console.error(`Error calculating data for ${targetMonth}/${targetYear}:`, error);
      return null;
    }
  };

  useEffect(() => {
    const loadHistoricalData = async () => {
      if (!stationId) {
        setLoading(false);
        return;
      }

      try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        
        // Try to get archived data first
        let yearData = await getArchivedYear(stationId, currentYear);
        
        const monthNames = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'
        ];
        
        let archivedMonths = [];
        
        if (yearData) {
          // Process archived months
          archivedMonths = monthNames
            .map((monthKey, index) => {
              const monthData = yearData[monthKey];
              if (!monthData) return null;
              if (index >= currentMonth) return null;
              
              return {
                monthKey,
                monthIndex: index,
                ...monthData,
                isSkeleton: false,
                fromOrders: false
              };
            })
            .filter(Boolean);
        }
        
        // Check for missing months that have actual orders but aren't archived
        const missingMonths = [];
        for (let i = 1; i <= 3; i++) {
          let targetMonth = currentMonth - i;
          let targetYear = currentYear;
          
          if (targetMonth < 0) {
            targetMonth += 12;
            targetYear--;
          }
          
          // Check if this month is already in archivedMonths
          const isArchived = archivedMonths.some(m => 
            m.monthIndex === targetMonth && m.year === targetYear
          );
          
          if (!isArchived) {
            // Try to calculate from orders
            const calculatedData = await calculateFromOrders(targetYear, targetMonth);
            if (calculatedData && calculatedData.actual > 0) {
              missingMonths.push(calculatedData);
            }
          }
        }
        
        // Combine archived and calculated months
        let allMonths = [...archivedMonths, ...missingMonths];
        
        // Sort by date (most recent first)
        allMonths.sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.monthIndex - a.monthIndex;
        });
        
        // Take only last 3 months
        allMonths = allMonths.slice(0, 3);
        
        if (allMonths.length > 0) {
          setHistoricalData(allMonths);
          setShowSkeleton(false);
        } else {
          // No real data at all, show skeleton
          setHistoricalData(generateSkeletonData());
          setShowSkeleton(true);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading historical data:', error);
        setHistoricalData(generateSkeletonData());
        setShowSkeleton(true);
        setLoading(false);
      }
    };

    loadHistoricalData();
  }, [stationId]);

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 95) return { color: '#10b981', label: 'Excellent', icon: '✅' };
    if (accuracy >= 90) return { color: '#f59e0b', label: 'Good', icon: '⚠️' };
    return { color: '#ef4444', label: 'Needs Improvement', icon: '❌' };
  };

  const toggleMonth = (monthKey) => {
    setExpandedMonth(expandedMonth === monthKey ? null : monthKey);
  };

  const formatMonthName = (monthKey) => {
    return monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
  };

  if (loading) {
    return (
      <section className="bg-white rounded-xl p-8 mb-8 shadow-sm">
        <div className="mb-6 pb-4 border-b-2 border-slate-200">
          <h2 className="text-slate-800 text-2xl m-0 mb-2">📚 Monthly Reports</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <div className="border-[3px] border-slate-200 border-t-primary rounded-full w-10 h-10 animate-spin mb-4"></div>
          <p>Loading historical data...</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`bg-white rounded-xl p-8 mb-8 shadow-sm ${showSkeleton ? 'skeleton-mode' : ''}`}>
      <div className="mb-6 pb-4 border-b-2 border-slate-200">
        <h2 className="text-slate-800 text-2xl m-0 mb-2">📚Monthly Reports</h2>
        <p className="text-slate-500 text-sm m-0">
          View past months' revenue and prediction accuracy
        </p>
      </div>

      {/* Demo Mode Banner - Only shows when using sample data */}
      {showSkeleton && (
        <div className="bg-amber-50 border-l-4 border-l-amber-500 p-3 mb-6 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span>Demo Mode: Showing sample data. Real data will appear once you have completed orders.</span>
        </div>
      )}

      {/* Live Data Indicator - Shows when using real orders */}
      {!showSkeleton && historicalData.some(m => m.fromOrders) && (
        <div className="bg-secondary/10 border-l-4 border-l-secondary p-3 mb-6 rounded-lg text-sm text-primary-dark flex items-center gap-2">
          <span className="text-lg">✅</span>
          <span>Showing real data from your orders. {historicalData.some(m => m.fromOrders) && '(Some months calculated directly from orders)'}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {historicalData.map((month) => {
          const accuracyInfo = getAccuracyColor(month.accuracy);
          const isExpanded = expandedMonth === month.monthKey;

          return (
            <div
              key={`${month.monthKey}-${month.year}`}
              className={`bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${isExpanded ? 'bg-white border-primary shadow-[0_4px_16px_rgba(2,128,144,0.1)]' : ''} ${month.isSkeleton ? 'skeleton-card' : ''}`}
            >
              <div
                className="flex justify-between items-center p-5 cursor-pointer select-none"
                onClick={() => toggleMonth(month.monthKey)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-3xl">📅</div>
                  <div>
                    <h3 className="text-slate-800 text-lg m-0 mb-1">
                      {formatMonthName(month.monthKey)} {month.year}
                      {month.fromOrders && <span className="bg-secondary text-white text-[0.7rem] px-2 py-1 rounded-full ml-2 font-medium align-middle"> Live</span>}
                    </h3>
                    <p className="text-slate-500 text-sm m-0">
                      {month.orders} orders • ₱{month.actual?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm"
                    style={{
                      backgroundColor: `${accuracyInfo.color}20`,
                      color: accuracyInfo.color,
                      border: `1px solid ${accuracyInfo.color}40`
                    }}
                  >
                    <span className="text-base">{accuracyInfo.icon}</span>
                    <span className="font-bold">{month.accuracy.toFixed(1)}%</span>
                  </div>
                  <button className="bg-primary/10 border border-primary/30 text-primary px-3 py-2 rounded-lg cursor-pointer text-sm font-semibold transition-all hover:bg-primary/20 hover:border-primary">
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-200 animate-[slideDown_0.3s_ease]">
                  <div className="flex items-center justify-around bg-gradient-to-br from-surface to-surface rounded-xl p-6 mb-6 gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Projected</span>
                      <span className="text-xl font-bold text-slate-400">
                        ₱{month.projected?.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                    <div className="text-2xl text-slate-400">→</div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Actual</span>
                      <span className="text-xl font-bold text-primary">
                        ₱{month.actual?.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Accuracy</span>
                      <span
                        className="text-xl font-bold"
                        style={{ color: accuracyInfo.color }}
                      >
                        {month.accuracy.toFixed(1)}% {accuracyInfo.icon}
                      </span>
                    </div>
                  </div>

                  {month.dailyData && month.dailyData.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-slate-800 text-sm m-0 mb-4 font-semibold">Daily Revenue Breakdown</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={month.dailyData}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(day) => day % 5 === 0 ? day : ''}
                          />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            formatter={(value) => [`₱${value?.toLocaleString()}`, 'Revenue']}
                            labelFormatter={(label) => `Day ${label}`}
                          />
                          <Bar
                            dataKey="revenue"
                            fill="#065A82"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <span className="text-2xl">📦</span>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs font-medium">Total Orders</span>
                        <span className="text-slate-800 text-base font-bold">{month.orders}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <span className="text-2xl">💰</span>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs font-medium">Avg Order Value</span>
                        <span className="text-slate-800 text-base font-bold">
                          ₱{month.orders > 0
                            ? (month.actual / month.orders).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })
                            : '0.00'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <span className="text-2xl">📈</span>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs font-medium">Prediction Quality</span>
                        <span className="text-slate-800 text-base font-bold" style={{ color: accuracyInfo.color }}>
                          {accuracyInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HistoricalPerformance;