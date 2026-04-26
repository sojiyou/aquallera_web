// src/components/dashboard/WaterConsumptionAnalytics.js
import React, { useState, useEffect } from 'react';
import './WaterConsumptionAnalytics.css';
import { 
  getCurrentMonthConsumptionProjection, 
  calculateStockDepletion,
  getMonthOverMonthComparison,
  getYearConsumptionProjections
} from '../../utils/consumptionProjection';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend
} from 'recharts';

// Sample data for demo/development
const SAMPLE_DATA = {
  projection: {
    hasMinimumData: true,
    currentConsumption: {
      pureWater: 450,
      springWater: 320,
      mineralWater: 180
    },
    projectedConsumption: {
      pureWater: 620,
      springWater: 430,
      mineralWater: 240
    },
    dailyAverages: {
      pureWater: 15.0,
      springWater: 10.7,
      mineralWater: 6.0
    },
    daysRemaining: 18,
    daysInMonth: 30,
    daysPassed: 12,
    month: 3,
    year: 2026,
    monthName: 'April'
  },
  momComparison: {
    currentMonth: {
      name: 'April',
      pureWater: 450,
      springWater: 320,
      mineralWater: 180
    },
    previousMonth: {
      name: 'March',
      pureWater: 580,
      springWater: 410,
      mineralWater: 230
    },
    changes: {
      pureWater: -22.4,
      springWater: -22.0,
      mineralWater: -21.7
    }
  },
  historicalData: [
    {
      monthKey: 'march',
      monthName: 'March',
      year: 2026,
      pureWater: 580,
      springWater: 410,
      mineralWater: 230,
      totalOrders: 42,
      dailyData: Array.from({ length: 31 }, (_, i) => ({
        day: i + 1,
        pureWater: Math.floor(Math.random() * 25) + 10,
        springWater: Math.floor(Math.random() * 20) + 8,
        mineralWater: Math.floor(Math.random() * 12) + 4,
        orderCount: Math.floor(Math.random() * 3) + 1
      }))
    },
    {
      monthKey: 'february',
      monthName: 'February',
      year: 2026,
      pureWater: 520,
      springWater: 390,
      mineralWater: 210,
      totalOrders: 38,
      dailyData: Array.from({ length: 28 }, (_, i) => ({
        day: i + 1,
        pureWater: Math.floor(Math.random() * 22) + 8,
        springWater: Math.floor(Math.random() * 18) + 7,
        mineralWater: Math.floor(Math.random() * 10) + 3,
        orderCount: Math.floor(Math.random() * 3) + 1
      }))
    },
    {
      monthKey: 'january',
      monthName: 'January',
      year: 2026,
      pureWater: 490,
      springWater: 370,
      mineralWater: 195,
      totalOrders: 35,
      dailyData: Array.from({ length: 31 }, (_, i) => ({
        day: i + 1,
        pureWater: Math.floor(Math.random() * 20) + 8,
        springWater: Math.floor(Math.random() * 16) + 6,
        mineralWater: Math.floor(Math.random() * 9) + 3,
        orderCount: Math.floor(Math.random() * 2) + 1
      }))
    }
  ],
  annualData: {
    year: 2025,
    totals: {
      pureWater: 6200,
      springWater: 4800,
      mineralWater: 2400
    },
    totalOrders: 456,
    avgMonthly: {
      pureWater: 517,
      springWater: 400,
      mineralWater: 200
    },
    bestMonth: { 
      name: 'December', 
      pureWater: 680, 
      springWater: 450, 
      mineralWater: 260,
      orders: 48
    },
    slowestMonth: { 
      name: 'February', 
      pureWater: 420, 
      springWater: 350, 
      mineralWater: 180,
      orders: 32
    },
    monthlyBreakdown: [
      { month: 'January', pureWater: 490, springWater: 370, mineralWater: 195, orders: 35 },
      { month: 'February', pureWater: 420, springWater: 350, mineralWater: 180, orders: 32 },
      { month: 'March', pureWater: 510, springWater: 390, mineralWater: 200, orders: 38 },
      { month: 'April', pureWater: 480, springWater: 360, mineralWater: 185, orders: 34 },
      { month: 'May', pureWater: 520, springWater: 400, mineralWater: 210, orders: 39 },
      { month: 'June', pureWater: 500, springWater: 380, mineralWater: 195, orders: 37 },
      { month: 'July', pureWater: 530, springWater: 410, mineralWater: 215, orders: 40 },
      { month: 'August', pureWater: 540, springWater: 420, mineralWater: 220, orders: 41 },
      { month: 'September', pureWater: 510, springWater: 390, mineralWater: 200, orders: 38 },
      { month: 'October', pureWater: 550, springWater: 430, mineralWater: 225, orders: 42 },
      { month: 'November', pureWater: 550, springWater: 380, mineralWater: 220, orders: 40 },
      { month: 'December', pureWater: 680, springWater: 450, mineralWater: 260, orders: 48 }
    ]
  }
};

