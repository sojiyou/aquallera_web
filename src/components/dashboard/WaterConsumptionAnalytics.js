// src/components/dashboard/WaterConsumptionAnalytics.js
import React, { useState, useEffect } from 'react';
import { 
  getCurrentMonthConsumptionProjection, 
  calculateStockDepletion,
  getMonthOverMonthComparison,
} from '../../utils/consumptionProjection';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
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
    daysRemaining: 16,
    daysInMonth: 30,
    daysPassed: 14,
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

const WaterConsumptionAnalytics = ({ stationId, currentStock, waterTypes }) => {
  const activeWaterTypes = waterTypes && waterTypes.length > 0 ? waterTypes : ['pure', 'spring', 'mineral'];
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState(null);
  const [stockDepletion, setStockDepletion] = useState(null);
  const [momComparison, setMomComparison] = useState(null);
  const [useSampleData, setUseSampleData] = useState(true);
  const [forceSampleData, setForceSampleData] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [historicalData, setHistoricalData] = useState(SAMPLE_DATA.historicalData);
  const [annualData, setAnnualData] = useState(SAMPLE_DATA.annualData);
  
  // View Mode State for Water Consumption
  const [consumptionViewMode, setConsumptionViewMode] = useState('monthly');

  useEffect(() => {
    loadConsumptionData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  const loadConsumptionData = async () => {
    setLoading(true);
    try {
      const proj = await getCurrentMonthConsumptionProjection(stationId);
      
      if (!proj.hasMinimumData) {
        console.log('Using sample data for Water Consumption Analytics demo');
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

  // ===== Manual Sample Data Toggle =====
  const handleToggleSample = () => {
    if (forceSampleData) {
      setForceSampleData(false);
      loadConsumptionData();
    } else {
      setForceSampleData(true);
      setProjection(SAMPLE_DATA.projection);
      setMomComparison(SAMPLE_DATA.momComparison);
      if (currentStock) {
        setStockDepletion(calculateStockDepletion(currentStock, SAMPLE_DATA.projection.dailyAverages));
      }
    }
  };
  
  // Helper to get unit for water type
  const getUnit = (waterType) => {
    if (waterType === 'springWater') return 'gal';
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
    const direction = change > 0 ? 'more than' : 'less than';
    return `${Math.abs(change).toFixed(1)}% ${direction} ${previousMonthName}`;
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
        <div className="font-bold text-slate-800 text-xl sm:text-2xl mb-3">{nameLabel}</div>
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
          <div className="text-sm sm:text-xl font-semibold text-slate-800">Current: {formatNumber(current)} {unitLabel}</div>
          <div className="text-sm sm:text-xl text-slate-500">Projected: {formatNumber(projected)} {unitLabel}</div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-slate-500">
        <div className="border-[3px] border-slate-200 border-t-primary rounded-full w-[30px] h-[30px] animate-spin mb-4"></div>
        <p>Loading consumption data...</p>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="text-center py-8 sm:py-12 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl">
        <div className="text-4xl sm:text-5xl mb-4 opacity-50"></div>
        <h4 className="text-slate-800 mb-2">No Consumption Data</h4>
        <p className="text-slate-500 mb-4">Complete some orders to see consumption analytics!</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {(useSampleData || forceSampleData) && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 rounded-lg px-4 py-3 mb-4 flex items-center gap-3 text-amber-800 text-sm">
          <span className="text-xl"></span>
          <span>{forceSampleData ? 'Showing sample data for demonstration. Click the toggle again to return to live data.' : 'Showing sample data for demonstration. Real data will appear after Day 3 of the month.'}</span>
        </div>
      )}

      {/* No Orders Banner for Current Month */}
      {!useSampleData && projection.currentConsumption.pureWater === 0 && 
       projection.currentConsumption.springWater === 0 && 
       projection.currentConsumption.mineralWater === 0 && (
        <div className="bg-primary/10 border-l-4 border-l-primary px-4 py-3 mb-4 rounded-lg text-sm text-blue-700 flex items-center gap-2">
          <span className="text-lg"></span>
          <span>No completed orders yet this month. Add orders to see consumption tracking.</span>
        </div>
      )}

      {/* Current Month Section with Circular Progress Bars - 3 COLUMN LAYOUT */}
      <div className="bg-white rounded-xl p-4 sm:p-6 mb-6 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6 pb-3 border-b-2 border-slate-200 flex-wrap gap-2">
          <h4 className="text-slate-800 m-0 text-base sm:text-lg">{projection.monthName} {projection.year} Consumption</h4>
          <span className="text-slate-500 text-xs bg-slate-100 px-3 py-1 rounded-full">
            Day {projection.daysPassed} of {projection.daysInMonth}
          </span>
        </div>

        {/* 3-Column Grid for Circular Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-4">
          {[
            {
              waterKey: 'pure',
              stockKey: 'pureWater',
              momChange: momComparison?.changes?.pureWater,
              percentage: (projection.currentConsumption.pureWater / projection.projectedConsumption.pureWater) * 100,
              current: projection.currentConsumption.pureWater,
              projected: projection.projectedConsumption.pureWater,
              dailyAvg: projection.dailyAverages.pureWater,
              depletionDays: stockDepletion?.pureWater || 999,
            },
            {
              waterKey: 'spring',
              stockKey: 'springWater',
              momChange: momComparison?.changes?.springWater,
              percentage: (projection.currentConsumption.springWater / projection.projectedConsumption.springWater) * 100,
              current: projection.currentConsumption.springWater,
              projected: projection.projectedConsumption.springWater,
              dailyAvg: projection.dailyAverages.springWater,
              depletionDays: stockDepletion?.springWater || 999,
            },
            {
              waterKey: 'mineral',
              stockKey: 'mineralWater',
              momChange: momComparison?.changes?.mineralWater,
              percentage: (projection.currentConsumption.mineralWater / projection.projectedConsumption.mineralWater) * 100,
              current: projection.currentConsumption.mineralWater,
              projected: projection.projectedConsumption.mineralWater,
              dailyAvg: projection.dailyAverages.mineralWater,
              depletionDays: stockDepletion?.mineralWater || 999,
            },
          ].map(entry => {
            const active = activeWaterTypes.includes(entry.waterKey);
            if (!active) {
              return (
                <div key={entry.waterKey} className="bg-slate-50 rounded-2xl p-3 sm:p-5 text-center shadow-sm border border-dashed border-slate-300 flex flex-col items-center justify-center min-h-[180px] opacity-70">
                  <div className="text-4xl mb-3 text-slate-300"></div>
                  <div className="font-bold text-slate-400 text-xl sm:text-2xl mb-1">{getDisplayName(entry.stockKey)}</div>
                  <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full mt-2">Water type unavailable</div>
                </div>
              );
            }
            return (
              <div key={entry.waterKey} className="bg-white rounded-2xl p-3 sm:p-5 text-center shadow-sm border border-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
                {momComparison && (
                  <div className="mb-2">
                    <span className="text-xs sm:text-base font-medium bg-slate-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full inline-block text-slate-600">
                      {formatChangeText(entry.momChange, momComparison.previousMonth.name)}
                    </span>
                  </div>
                )}
                <CircularProgress
                  percentage={entry.percentage}
                  size={120}
                  strokeWidth={8}
                  waterType={entry.waterKey}
                  current={entry.current}
                  projected={entry.projected}
                  unit="gal"
                  dailyAvg={entry.dailyAvg}
                  depletionDays={entry.depletionDays}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Water Consumption Reports Section with Toggle */}
      <div className="mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-3 border-b-2 border-slate-200 gap-3">
          <h4 className="text-slate-800 m-0 text-base sm:text-lg">Water Consumption Reports</h4>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleSample}
              className={`px-4 py-2 border-none rounded-full font-medium cursor-pointer transition-all text-xs ${forceSampleData || useSampleData ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'}`}
            >
              {forceSampleData || useSampleData ? 'Viewing Sample Data - Click for Live Data' : 'View Sample Data'}
            </button>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-full">
              <div className="relative group">
                <button 
                  className={`px-4 py-1.5 border-none bg-transparent rounded-full font-medium cursor-pointer transition-all text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 ${consumptionViewMode === 'monthly' ? 'bg-white text-primary shadow-sm' : ''}`}
                  onClick={() => setConsumptionViewMode('monthly')}
                >
                  Monthly View
                </button>
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Monthly water usage breakdown
                </span>
              </div>
              <div className="relative group">
                <button 
                  className={`px-4 py-1.5 border-none bg-transparent rounded-full font-medium cursor-pointer transition-all text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 ${consumptionViewMode === 'annual' ? 'bg-white text-primary shadow-sm' : ''}`}
                  onClick={() => setConsumptionViewMode('annual')}
                >
                  Annual View
                </button>
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Yearly consumption trends
                </span>
              </div>
            </div>
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
                        <div className="text-2xl"></div>
                        <div className="month-info min-w-0 flex-1">
                          <h3 className="m-0 mb-1 text-base text-slate-800">{month.monthName} {month.year}</h3>
                          <p className="m-0 text-xs text-slate-500 truncate">
                            {month.totalOrders} orders
                          </p>
                        </div>
                      </div>
                      <button className="bg-none border-none text-base cursor-pointer text-slate-500 p-2 transition-transform hover:scale-110">
                        {isExpanded ? 'Hide' : 'Show'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-200 animate-[slideDown_0.2s_ease-out]">
                        {/* Daily Consumption Trends - Stacked Bar Chart */}
                        <div className="mb-6">
                          <h4 className="text-slate-800 text-sm m-0 mb-4 font-semibold">Daily Consumption Trends</h4>
                          <div className="hidden md:block">
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart
                                data={month.dailyData}
                                margin={{ top: 5, right: 4, left: -10, bottom: 0 }}
                                barSize={8}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis
                                  dataKey="day"
                                  tick={{ fontSize: 10 }}
                                  tickFormatter={(day) => day % 5 === 0 ? day : ''}
                                  stroke="#94a3b8"
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis
                                  tick={{ fontSize: 10 }}
                                  stroke="#94a3b8"
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  formatter={(value, name) => {
                                    const labels = { pureWater: 'Pure Water', springWater: 'Spring Water', mineralWater: 'Mineral Water' };
                                    return [`${Math.round(value)} gal`, labels[name] || name];
                                  }}
                                  labelFormatter={(label) => `Day ${label}`}
                                  contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                                <Legend
                                  wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                                  iconType="circle"
                                  iconSize={8}
                                />
                                <Bar
                                  dataKey="pureWater"
                                  stackId="consumption"
                                  fill="#065A82"
                                  radius={[0, 0, 0, 0]}
                                  name="Pure Water"
                                  hide={!activeWaterTypes.includes('pure')}
                                />
                                <Bar
                                  dataKey="springWater"
                                  stackId="consumption"
                                  fill="#1C7293"
                                  radius={[0, 0, 0, 0]}
                                  name="Spring Water"
                                  hide={!activeWaterTypes.includes('spring')}
                                />
                                <Bar
                                  dataKey="mineralWater"
                                  stackId="consumption"
                                  fill="#f59e0b"
                                  radius={[0, 0, 4, 4]}
                                  name="Mineral Water"
                                  hide={!activeWaterTypes.includes('mineral')}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="block md:hidden text-center py-6 px-4 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-slate-400 mb-2 block">Charts are available on tablet and desktop views</span>
                          </div>
                        </div>

                        {/* Water Type Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
                          {[
                            { key: 'pure', stockKey: 'pureWater', label: 'Pure Water', border: 'border-l-blue-500' },
                            { key: 'spring', stockKey: 'springWater', label: 'Spring Water', border: 'border-l-secondary' },
                            { key: 'mineral', stockKey: 'mineralWater', label: 'Mineral Water', border: 'border-l-amber-500' },
                          ].map(stat => {
                            if (!activeWaterTypes.includes(stat.key)) {
                              return (
                                <div key={stat.key} className="text-center p-4 rounded-lg bg-slate-50 border border-dashed border-slate-300">
                                  <span className="text-xs text-slate-400">{stat.label}</span>
                                  <span className="block text-xs text-slate-400 mt-1 bg-slate-100 px-3 py-1 rounded-full w-fit mx-auto">Water type unavailable</span>
                                </div>
                              );
                            }
                            return (
                              <div key={stat.key} className={`text-center p-4 rounded-lg bg-slate-100 border-l-3 ${stat.border}`}>
                                <span className="text-2xl block mb-2"></span>
                                <span className="text-2xl font-bold text-slate-800 block">{formatNumber(month[stat.stockKey])} gal</span>
                                <span className="text-xs text-slate-500">{stat.label}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 sm:p-3">
                            <span className="text-lg sm:text-xl flex-shrink-0"></span>
                            <div className="min-w-0 text-center sm:text-left">
                              <span className="block text-[10px] sm:text-[0.7rem] text-slate-500 font-medium leading-tight">Total Orders</span>
                              <span className="block text-sm sm:text-base text-slate-800 font-bold leading-tight">{month.totalOrders}</span>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 sm:p-3">
                            <span className="text-lg sm:text-xl flex-shrink-0"></span>
                            <div className="min-w-0 text-center sm:text-left">
                              <span className="block text-[10px] sm:text-[0.7rem] text-slate-500 font-medium leading-tight">Avg Pure/Order</span>
                              <span className="block text-sm sm:text-base text-slate-800 font-bold leading-tight break-words">
                                {(month.pureWater / month.totalOrders).toFixed(1)} gal
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 sm:p-3">
                            <span className="text-lg sm:text-xl flex-shrink-0"></span>
                            <div className="min-w-0 text-center sm:text-left">
                              <span className="block text-[10px] sm:text-[0.7rem] text-slate-500 font-medium leading-tight">Avg Spring/Order</span>
                              <span className="block text-sm sm:text-base text-slate-800 font-bold leading-tight break-words">
                                {(month.springWater / month.totalOrders).toFixed(1)} gal
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 sm:p-3">
                            <span className="text-lg sm:text-xl flex-shrink-0"></span>
                            <div className="min-w-0 text-center sm:text-left">
                              <span className="block text-[10px] sm:text-[0.7rem] text-slate-500 font-medium leading-tight">Avg Mineral/Order</span>
                              <span className="block text-sm sm:text-base text-slate-800 font-bold leading-tight break-words">
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

        {/* Annual View */}
        {consumptionViewMode === 'annual' && (
          <div className="mt-2 p-4 sm:p-5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-primary to-primary-dark text-white text-xl sm:text-2xl font-bold px-4 sm:px-5 py-1.5 sm:py-2 rounded-full">{annualData.year}</div>
                <div className="min-w-0">
                  <h3 className="m-0 mb-1 text-base sm:text-lg text-slate-800">{formatNumber(annualData.totals.pureWater + annualData.totals.mineralWater + annualData.totals.springWater)} total units</h3>
                  <p className="m-0 text-xs text-slate-500 truncate">{annualData.totalOrders} orders • {formatNumber(annualData.avgMonthly.pureWater)} pure/mo avg</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 rounded-xl p-3 sm:p-5 transition-all hover:shadow-sm bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/30">
                  <span className="text-2xl sm:text-3xl"></span>
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Best Month</span>
                    <span className="text-slate-800 text-base sm:text-lg font-bold block truncate">{annualData.bestMonth.name}</span>
                    <span className="text-slate-500 text-[10px] sm:text-xs truncate block">
                      {annualData.bestMonth.pureWater}g P • {annualData.bestMonth.springWater}g S • {annualData.bestMonth.mineralWater}g M
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 rounded-xl p-3 sm:p-5 transition-all hover:shadow-sm bg-gradient-to-br from-red-50 to-red-100 border border-red-300">
                  <span className="text-2xl sm:text-3xl"></span>
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Slowest Month</span>
                    <span className="text-slate-800 text-base sm:text-lg font-bold block truncate">{annualData.slowestMonth.name}</span>
                    <span className="text-slate-500 text-[10px] sm:text-xs truncate block">
                      {annualData.slowestMonth.pureWater}g P • {annualData.slowestMonth.springWater}g S • {annualData.slowestMonth.mineralWater}g M
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 rounded-xl p-3 sm:p-5 transition-all hover:shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/30">
                  <span className="text-2xl sm:text-3xl"></span>
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Monthly Average</span>
                    <span className="text-slate-800 text-base sm:text-lg font-bold block">Per Month</span>
                    <span className="text-slate-500 text-[10px] sm:text-xs truncate block">
                      {annualData.avgMonthly.pureWater}g P • {annualData.avgMonthly.springWater}g S • {annualData.avgMonthly.mineralWater}g M
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary-dark to-primary-dark rounded-xl p-4 sm:p-6 text-white">
                <h4 className="text-white m-0 mb-4 text-base sm:text-lg">Year Summary</h4>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { key: 'pure', stockKey: 'pureWater', label: 'Total Pure Water' },
                    { key: 'spring', stockKey: 'springWater', label: 'Total Spring Water' },
                    { key: 'mineral', stockKey: 'mineralWater', label: 'Total Mineral Water' },
                  ].map(t => {
                    if (!activeWaterTypes.includes(t.key)) {
                      return (
                        <div key={t.key} className="flex flex-col gap-1 sm:gap-2 bg-white/10 p-3 sm:p-4 rounded-lg backdrop-blur opacity-60">
                          <span className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">{t.label}</span>
                          <span className="text-slate-400 text-sm sm:text-xl font-bold">Water type unavailable</span>
                        </div>
                      );
                    }
                    return (
                      <div key={t.key} className="flex flex-col gap-1 sm:gap-2 bg-white/10 p-3 sm:p-4 rounded-lg backdrop-blur">
                        <span className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">{t.label}</span>
                        <span className="text-white text-sm sm:text-xl font-bold">{formatNumber(annualData.totals[t.stockKey])} gal</span>
                      </div>
                    );
                  })}
                  <div className="flex flex-col gap-1 sm:gap-2 bg-white/10 p-3 sm:p-4 rounded-lg backdrop-blur">
                    <span className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">Total Orders</span>
                    <span className="text-white text-sm sm:text-xl font-bold">{annualData.totalOrders}</span>
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