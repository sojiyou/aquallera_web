import { calculateMonthlyRevenue, getDailyRevenueForMonth, getCurrentDateInfo } from './revenueCalculator';

/**
 * Calculate projected revenue for current month based on velocity
 * FIX: Shows predictions after Day 3 of month (regardless of order count)
 */
export const getCurrentMonthProjection = async (stationId) => {
  const { year, month, day, daysInMonth, daysRemaining } = getCurrentDateInfo();
  
  // Get actual revenue so far this month
  const monthlyData = await getDailyRevenueForMonth(stationId, year, month);
  const currentRevenue = monthlyData.total;
  
  // NEW FIX: Check if we're past Day 3 of the month (not order count)
  const hasMinimumData = day > 3;
  
  // Calculate daily average so far (even if zero)
  const dailyAverage = day > 0 ? currentRevenue / day : 0;
  
  // Project remaining days
  const projectedRemaining = dailyAverage * daysRemaining;
  const projectedTotal = currentRevenue + projectedRemaining;
  
  return {
    hasMinimumData,
    currentRevenue,
    projectedRevenue: projectedTotal,
    dailyAverage,
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
 * Calculate projected revenue for a specific future month
 * Uses current month's daily average velocity
 */
export const getFutureMonthProjection = async (stationId, targetYear, targetMonth) => {
  const { year: currentYear, month: currentMonth, day } = getCurrentDateInfo();
  
  // NEW FIX: Check if we're past Day 3 of the month
  const hasMinimumData = day > 3;
  
  const currentMonthData = await getDailyRevenueForMonth(stationId, currentYear, currentMonth);
  const currentRevenue = currentMonthData.total;
  
  const dailyAverage = day > 0 ? currentRevenue / day : 0;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const projectedRevenue = dailyAverage * daysInTargetMonth;
  
  return {
    hasMinimumData,
    projectedRevenue,
    dailyAverage,
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
export const getYearProjections = async (stationId) => {
  const { year, month, day } = getCurrentDateInfo();
  
  // NEW FIX: Check if we're past Day 3 of the month
  const hasMinimumData = day > 3;
  
  const currentMonth = await getCurrentMonthProjection(stationId);
  
  const futureMonths = [];
  let totalProjection = currentMonth.projectedRevenue || 0;
  
  for (let m = month + 1; m <= 11; m++) {
    const futureMonth = await getFutureMonthProjection(stationId, year, m);
    futureMonths.push(futureMonth);
    if (futureMonth.projectedRevenue) {
      totalProjection += futureMonth.projectedRevenue;
    }
  }
  
  return {
    hasMinimumData,
    currentMonth,
    futureMonths,
    totalYearProjection: totalProjection,
    year,
    warningMessage: null
  };
};

/**
 * Get confidence level based on days of data
 */
export const getConfidenceLevel = (daysPassed) => {
  if (daysPassed <= 6) return { 
    level: 'Low', 
    color: '#f59e0b', 
    message: 'Early in the month - predictions will improve'
  };
  if (daysPassed < 15) return { 
    level: 'Medium', 
    color: '#065A82', 
    message: 'Growing confidence in predictions'
  };
  if (daysPassed < 25) return { 
    level: 'High', 
    color: '#1C7293', 
    message: 'Strong prediction accuracy'
  };
  return { 
    level: 'Very High', 
    color: '#1B3B6F', 
    message: 'Month almost complete - highly accurate',
    icon: ''
  };
};