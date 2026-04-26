// src/components/dashboard/AnnualReports.jsx
// UPDATED: Auto-calculates from orders when archives don't exist
import React, { useState, useEffect } from 'react';
import './AnnualReports.css';
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
      const { db } = await import('firebase/database');
      const { ref, get } = await import('firebase/database');
      const { database } = await import('../components/config/Firebase');
      
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
    if (revenue > avgRevenue * 1.2) return '#10b981';
    if (revenue < avgRevenue * 0.8) return '#ef4444';
    return '#3b82f6';
  };

  if (loading) {
    return (
      <section className="annual-reports-section">
        <div className="section-header">
          <h2>📊 Annual Performance Reports</h2>
        </div>
        <div className="loading-reports">
          <div className="spinner-small"></div>
          <p>Loading annual reports...</p>
        </div>
      </section>
    );
  }

  const visibleReports = reports.slice(0, visibleYears);
  const hasMoreReports = reports.length > visibleYears;

  return (
    <section className={`annual-reports-section ${showSkeleton ? 'skeleton-mode' : ''}`}>
      <div className="section-header">
        <h2>📊 Annual Reports</h2>
        <p className="section-subtitle">
          Yearly summaries and 12-month revenue breakdowns
        </p>
      </div>

      {/* Demo Mode Banner - Only shows when using sample data */}
      {showSkeleton && (
        <div className="demo-data-banner">
          <span className="demo-icon">📊</span>
          <span>Demo Mode: Showing sample data. Real annual reports will appear once you have completed orders.</span>
        </div>
      )}

      {/* Live Data Indicator - Shows when using real orders */}
      {!showSkeleton && reports.some(r => r.fromOrders) && (
        <div className="live-data-banner">
          <span className="live-icon">✅</span>
          <span>Showing real data from your orders. {reports.some(r => r.fromOrders) && '(Some years calculated directly from orders)'}</span>
        </div>
      )}

      <div className="annual-reports-grid">
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
              className={`annual-report-card ${isExpanded ? 'expanded' : ''} ${report.isSkeleton ? 'skeleton-card' : ''}`}
            >
              <div className="report-card-header">
                <div className="report-header-left">
                  <div className="year-badge">{report.year}</div>
                  <div className="year-summary">
                    <h3>
                      {formatCurrency(report.total)}
                      {report.fromOrders && <span className="live-badge"> Live</span>}
                    </h3>
                    <p>{report.totalOrders} orders • {formatCurrency(report.avgMonthly)}/month avg</p>
                  </div>
                </div>
                <button
                  className="expand-report-button"
                  onClick={() => toggleYear(report.year)}
                >
                  {isExpanded ? '▲ Hide Details' : '▼ View Details'}
                </button>
              </div>

              <div className="annual-chart-container">
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

              <div className="annual-metrics">
                <div className="metric-box best">
                  <span className="metric-icon">🏆</span>
                  <div>
                    <span className="metric-label">Best Month</span>
                    <span className="metric-value">
                      {report.bestMonth.name}
                    </span>
                    <span className="metric-detail">
                      {formatCurrency(report.bestMonth.revenue)}
                    </span>
                  </div>
                </div>
                <div className="metric-box worst">
                  <span className="metric-icon">📉</span>
                  <div>
                    <span className="metric-label">Lowest Month</span>
                    <span className="metric-value">
                      {report.worstMonth.name}
                    </span>
                    <span className="metric-detail">
                      {formatCurrency(report.worstMonth.revenue)}
                    </span>
                  </div>
                </div>
                <div className="metric-box average">
                  <span className="metric-icon">📊</span>
                  <div>
                    <span className="metric-label">Monthly Average</span>
                    <span className="metric-value">
                      {formatCurrency(report.avgMonthly)}
                    </span>
                    <span className="metric-detail">
                      Across 12 months
                    </span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="monthly-breakdown-expanded">
                  <h4>📅 Monthly Breakdown</h4>
                  <div className="breakdown-table">
                    {report.monthlyBreakdown.map((month, index) => {
                      const isBest = month.month === report.bestMonth.name;
                      const isWorst = month.month === report.worstMonth.name;
                      
                      return (
                        <div
                          key={index}
                          className={`breakdown-row ${isBest ? 'best-row' : ''} ${isWorst ? 'worst-row' : ''}`}
                        >
                          <div className="breakdown-month">
                            <span className="month-name">{month.month}</span>
                            {isBest && <span className="badge best-badge">🏆 Best</span>}
                            {isWorst && <span className="badge worst-badge">📉 Lowest</span>}
                          </div>
                          <div className="breakdown-stats">
                            <span className="breakdown-revenue">
                              {formatCurrency(month.revenue)}
                            </span>
                            <span className="breakdown-orders">
                              {month.orders} orders
                            </span>
                            <span className="breakdown-avg">
                              {month.orders > 0
                                ? formatCurrency(month.revenue / month.orders)
                                : '₱0.00'} avg
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="year-summary-box">
                    <h4>📈 Year Summary</h4>
                    <div className="summary-stats">
                      <div className="summary-stat">
                        <span className="summary-label">Total Revenue</span>
                        <span className="summary-value">{formatCurrency(report.total)}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="summary-label">Total Orders</span>
                        <span className="summary-value">{report.totalOrders}</span>
                      </div>
                      <div className="summary-stat">
                        <span className="summary-label">Average Order Value</span>
                        <span className="summary-value">
                          {formatCurrency(report.total / report.totalOrders)}
                        </span>
                      </div>
                      <div className="summary-stat">
                        <span className="summary-label">Revenue Range</span>
                        <span className="summary-value">
                          {formatCurrency(report.worstMonth.revenue)} - {formatCurrency(report.bestMonth.revenue)}
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

      {hasMoreReports && (
        <div className="load-more-container">
          <button className="btn-load-more" onClick={loadMoreYears}>
            ⬇️ Load More Years ({reports.length - visibleYears} older)
          </button>
        </div>
      )}
    </section>
  );
};

export default AnnualReports;