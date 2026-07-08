// src/components/dashboard/AnnualReports.jsx
// UPDATED: Auto-calculates from orders when archives don't exist
import React, { useState, useEffect } from 'react';
import { getAllAnnualReports, getAnnualReport } from '../../utils/yearlyReportGenerator';
import { calculateMonthlyRevenue } from '../../utils/revenueCalculator';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const AnnualReports = ({ stationId }) => {
  const [reports, setReports] = useState([]);
  const [visibleYears, setVisibleYears] = useState(3);
  const [expandedYear, setExpandedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Generate skeleton placeholder data
  const generateSkeletonData = () => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear - 2];
    
    return years.map(year => {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const monthlyBreakdown = monthNames.map((month, index) => {
        const baseRevenue = 12000 + Math.random() * 8000;
        const seasonalFactor = Math.sin((index / 12) * Math.PI * 2) * 0.2 + 1;
        const revenue = Math.round(baseRevenue * seasonalFactor * 100) / 100;
        const orders = Math.floor((revenue / 350) + Math.random() * 20);
        
        return {
          month,
          monthIndex: index,
          revenue,
          orders
        };
      });
      
      const totalRevenue = monthlyBreakdown.reduce((sum, m) => sum + m.revenue, 0);
      const totalOrders = monthlyBreakdown.reduce((sum, m) => sum + m.orders, 0);
      const avgMonthly = totalRevenue / 12;
      
      const sortedByRevenue = [...monthlyBreakdown].sort((a, b) => b.revenue - a.revenue);
      const bestMonth = sortedByRevenue[0];
      const worstMonth = sortedByRevenue[11];
      
      return {
        year,
        total: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        avgMonthly: Math.round(avgMonthly * 100) / 100,
        bestMonth: {
          name: bestMonth.month,
          revenue: bestMonth.revenue,
          orders: bestMonth.orders
        },
        worstMonth: {
          name: worstMonth.month,
          revenue: worstMonth.revenue,
          orders: worstMonth.orders
        },
        monthlyBreakdown,
        isSkeleton: true
      };
    });
  };

  // NEW: Calculate annual report directly from orders
  const calculateAnnualFromOrders = async (year) => {
    try {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const monthlyBreakdown = [];
      let totalRevenue = 0;
      let totalOrders = 0;
      
      // Loop through all 12 months of the year
      for (let month = 0; month < 12; month++) {
        // Get monthly revenue using the existing calculator
        const revenue = await calculateMonthlyRevenue(stationId, year, month);
        
        // Count orders for this month
        const { ref, get } = await import('firebase/database');
        const { database } = await import('../config/Firebase');
        
        const ordersRef = ref(database, 'orders');
        const ordersSnapshot = await get(ordersRef);
        let orderCount = 0;
        
        if (ordersSnapshot.exists()) {
          const orders = ordersSnapshot.val();
          orderCount = Object.values(orders).filter(order => {
            if (order.stationId !== stationId) return false;
            const orderDate = new Date(order.createdAt);
            return orderDate.getMonth() === month && 
                   orderDate.getFullYear() === year &&
                   (order.status === 'completed' || 
                    order.status === 'Completed' ||
                    order.status === 'delivered' ||
                    order.status === 'Delivered');
          }).length;
        }
        
        monthlyBreakdown.push({
          month: monthNames[month],
          monthIndex: month,
          revenue: revenue,
          orders: orderCount
        });
        
        totalRevenue += revenue;
        totalOrders += orderCount;
      }
      
      // If no revenue for the entire year, return null
      if (totalRevenue === 0) return null;
      
      const avgMonthly = totalRevenue / 12;
      
      // Find best and worst months
      const sortedByRevenue = [...monthlyBreakdown].sort((a, b) => b.revenue - a.revenue);
      const bestMonth = sortedByRevenue[0];
      const worstMonth = sortedByRevenue[11];
      
      return {
        year,
        total: totalRevenue,
        totalOrders,
        avgMonthly: avgMonthly,
        bestMonth: {
          name: bestMonth.month,
          revenue: bestMonth.revenue,
          orders: bestMonth.orders
        },
        worstMonth: {
          name: worstMonth.month,
          revenue: worstMonth.revenue,
          orders: worstMonth.orders
        },
        monthlyBreakdown,
        isSkeleton: false,
        fromOrders: true // Flag to indicate this came from raw orders
      };
    } catch (error) {
      console.error(`Error calculating annual report for ${year}:`, error);
      return null;
    }
  };

  // Get all years that have order data
  const getYearsWithOrders = async () => {
    try {
      const { ref, get } = await import('firebase/database');
      const { database } = await import('../config/Firebase');
      
      const ordersRef = ref(database, 'orders');
      const ordersSnapshot = await get(ordersRef);
      
      if (!ordersSnapshot.exists()) return [];
      
      const orders = ordersSnapshot.val();
      const years = new Set();
      
      Object.values(orders).forEach(order => {
        if (order.stationId === stationId) {
          const orderDate = new Date(order.createdAt);
          const year = orderDate.getFullYear();
          years.add(year);
        }
      });
      
      return Array.from(years).sort((a, b) => b - a);
    } catch (error) {
      console.error('Error getting years with orders:', error);
      return [];
    }
  };

  useEffect(() => {
    const loadAnnualReports = async () => {
      if (!stationId) {
        setLoading(false);
        return;
      }

      try {
        // First, try to get archived reports
        const archivedYears = await getAllAnnualReports(stationId);
        let allReports = [];
        
        // Get years that have order data (for fallback calculation)
        const yearsWithOrders = await getYearsWithOrders();
        
        if (archivedYears && archivedYears.length > 0) {
          // Load archived reports
          const archivedReportsData = await Promise.all(
            archivedYears.map(async (year) => {
              const reportData = await getAnnualReport(stationId, year);
              return { ...reportData, isSkeleton: false, fromOrders: false };
            })
          );
          allReports = [...archivedReportsData.filter(Boolean)];
        }
        
        // Check for missing years that have orders but no archive
        const archivedYearSet = new Set(allReports.map(r => r.year));
        const missingYears = yearsWithOrders.filter(year => !archivedYearSet.has(year));
        
        // Calculate reports for missing years from orders
        for (const year of missingYears) {
          const calculatedReport = await calculateAnnualFromOrders(year);
          if (calculatedReport && calculatedReport.total > 0) {
            allReports.push(calculatedReport);
          }
        }
        
        // Sort years descending (most recent first)
        allReports.sort((a, b) => b.year - a.year);
        
        if (allReports.length > 0) {
          setReports(allReports);
          setShowSkeleton(false);
        } else {
          // No real data at all, show skeleton
          setReports(generateSkeletonData());
          setShowSkeleton(true);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading annual reports:', error);
        setReports(generateSkeletonData());
        setShowSkeleton(true);
        setLoading(false);
      }
    };

    loadAnnualReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  const toggleYear = (year) => {
    setExpandedYear(expandedYear === year ? null : year);
  };

  const loadMoreYears = () => {
    setVisibleYears(visibleYears + 3);
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getBarColor = (revenue, avgRevenue) => {
    if (revenue > avgRevenue * 1.2) return '#1C7293';
    if (revenue < avgRevenue * 0.8) return '#ef4444';
    return '#065A82';
  };

  if (loading) {
    return (
      <section className="bg-white rounded-xl p-4 sm:p-8 mb-8 shadow-sm">
        <div className="mb-6 pb-4 border-b-2 border-slate-200">
          <h2 className="text-slate-800 text-2xl m-0 mb-2">Annual Performance Reports</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <div className="border-[3px] border-slate-200 border-t-primary rounded-full w-10 h-10 animate-spin mb-4"></div>
          <p>Loading annual reports...</p>
        </div>
      </section>
    );
  }

  const visibleReports = reports.slice(0, visibleYears);
  const hasMoreReports = reports.length > visibleYears;

  return (
    <section className={`bg-white rounded-xl p-4 sm:p-8 mb-8 shadow-sm ${showSkeleton ? 'skeleton-mode' : ''}`}>
      <div className="mb-6 pb-4 border-b-2 border-slate-200">
        <h2 className="text-slate-800 text-2xl m-0 mb-2">Annual Reports</h2>
        <p className="text-slate-500 text-sm m-0">
          Yearly summaries and 12-month revenue breakdowns
        </p>
      </div>

      {/* Demo Mode Banner - Only shows when using sample data */}
      {showSkeleton && (
        <div className="bg-amber-50 border-l-4 border-l-amber-500 p-3 mb-6 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <span className="text-lg"></span>
          <span>Demo Mode: Showing sample data. Real annual reports will appear once you have completed orders.</span>
        </div>
      )}

      {/* Live Data Indicator - Shows when using real orders */}
      {!showSkeleton && reports.some(r => r.fromOrders) && (
        <div className="bg-secondary/10 border-l-4 border-l-secondary p-3 mb-6 rounded-lg text-sm text-primary-dark flex items-center gap-2">
          <span className="text-lg"></span>
          <span>Showing real data from your orders. {reports.some(r => r.fromOrders) && '(Some years calculated directly from orders)'}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {visibleReports.map((report) => {
          const isExpanded = expandedYear === report.year;
          const chartData = report.monthlyBreakdown.map(month => ({
            month: month.month.substring(0, 3),
            revenue: month.revenue,
            orders: month.orders
          }));

          return (
            <div
              key={report.year}
              className={`bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${isExpanded ? 'bg-white border-primary shadow-[0_8px_24px_rgba(2,128,144,0.15)]' : ''} ${report.isSkeleton ? 'skeleton-card' : ''}`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border-b border-slate-200 gap-3">
                <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
                  <div className="bg-gradient-to-br from-primary to-primary-dark text-white text-lg sm:text-2xl font-bold px-3 sm:px-6 py-2 sm:py-4 rounded-xl shadow-lg">{report.year}</div>
                  <div>
                    <h3 className="text-slate-800 text-xl sm:text-3xl m-0 mb-1 font-bold">
                      {formatCurrency(report.total)}
                      {report.fromOrders && <span className="bg-secondary text-white text-[0.7rem] px-2 py-1 rounded-full ml-3 font-medium align-middle"> Live</span>}
                    </h3>
                    <p className="text-slate-500 text-sm m-0">{report.totalOrders} orders • {formatCurrency(report.avgMonthly)}/month avg</p>
                  </div>
                </div>
                <button
                  className="bg-primary/10 border border-primary/30 text-primary px-4 sm:px-6 py-2 sm:py-3 rounded-lg cursor-pointer font-semibold text-xs sm:text-sm transition-all hover:bg-primary/20 hover:border-primary hover:-translate-y-0.5 flex-shrink-0"
                  onClick={() => toggleYear(report.year)}
                >
                  {isExpanded ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {isExpanded && (<>
              <div className="p-4 sm:p-6 bg-white">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                      stroke="#64748b"
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                        return [value, 'Orders'];
                      }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px'
                      }}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getBarColor(entry.revenue, report.avgMonthly)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-6 bg-white border-t border-slate-200">
                <div className="flex items-center gap-4 bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/30 rounded-xl p-5 transition-all hover:border-primary hover:shadow-[0_4px_12px_rgba(2,128,144,0.1)]">
                  <span className="text-3xl"></span>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Best Month</span>
                    <span className="text-slate-800 text-lg font-bold">
                      {report.bestMonth.name}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {formatCurrency(report.bestMonth.revenue)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-gradient-to-br from-red-50 to-red-100 border border-red-300 rounded-xl p-5 transition-all hover:border-primary hover:shadow-[0_4px_12px_rgba(2,128,144,0.1)]">
                  <span className="text-3xl"></span>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Lowest Month</span>
                    <span className="text-slate-800 text-lg font-bold">
                      {report.worstMonth.name}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {formatCurrency(report.worstMonth.revenue)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/30 rounded-xl p-5 transition-all hover:border-primary hover:shadow-[0_4px_12px_rgba(2,128,144,0.1)]">
                  <span className="text-3xl"></span>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Monthly Average</span>
                    <span className="text-slate-800 text-lg font-bold">
                      {formatCurrency(report.avgMonthly)}
                    </span>
                    <span className="text-slate-500 text-xs">
                      Across 12 months
                    </span>
                  </div>
                </div>
              </div>

                <div className="p-4 sm:p-6 bg-white border-t border-slate-200 animate-[slideDown_0.3s_ease]">
                  <h4 className="text-slate-800 text-lg m-0 mb-4 font-semibold">Monthly Breakdown</h4>
                  <div className="bg-slate-50 rounded-xl p-2 mb-6">
                    {report.monthlyBreakdown.map((month, index) => {
                      const isBest = month.month === report.bestMonth.name;
                      const isWorst = month.month === report.worstMonth.name;
                      
                      return (
                        <div
                          key={index}
                          className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white rounded-lg mb-2 transition-all hover:bg-primary/5 hover:translate-x-1 ${isBest ? 'bg-gradient-to-r from-secondary/5 to-white border-l-3 border-l-secondary' : ''} ${isWorst ? 'bg-gradient-to-r from-red-50 to-white border-l-3 border-l-red-500' : ''}`}
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-slate-800 font-semibold text-sm">{month.month}</span>
                            {isBest && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Best</span>}
                            {isWorst && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Lowest</span>}
                          </div>
                          <div className="flex gap-2 sm:gap-8 items-center flex-wrap mt-1 sm:mt-0">
                            <span className="text-slate-800 font-bold text-sm sm:text-base min-w-0 sm:min-w-[120px] text-right">
                              {formatCurrency(month.revenue)}
                            </span>
                            <span className="text-slate-500 text-xs min-w-0 sm:min-w-[80px] text-right">
                              {month.orders} orders
                            </span>
                            <span className="text-slate-500 text-xs min-w-0 sm:min-w-[80px] text-right">
                              {month.orders > 0
                                ? formatCurrency(month.revenue / month.orders)
                                : '₱0.00'} avg
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-gradient-to-br from-primary-dark to-primary-dark rounded-xl p-4 sm:p-6 text-white">
                    <h4 className="text-white m-0 mb-4 text-lg">Year Summary</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-lg backdrop-blur">
                        <span className="text-slate-400 text-xs uppercase tracking-wider">Total Revenue</span>
                        <span className="text-white text-xl font-bold">{formatCurrency(report.total)}</span>
                      </div>
                      <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-lg backdrop-blur">
                        <span className="text-slate-400 text-xs uppercase tracking-wider">Total Orders</span>
                        <span className="text-white text-xl font-bold">{report.totalOrders}</span>
                      </div>
                      <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-lg backdrop-blur">
                        <span className="text-slate-400 text-xs uppercase tracking-wider">Average Order Value</span>
                        <span className="text-white text-xl font-bold">
                          {formatCurrency(report.total / report.totalOrders)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-lg backdrop-blur">
                        <span className="text-slate-400 text-xs uppercase tracking-wider">Revenue Range</span>
                        <span className="text-white text-xl font-bold">
                          {formatCurrency(report.worstMonth.revenue)} - {formatCurrency(report.bestMonth.revenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>)}
            </div>
          );
        })}
      </div>

      {hasMoreReports && (
        <div className="flex justify-center mt-8">
          <button className="bg-gradient-to-br from-primary to-primary-dark text-white border-none px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base cursor-pointer transition-all shadow-lg hover:-translate-y-0.5 hover:shadow-xl" onClick={loadMoreYears}>
            Load More Years ({reports.length - visibleYears} older)
          </button>
        </div>
      )}
    </section>
  );
};

export default AnnualReports;