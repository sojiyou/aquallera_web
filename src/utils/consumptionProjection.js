// utils/consumptionProjection.js
import { getDailyConsumptionForMonth, getCurrentDateInfo } from './consumptionCalculator';

/**
 * Calculate projected consumption for current month based on velocity
 * Shows predictions after Day 3 of month
 */
export const getCurrentMonthConsumptionProjection = async (stationId) => {
  const { year, month, day, daysInMonth, daysRemaining } = getCurrentDateInfo();
  
  // Get actual consumption so far this month
  const { dailyData, totals } = await getDailyConsumptionForMonth(stationId, year, month);
  const currentConsumption = totals;
  
  // Check if we're past Day 3 of the month
  const hasMinimumData = day > 3;
  
  // Calculate daily averages so far
  const dailyAverages = {
    pureWater: day > 0 ? currentConsumption.pureWater / day : 0,
    springWater: day > 0 ? currentConsumption.springWater / day : 0,
    mineralWater: day > 0 ? currentConsumption.mineralWater / day : 0
  };
  
  // Project remaining days
  const projectedRemaining = {
    pureWater: dailyAverages.pureWater * daysRemaining,
    springWater: dailyAverages.springWater * daysRemaining,
    mineralWater: dailyAverages.mineralWater * daysRemaining
  };
  
  const projectedTotals = {
    pureWater: currentConsumption.pureWater + projectedRemaining.pureWater,
    springWater: currentConsumption.springWater + projectedRemaining.springWater,
    mineralWater: currentConsumption.mineralWater + projectedRemaining.mineralWater
  };
  
  return {
    hasMinimumData,
    currentConsumption,
    projectedConsumption: projectedTotals,
    dailyAverages,
    daysRemaining,
    daysInMonth,
    daysPassed: day,
    month,
    year,
    monthName: new Date(year, month).toLocaleString('default', { month: 'long' }),
    warningMessage: null
  };
};

/**
 * Calculate projected consumption for a specific future month
 */
export const getFutureMonthConsumptionProjection = async (stationId, targetYear, targetMonth) => {
  const { year: currentYear, month: currentMonth, day } = getCurrentDateInfo();
  
  const hasMinimumData = day > 3;
  
  const { totals: currentConsumption } = await getDailyConsumptionForMonth(stationId, currentYear, currentMonth);
  
  const dailyAverages = {
    pureWater: day > 0 ? currentConsumption.pureWater / day : 0,
    springWater: day > 0 ? currentConsumption.springWater / day : 0,
    mineralWater: day > 0 ? currentConsumption.mineralWater / day : 0
  };
  
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  
  const projectedConsumption = {
    pureWater: dailyAverages.pureWater * daysInTargetMonth,
    springWater: dailyAverages.springWater * daysInTargetMonth,
    mineralWater: dailyAverages.mineralWater * daysInTargetMonth
  };
  
  return {
    hasMinimumData,
    projectedConsumption,
    dailyAverages,
    daysInMonth: daysInTargetMonth,
    month: targetMonth,
    year: targetYear,
    monthName: new Date(targetYear, targetMonth).toLocaleString('default', { month: 'long' }),
    warningMessage: null
  };
};

/**
 * Get projections for all remaining months in the year
 */
export const getYearConsumptionProjections = async (stationId) => {
  const { year, month, day } = getCurrentDateInfo();
  
  const hasMinimumData = day > 3;
  
  const currentMonth = await getCurrentMonthConsumptionProjection(stationId);
  
  const futureMonths = [];
  let yearlyProjection = {
    pureWater: currentMonth.projectedConsumption?.pureWater || 0,
    springWater: currentMonth.projectedConsumption?.springWater || 0,
    mineralWater: currentMonth.projectedConsumption?.mineralWater || 0
  };
  
  for (let m = month + 1; m <= 11; m++) {
    const futureMonth = await getFutureMonthConsumptionProjection(stationId, year, m);
    futureMonths.push(futureMonth);
    if (futureMonth.projectedConsumption) {
      yearlyProjection.pureWater += futureMonth.projectedConsumption.pureWater;
      yearlyProjection.springWater += futureMonth.projectedConsumption.springWater;
      yearlyProjection.mineralWater += futureMonth.projectedConsumption.mineralWater;
    }
  }
  
  return {
    hasMinimumData,
    currentMonth,
    futureMonths,
    yearlyProjection,
    year,
    warningMessage: null
  };
};

/**
 * Calculate stock depletion forecast
 * @param {Object} currentStock - Current stock levels from Firebase
 * @param {Object} dailyAverages - Daily consumption averages
 * @returns {Object} - Days until depletion for each water type
 */
export const calculateStockDepletion = (currentStock, dailyAverages) => {
  const depletion = {};
  
  // Pure Water (gallons)
  depletion.pureWater = dailyAverages.pureWater > 0 
    ? Math.floor(currentStock.pureWater / dailyAverages.pureWater)
    : 999; // Effectively infinite if no consumption
  
  // Spring Water (liters)
  depletion.springWater = dailyAverages.springWater > 0
    ? Math.floor(currentStock.springWater / dailyAverages.springWater)
    : 999;
  
  // Mineral Water (gallons)
  depletion.mineralWater = dailyAverages.mineralWater > 0
    ? Math.floor(currentStock.mineralWater / dailyAverages.mineralWater)
    : 999;
  
  return depletion;
};

/**
 * Get month-over-month comparison
 */
export const getMonthOverMonthComparison = async (stationId) => {
  const { year, month } = getCurrentDateInfo();
  
  // Current month consumption
  const currentMonthData = await getDailyConsumptionForMonth(stationId, year, month);
  
  // Previous month
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = year - 1;
  }
  
  const prevMonthData = await getDailyConsumptionForMonth(stationId, prevYear, prevMonth);
  
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };
  
  return {
    currentMonth: {
      name: new Date(year, month).toLocaleString('default', { month: 'long' }),
      ...currentMonthData.totals
    },
    previousMonth: {
      name: new Date(prevYear, prevMonth).toLocaleString('default', { month: 'long' }),
      ...prevMonthData.totals
    },
    changes: {
      pureWater: calculateChange(currentMonthData.totals.pureWater, prevMonthData.totals.pureWater),
      springWater: calculateChange(currentMonthData.totals.springWater, prevMonthData.totals.springWater),
      mineralWater: calculateChange(currentMonthData.totals.mineralWater, prevMonthData.totals.mineralWater)
    }
  };
};

/**
 * Get confidence level based on days of data (same as revenue)
 */
export const getConsumptionConfidenceLevel = (daysPassed) => {
  if (daysPassed <= 6) return { 
    level: 'Low', 
    color: '#f59e0b', 
    message: 'Early in the month - predictions will improve',
    icon: '📊'
  };
  if (daysPassed < 15) return { 
    level: 'Medium', 
    color: '#3b82f6', 
    message: 'Growing confidence in predictions',
    icon: '📈'
  };
  if (daysPassed < 25) return { 
    level: 'High', 
    color: '#10b981', 
    message: 'Strong prediction accuracy',
    icon: '🔮'
  };
  return { 
    level: 'Very High', 
    color: '#059669', 
    message: 'Month almost complete - highly accurate',
    icon: '✅'
  };
};