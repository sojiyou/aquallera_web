/**
 * Format daily revenue data for Recharts line chart
 * Creates actual + projected segments with dashed line for future days
 */
export const formatMonthlyChartData = (dailyData, currentDay, daysInMonth, projectedDailyAverage) => {
  const chartData = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = dailyData.find(d => d.day === day);
    const actualRevenue = dayData?.revenue || 0;
    
    const cumulativeActual = dailyData
      .filter(d => d.day <= day)
      .reduce((sum, d) => sum + d.revenue, 0);
    
    if (day <= currentDay) {
      chartData.push({
        day,
        dayLabel: `Day ${day}`,
        actual: cumulativeActual,
        projected: null,
        isProjected: false,
        revenue: actualRevenue // Daily revenue for tooltips
      });
    } else {
      const daysProjected = day - currentDay;
      const projectedAdditional = projectedDailyAverage * daysProjected;
      const projectedCumulative = cumulativeActual + projectedAdditional;
      
      chartData.push({
        day,
        dayLabel: `Day ${day}`,
        actual: null,
        projected: projectedCumulative,
        isProjected: true,
        revenue: projectedDailyAverage // Estimated daily revenue
      });
    }
  }
  
  return chartData;
};

/**
 * Format data specifically for Recharts with two lines:
 * - Solid line: Actual cumulative revenue
 * - Dashed line: Projected cumulative revenue
 */
export const getRechartsMonthlyData = async (stationId, year, month, projectedDailyAverage) => {
  const { getDailyRevenueForMonth } = await import('./revenueCalculator');
  
  const { dailyData } = await getDailyRevenueForMonth(stationId, year, month);
  
  const now = new Date();
  const currentDay = now.getMonth() === month && now.getFullYear() === year 
    ? now.getDate() 
    : new Date(year, month + 1, 0).getDate(); // If viewing past month, show all days as actual
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // If we're viewing a past month, show all as actual with no projections
  if (now.getMonth() !== month || now.getFullYear() !== year) {
    const chartData = [];
    let cumulative = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = dailyData.find(d => d.day === day);
      cumulative += dayData?.revenue || 0;
      
      chartData.push({
        day,
        dayLabel: `Day ${day}`,
        actual: cumulative,
        projected: null,
        isProjected: false,
        revenue: dayData?.revenue || 0
      });
    }
    
    return {
      chartData,
      totalRevenue: cumulative,
      isCompleteMonth: true
    };
  }
  
  const chartData = formatMonthlyChartData(
    dailyData,
    currentDay,
    daysInMonth,
    projectedDailyAverage
  );
  
  const totalActual = dailyData.reduce((sum, d) => sum + d.revenue, 0);
  
  return {
    chartData,
    totalActual,
    currentDay,
    daysInMonth,
    isCompleteMonth: false
  };
};

/**
 * Get chart configuration for Recharts
 */
export const getChartConfig = () => ({
  margin: { top: 20, right: 30, left: 20, bottom: 10 },
  lineProps: {
    actual: {
      type: "monotone",
      stroke: "#065A82",
      strokeWidth: 3,
      dot: { r: 4, fill: "#065A82" },
      activeDot: { r: 6 },
      name: "Actual Revenue"
    },
    projected: {
      type: "monotone",
      stroke: "#94a3b8",
      strokeWidth: 3,
      strokeDasharray: "5 5",
      dot: { r: 3, fill: "#94a3b8" },
      name: "Projected Revenue"
    }
  },
  yAxis: {
    tickFormatter: (value) => `₱${value.toLocaleString()}`
  },
  tooltip: {
    formatter: (value) => [`₱${value?.toLocaleString() || 0}`, "Revenue"],
    labelFormatter: (label) => `Day ${label}`
  }
});