const WaterConsumptionAnalytics = ({ stationId, currentStock }) => {
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState(null);
  const [stockDepletion, setStockDepletion] = useState(null);
  const [momComparison, setMomComparison] = useState(null);
  const [useSampleData, setUseSampleData] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [historicalData, setHistoricalData] = useState(SAMPLE_DATA.historicalData);
  const [annualData, setAnnualData] = useState(SAMPLE_DATA.annualData);
  
  // View Mode State for Water Consumption
  const [consumptionViewMode, setConsumptionViewMode] = useState('monthly');

  useEffect(() => {
    loadConsumptionData();
  }, [stationId]);

  const loadConsumptionData = async () => {
    setLoading(true);
    try {
      const proj = await getCurrentMonthConsumptionProjection(stationId);
      
      if (!proj.hasMinimumData) {
        console.log('📊 Using sample data for Water Consumption Analytics demo');
        setUseSampleData(true);
        setProjection(SAMPLE_DATA.projection);
        setHistoricalData(SAMPLE_DATA.historicalData);
        setAnnualData(SAMPLE_DATA.annualData);
        
        if (currentStock) {
          const depletion = calculateStockDepletion(currentStock, SAMPLE_DATA.projection.dailyAverages);
          setStockDepletion(depletion);
        }
        
        setMomComparison(SAMPLE_DATA.momComparison);
      } else {
        setUseSampleData(false);
        setProjection(proj);

        if (proj.hasMinimumData && currentStock) {
          const depletion = calculateStockDepletion(currentStock, proj.dailyAverages);
          setStockDepletion(depletion);
        }

        const comparison = await getMonthOverMonthComparison(stationId);
        setMomComparison(comparison);
        
        setHistoricalData(SAMPLE_DATA.historicalData);
        setAnnualData(SAMPLE_DATA.annualData);
      }
    } catch (error) {
      console.error('Error loading consumption data:', error);
      setUseSampleData(true);
      setProjection(SAMPLE_DATA.projection);
      setHistoricalData(SAMPLE_DATA.historicalData);
      setAnnualData(SAMPLE_DATA.annualData);
      if (currentStock) {
        const depletion = calculateStockDepletion(currentStock, SAMPLE_DATA.projection.dailyAverages);
        setStockDepletion(depletion);
      }
      setMomComparison(SAMPLE_DATA.momComparison);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => Math.round(num).toLocaleString();
  
  // Helper to get unit for water type
  const getUnit = (waterType) => {
    if (waterType === 'springWater') return 'L';
    return 'gal';
  };
  
  // Helper to get display name for water type
  const getDisplayName = (waterType) => {
    if (waterType === 'pureWater') return 'Pure Water';
    if (waterType === 'springWater') return 'Spring Water';
    return 'Mineral Water';
  };
  
  const formatChangeText = (change, previousMonthName) => {
    if (change === 0) return `No change from ${previousMonthName}`;
    const arrow = change > 0 ? '📈' : '📉';
    const direction = change > 0 ? 'more than' : 'less than';
    return `${arrow} ${Math.abs(change).toFixed(1)}% ${direction} ${previousMonthName}`;
  };

  // Circular Progress Bar Component with improved labels
  const CircularProgress = ({ percentage, size = 120, strokeWidth = 8, color, waterType, current, projected, unit, dailyAvg, depletionDays }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;
    
    const safePercentage = isNaN(percentage) ? 0 : Math.min(percentage, 100);
    
    const colors = {
      pure: { bg: '#e0e7ff', fill: '#3b82f6' },
      spring: { bg: '#cffafe', fill: '#06b6d4' },
      mineral: { bg: '#fed7aa', fill: '#f59e0b' }
    };
    
    const waterKey = waterType === 'pure' ? 'pureWater' : waterType === 'spring' ? 'springWater' : 'mineralWater';
    const unitLabel = getUnit(waterKey);
    const nameLabel = getDisplayName(waterKey);
    
    return (
      <div className="circular-progress-container">
        <div className="circular-water-name">{nameLabel}</div>
        <svg width={size} height={size} className="circular-progress">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors[waterType].bg}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors[waterType].fill}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="progress-circle"
          />
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="progress-percentage-text"
            fill={colors[waterType].fill}
          >
            {Math.round(safePercentage)}%
          </text>
        </svg>
        <div className="circular-progress-stats">
          <div className="circular-current">Current: {formatNumber(current)} {unitLabel}</div>
          <div className="circular-projected">Projected for month: {formatNumber(projected)} {unitLabel}</div>
        </div>
        <div className="circular-stats-footer">
          <div className="daily-stat">Daily average: {dailyAvg.toFixed(1)} {unitLabel}/day</div>
          <div className="depletion-stat">
            Days until stock runs out: {depletionDays === 999 || depletionDays > 365 ? 'No sales yet' : depletionDays}
          </div>
        </div>
      </div>
    );
  };

  const toggleMonth = (monthKey) => {
    setExpandedMonth(expandedMonth === monthKey ? null : monthKey);
  };

  const formatMonthName = (monthKey) => {
    return monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
  };

  if (loading) {
    return (
      <div className="consumption-loading">
        <div className="spinner-small"></div>
        <p>Loading consumption data...</p>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="consumption-placeholder">
        <div className="placeholder-icon">💧</div>
        <h4>No Consumption Data</h4>
        <p>Complete some orders to see consumption analytics!</p>
      </div>
    );
  }

  return (
    <div className="water-consumption-analytics">
      {useSampleData && (
        <div className="sample-data-banner">
          <span className="sample-icon">🔬</span>
          <span>Showing sample data for demonstration. Real data will appear after Day 3 of the month.</span>
        </div>
      )}

      {/* No Orders Banner for Current Month */}
      {!useSampleData && projection.currentConsumption.pureWater === 0 && 
       projection.currentConsumption.springWater === 0 && 
       projection.currentConsumption.mineralWater === 0 && (
        <div className="no-orders-banner">
          <span className="info-icon">📋</span>
          <span>No completed orders yet this month. Add orders to see consumption tracking.</span>
        </div>
      )}

      {/* Current Month Section with Circular Progress Bars - 3 COLUMN LAYOUT */}
      <div className="consumption-section current-month">
        <div className="section-header-mini">
          <h4>💧 {projection.monthName} {projection.year} Consumption</h4>
          <span className="days-info">
            Day {projection.daysPassed} of {projection.daysInMonth}
          </span>
        </div>

        {/* 3-Column Grid for Circular Progress Bars */}
        <div className="circular-progress-grid">
          {/* Pure Water */}
          <div className="circular-water-card pure">
            {momComparison && (
              <div className="circular-water-header">
                <span className="mom-change-text">
                  {formatChangeText(momComparison.changes.pureWater, momComparison.previousMonth.name)}
                </span>
              </div>
            )}
            <CircularProgress
              percentage={(projection.currentConsumption.pureWater / projection.projectedConsumption.pureWater) * 100}
              size={120}
              strokeWidth={8}
              waterType="pure"
              current={projection.currentConsumption.pureWater}
              projected={projection.projectedConsumption.pureWater}
              unit="gal"
              dailyAvg={projection.dailyAverages.pureWater}
              depletionDays={stockDepletion?.pureWater || 999}
            />
          </div>

          {/* Spring Water */}
          <div className="circular-water-card spring">
            {momComparison && (
              <div className="circular-water-header">
                <span className="mom-change-text">
                  {formatChangeText(momComparison.changes.springWater, momComparison.previousMonth.name)}
                </span>
              </div>
            )}
            <CircularProgress
              percentage={(projection.currentConsumption.springWater / projection.projectedConsumption.springWater) * 100}
              size={120}
              strokeWidth={8}
              waterType="spring"
              current={projection.currentConsumption.springWater}
              projected={projection.projectedConsumption.springWater}
              unit="L"
              dailyAvg={projection.dailyAverages.springWater}
              depletionDays={stockDepletion?.springWater || 999}
            />
          </div>

          {/* Mineral Water */}
          <div className="circular-water-card mineral">
            {momComparison && (
              <div className="circular-water-header">
                <span className="mom-change-text">
                  {formatChangeText(momComparison.changes.mineralWater, momComparison.previousMonth.name)}
                </span>
              </div>
            )}
            <CircularProgress
              percentage={(projection.currentConsumption.mineralWater / projection.projectedConsumption.mineralWater) * 100}
              size={120}
              strokeWidth={8}
              waterType="mineral"
              current={projection.currentConsumption.mineralWater}
              projected={projection.projectedConsumption.mineralWater}
              unit="gal"
              dailyAvg={projection.dailyAverages.mineralWater}
              depletionDays={stockDepletion?.mineralWater || 999}
            />
          </div>
        </div>
      </div>

      {/* Water Consumption Reports Section with Toggle */}
      <div className="consumption-reports-section">
        <div className="section-header-mini">
          <h4>📊 Water Consumption Reports</h4>
          <div className="view-toggle-small">
            <button 
              className={`toggle-btn-small ${consumptionViewMode === 'monthly' ? 'active' : ''}`}
              onClick={() => setConsumptionViewMode('monthly')}
            >
              📅 Monthly View
            </button>
            <button 
              className={`toggle-btn-small ${consumptionViewMode === 'annual' ? 'active' : ''}`}
              onClick={() => setConsumptionViewMode('annual')}
            >
              📈 Annual View
            </button>
          </div>
        </div>

        {/* Monthly View - Historical Consumption */}
        {consumptionViewMode === 'monthly' && (
          <div className="historical-data-expanded">
            <div className="historical-months-grid">
              {historicalData.map((month) => {
                const isExpanded = expandedMonth === month.monthKey;
                
                return (
                  <div
                    key={month.monthKey}
                    className={`historical-month-card ${isExpanded ? 'expanded' : ''}`}
                  >
                    <div
                      className="month-card-header"
                      onClick={() => toggleMonth(month.monthKey)}
                    >
                      <div className="month-header-left">
                        <div className="month-icon">📅</div>
                        <div className="month-info">
                          <h3>{month.monthName} {month.year}</h3>
                          <p className="month-stats">
                            {month.totalOrders} orders • 💧{formatNumber(month.pureWater)}g • 🌊{formatNumber(month.springWater)}L • ⛰️{formatNumber(month.mineralWater)}g
                          </p>
                        </div>
                      </div>
                      <button className="expand-button">
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="month-card-expanded">
                        {/* Daily Consumption Trends - Line Chart */}
                        <div className="mini-chart-container">
                          <h4>Daily Consumption Trends</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart
                              data={month.dailyData}
                              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="day"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(day) => day % 5 === 0 ? day : ''}
                                stroke="#64748b"
                              />
                              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                              <Tooltip 
                                formatter={(value, name) => {
                                  const unit = name === 'Spring Water (L)' ? 'L' : 'gal';
                                  return [`${Math.round(value)} ${unit}`, name];
                                }}
                                labelFormatter={(label) => `Day ${label}`}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="pureWater"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ r: 2, fill: "#3b82f6" }}
                                activeDot={{ r: 5 }}
                                name="Pure Water (gal)"
                              />
                              <Line
                                type="monotone"
                                dataKey="springWater"
                                stroke="#06b6d4"
                                strokeWidth={2}
                                dot={{ r: 2, fill: "#06b6d4" }}
                                activeDot={{ r: 5 }}
                                name="Spring Water (L)"
                              />
                              <Line
                                type="monotone"
                                dataKey="mineralWater"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={{ r: 2, fill: "#f59e0b" }}
                                activeDot={{ r: 5 }}
                                name="Mineral Water (gal)"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Water Type Stats */}
                        <div className="water-breakdown-grid">
                          <div className="water-stat pure">
                            <span className="water-stat-icon">💧</span>
                            <span className="water-stat-value">{formatNumber(month.pureWater)} gal</span>
                            <span className="water-stat-label">Pure Water</span>
                          </div>
                          <div className="water-stat spring">
                            <span className="water-stat-icon">🌊</span>
                            <span className="water-stat-value">{formatNumber(month.springWater)} L</span>
                            <span className="water-stat-label">Spring Water</span>
                          </div>
                          <div className="water-stat mineral">
                            <span className="water-stat-icon">⛰️</span>
                            <span className="water-stat-value">{formatNumber(month.mineralWater)} gal</span>
                            <span className="water-stat-label">Mineral Water</span>
                          </div>
                        </div>

                        <div className="additional-stats">
                          <div className="stat-box">
                            <span className="stat-icon">📦</span>
                            <div>
                              <span className="stat-label">Total Orders</span>
                              <span className="stat-value">{month.totalOrders}</span>
                            </div>
                          </div>
                          <div className="stat-box">
                            <span className="stat-icon">💧</span>
                            <div>
                              <span className="stat-label">Avg Pure/Order</span>
                              <span className="stat-value">
                                {(month.pureWater / month.totalOrders).toFixed(1)} gal
                              </span>
                            </div>
                          </div>
                          <div className="stat-box">
                            <span className="stat-icon">🌊</span>
                            <div>
                              <span className="stat-label">Avg Spring/Order</span>
                              <span className="stat-value">
                                {(month.springWater / month.totalOrders).toFixed(1)} L
                              </span>
                            </div>
                          </div>
                          <div className="stat-box">
                            <span className="stat-icon">⛰️</span>
                            <div>
                              <span className="stat-label">Avg Mineral/Order</span>
                              <span className="stat-value">
                                {(month.mineralWater / month.totalOrders).toFixed(1)} gal
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
          </div>
        )}

        {/* Annual View - Summaries Only (No Chart) */}
        {consumptionViewMode === 'annual' && (
          <div className="annual-data-expanded">
            <div className="annual-report-content">
              <div className="annual-header">
                <div className="year-badge">{annualData.year}</div>
                <div className="year-summary">
                  <h3>{formatNumber(annualData.totals.pureWater + annualData.totals.mineralWater + annualData.totals.springWater)} total units</h3>
                  <p>{annualData.totalOrders} orders • {formatNumber(annualData.avgMonthly.pureWater)} pure/mo avg</p>
                </div>
              </div>

              <div className="annual-metrics">
                <div className="metric-box best">
                  <span className="metric-icon">🏆</span>
                  <div>
                    <span className="metric-label">Best Month</span>
                    <span className="metric-value">{annualData.bestMonth.name}</span>
                    <span className="metric-detail">
                      💧{annualData.bestMonth.pureWater}g • 🌊{annualData.bestMonth.springWater}L • ⛰️{annualData.bestMonth.mineralWater}g
                    </span>
                  </div>
                </div>
                <div className="metric-box worst">
                  <span className="metric-icon">📉</span>
                  <div>
                    <span className="metric-label">Slowest Month</span>
                    <span className="metric-value">{annualData.slowestMonth.name}</span>
                    <span className="metric-detail">
                      💧{annualData.slowestMonth.pureWater}g • 🌊{annualData.slowestMonth.springWater}L • ⛰️{annualData.slowestMonth.mineralWater}g
                    </span>
                  </div>
                </div>
                <div className="metric-box average">
                  <span className="metric-icon">📊</span>
                  <div>
                    <span className="metric-label">Monthly Average</span>
                    <span className="metric-value">Per Month</span>
                    <span className="metric-detail">
                      💧{annualData.avgMonthly.pureWater}g • 🌊{annualData.avgMonthly.springWater}L • ⛰️{annualData.avgMonthly.mineralWater}g
                    </span>
                  </div>
                </div>
              </div>

              <div className="year-summary-box">
                <h4>📈 Year Summary</h4>
                <div className="summary-stats">
                  <div className="summary-stat">
                    <span className="summary-label">Total Pure Water</span>
                    <span className="summary-value">{formatNumber(annualData.totals.pureWater)} gal</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-label">Total Spring Water</span>
                    <span className="summary-value">{formatNumber(annualData.totals.springWater)} L</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-label">Total Mineral Water</span>
                    <span className="summary-value">{formatNumber(annualData.totals.mineralWater)} gal</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-label">Total Orders</span>
                    <span className="summary-value">{annualData.totalOrders}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaterConsumptionAnalytics;