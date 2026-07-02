// src/components/dashboard/WaterConsumptionAnalytics.js
import React, { useState, useEffect } from 'react';
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
      pure: { bg: '#b3e0e3', fill: '#065A82' },
      spring: { bg: '#d4f5f5', fill: '#1C7293' },
      mineral: { bg: '#fed7aa', fill: '#f59e0b' }
    };
    
    const waterKey = waterType === 'pure' ? 'pureWater' : waterType === 'spring' ? 'springWater' : 'mineralWater';
    const unitLabel = getUnit(waterKey);
    const nameLabel = getDisplayName(waterKey);
    
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="font-bold text-slate-800 text-2xl mb-3">{nameLabel}</div>
        <svg width={size} height={size} className="block">
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
            className="transition-all duration-500"
          />
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-2xl font-bold"
            fill={colors[waterType].fill}
          >
            {Math.round(safePercentage)}%
          </text>
        </svg>
        <div className="text-center w-full">
          <div className="text-xl font-semibold text-slate-800">Current: {formatNumber(current)} {unitLabel}</div>
          <div className="text-xl text-slate-500">Projected for month: {formatNumber(projected)} {unitLabel}</div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 w-full flex justify-between items-center gap-4">
          <div className="text-xs text-slate-500 m-0 p-0 leading-relaxed">Daily average: {dailyAvg.toFixed(1)} {unitLabel}/day</div>
          <div className="text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full inline-flex items-center m-0 leading-relaxed">
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
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <div className="border-[3px] border-slate-200 border-t-primary rounded-full w-[30px] h-[30px] animate-spin mb-4"></div>
        <p>Loading consumption data...</p>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl">
        <div className="text-5xl mb-4 opacity-50">💧</div>
        <h4 className="text-slate-800 mb-2">No Consumption Data</h4>
        <p className="text-slate-500 mb-4">Complete some orders to see consumption analytics!</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {useSampleData && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 rounded-lg px-4 py-3 mb-4 flex items-center gap-3 text-amber-800 text-sm">
          <span className="text-xl">🔬</span>
          <span>Showing sample data for demonstration. Real data will appear after Day 3 of the month.</span>
        </div>
      )}

      {/* No Orders Banner for Current Month */}
      {!useSampleData && projection.currentConsumption.pureWater === 0 && 
       projection.currentConsumption.springWater === 0 && 
       projection.currentConsumption.mineralWater === 0 && (
        <div className="bg-primary/10 border-l-4 border-l-primary px-4 py-3 mb-4 rounded-lg text-sm text-blue-700 flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span>No completed orders yet this month. Add orders to see consumption tracking.</span>
        </div>
      )}

      {/* Current Month Section with Circular Progress Bars - 3 COLUMN LAYOUT */}
      <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6 pb-3 border-b-2 border-slate-200">
          <h4 className="text-slate-800 m-0 text-lg">💧 {projection.monthName} {projection.year} Consumption</h4>
          <span className="text-slate-500 text-xs bg-slate-100 px-3 py-1 rounded-full">
            Day {projection.daysPassed} of {projection.daysInMonth}
          </span>
        </div>

        {/* 3-Column Grid for Circular Progress Bars */}
        <div className="grid grid-cols-3 gap-6 mt-4">
          {/* Pure Water */}
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
            {momComparison && (
              <div className="mb-2">
                <span className="text-base font-medium bg-slate-100 px-2.5 py-1 rounded-full inline-block text-slate-600">
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
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
            {momComparison && (
              <div className="mb-2">
                <span className="text-base font-medium bg-slate-100 px-2.5 py-1 rounded-full inline-block text-slate-600">
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
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
            {momComparison && (
              <div className="mb-2">
                <span className="text-base font-medium bg-slate-100 px-2.5 py-1 rounded-full inline-block text-slate-600">
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
      <div className="mt-6">
        <div className="flex justify-between items-center mb-6 pb-3 border-b-2 border-slate-200">
          <h4 className="text-slate-800 m-0 text-lg">📊 Water Consumption Reports</h4>
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-full">
            <button 
              className={`px-4 py-1.5 border-none bg-transparent rounded-full font-medium cursor-pointer transition-all text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 ${consumptionViewMode === 'monthly' ? 'bg-white text-primary shadow-sm' : ''}`}
              onClick={() => setConsumptionViewMode('monthly')}
            >
              📅 Monthly View
            </button>
            <button 
              className={`px-4 py-1.5 border-none bg-transparent rounded-full font-medium cursor-pointer transition-all text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 ${consumptionViewMode === 'annual' ? 'bg-white text-primary shadow-sm' : ''}`}
              onClick={() => setConsumptionViewMode('annual')}
            >
              📈 Annual View
            </button>
          </div>
        </div>

        {/* Monthly View - Historical Consumption */}
        {consumptionViewMode === 'monthly' && (
          <div className="mt-2 p-5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex flex-col gap-3">
              {historicalData.map((month) => {
                const isExpanded = expandedMonth === month.monthKey;
                
                return (
                  <div
                    key={month.monthKey}
                    className={`bg-white rounded-xl border border-slate-200 overflow-hidden transition-all hover:shadow-md ${isExpanded ? '' : ''}`}
                  >
                    <div
                      className="flex justify-between items-center p-4 cursor-pointer"
                      onClick={() => toggleMonth(month.monthKey)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">📅</div>
                        <div className="month-info">
                          <h3 className="m-0 mb-1 text-base text-slate-800">{month.monthName} {month.year}</h3>
                          <p className="m-0 text-xs text-slate-500">
                            {month.totalOrders} orders • 💧{formatNumber(month.pureWater)}g • 🌊{formatNumber(month.springWater)}L • ⛰️{formatNumber(month.mineralWater)}g
                          </p>
                        </div>
                      </div>
                      <button className="bg-none border-none text-base cursor-pointer text-slate-500 p-2 transition-transform hover:scale-110">
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-200 animate-[slideDown_0.2s_ease-out]">
                        {/* Daily Consumption Trends - Line Chart */}
                        <div className="mb-6 px-2">
                          <h4 className="text-slate-800 text-sm m-0 mb-4 font-semibold">Daily Consumption Trends</h4>
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
                                stroke="#065A82"
                                strokeWidth={2}
                                dot={{ r: 2, fill: "#065A82" }}
                                activeDot={{ r: 5 }}
                                name="Pure Water (gal)"
                              />
                              <Line
                                type="monotone"
                                dataKey="springWater"
                                stroke="#1C7293"
                                strokeWidth={2}
                                dot={{ r: 2, fill: "#1C7293" }}
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
                        <div className="grid grid-cols-3 gap-4 mb-5">
                          <div className="text-center p-4 rounded-lg bg-slate-100 border-l-3 border-l-blue-500">
                            <span className="text-2xl block mb-2">💧</span>
                            <span className="text-2xl font-bold text-slate-800 block">{formatNumber(month.pureWater)} gal</span>
                            <span className="text-xs text-slate-500">Pure Water</span>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-slate-100 border-l-3 border-l-secondary">
                            <span className="text-2xl block mb-2">🌊</span>
                            <span className="text-2xl font-bold text-slate-800 block">{formatNumber(month.springWater)} L</span>
                            <span className="text-xs text-slate-500">Spring Water</span>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-slate-100 border-l-3 border-l-amber-500">
                            <span className="text-2xl block mb-2">⛰️</span>
                            <span className="text-2xl font-bold text-slate-800 block">{formatNumber(month.mineralWater)} gal</span>
                            <span className="text-xs text-slate-500">Mineral Water</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <span className="text-xl">📦</span>
                            <div>
                              <span className="text-[0.7rem] text-slate-500 font-medium">Total Orders</span>
                              <span className="text-sm text-slate-800 font-bold">{month.totalOrders}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <span className="text-xl">💧</span>
                            <div>
                              <span className="text-[0.7rem] text-slate-500 font-medium">Avg Pure/Order</span>
                              <span className="text-sm text-slate-800 font-bold">
                                {(month.pureWater / month.totalOrders).toFixed(1)} gal
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <span className="text-xl">🌊</span>
                            <div>
                              <span className="text-[0.7rem] text-slate-500 font-medium">Avg Spring/Order</span>
                              <span className="text-sm text-slate-800 font-bold">
                                {(month.springWater / month.totalOrders).toFixed(1)} L
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <span className="text-xl">⛰️</span>
                            <div>
                              <span className="text-[0.7rem] text-slate-500 font-medium">Avg Mineral/Order</span>
                              <span className="text-sm text-slate-800 font-bold">
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
          <div className="mt-2 p-5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-primary to-primary-dark text-white text-2xl font-bold px-5 py-2 rounded-full">{annualData.year}</div>
                <div className="year-summary">
                  <h3 className="m-0 mb-1 text-lg text-slate-800">{formatNumber(annualData.totals.pureWater + annualData.totals.mineralWater + annualData.totals.springWater)} total units</h3>
                  <p className="m-0 text-xs text-slate-500">{annualData.totalOrders} orders • {formatNumber(annualData.avgMonthly.pureWater)} pure/mo avg</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-4 rounded-xl p-5 transition-all hover:shadow-sm bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/30">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Best Month</span>
                    <span className="text-slate-800 text-lg font-bold">{annualData.bestMonth.name}</span>
                    <span className="text-slate-500 text-xs">
                      💧{annualData.bestMonth.pureWater}g • 🌊{annualData.bestMonth.springWater}L • ⛰️{annualData.bestMonth.mineralWater}g
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl p-5 transition-all hover:shadow-sm bg-gradient-to-br from-red-50 to-red-100 border border-red-300">
                  <span className="text-3xl">📉</span>
                  <div>
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Slowest Month</span>
                    <span className="text-slate-800 text-lg font-bold">{annualData.slowestMonth.name}</span>
                    <span className="text-slate-500 text-xs">
                      💧{annualData.slowestMonth.pureWater}g • 🌊{annualData.slowestMonth.springWater}L • ⛰️{annualData.slowestMonth.mineralWater}g
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl p-5 transition-all hover:shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/30">
                  <span className="text-3xl">📊</span>
                  <div>
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Monthly Average</span>
                    <span className="text-slate-800 text-lg font-bold">Per Month</span>
                    <span className="text-slate-500 text-xs">
                      💧{annualData.avgMonthly.pureWater}g • 🌊{annualData.avgMonthly.springWater}L • ⛰️{annualData.avgMonthly.mineralWater}g
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary-dark to-primary-dark rounded-xl p-6 text-white">
                <h4 className="text-white m-0 mb-4 text-lg">📈 Year Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-lg backdrop-blur">
                    <span className="text-slate-400 text-xs uppercase tracking-wider">Total Pure Water</span>
                    <span className="text-white text-xl font-bold">{formatNumber(annualData.totals.pureWater)} gal</span>
                  </div>
                  <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-lg backdrop-blur">
                    <span className="text-slate-400 text-xs uppercase tracking-wider">Total Spring Water</span>
                    <span className="text-white text-xl font-bold">{formatNumber(annualData.totals.springWater)} L</span>
                  </div>
                  <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-lg backdrop-blur">
                    <span className="text-slate-400 text-xs uppercase tracking-wider">Total Mineral Water</span>
                    <span className="text-white text-xl font-bold">{formatNumber(annualData.totals.mineralWater)} gal</span>
                  </div>
                  <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-lg backdrop-blur">
                    <span className="text-slate-400 text-xs uppercase tracking-wider">Total Orders</span>
                    <span className="text-white text-xl font-bold">{annualData.totalOrders}</span>
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