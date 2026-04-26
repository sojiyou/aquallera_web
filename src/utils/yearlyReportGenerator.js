// utils/yearlyReportGenerator.js
import { ref, set, get } from 'firebase/database';
import { database } from '../components/config/Firebase';
import { calculateMonthlyRevenue } from './revenueCalculator';

/**
 * Generate annual report for the year
 * Runs automatically on Dec 31 at 11:59 PM
 */
export const generateAnnualReport = async (stationId, year) => {
  try {
    console.log(`📊 Generating annual report for ${year}...`);
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Calculate revenue for each month
    const monthlyBreakdown = [];
    let totalRevenue = 0;
    let totalOrders = 0;
    let bestMonth = { name: '', revenue: 0, orders: 0 };
    let worstMonth = { name: '', revenue: Infinity, orders: 0 };
    
    // Get orders for counting
    const ordersRef = ref(database, 'orders');
    const ordersSnapshot = await get(ordersRef);
    const allOrders = ordersSnapshot.exists() ? ordersSnapshot.val() : {};
    
    for (let month = 0; month < 12; month++) {
      const revenue = await calculateMonthlyRevenue(stationId, year, month);
      
      // Count orders for this month
      const monthOrders = Object.values(allOrders).filter(order => {
        if (order.stationId !== stationId) return false;
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() === month && 
               orderDate.getFullYear() === year &&
               (order.status === 'completed' || 
                order.status === 'Completed' ||
                order.status === 'delivered' ||
                order.status === 'Delivered');
      }).length;
      
      monthlyBreakdown.push({
        month: monthNames[month],
        monthIndex: month,
        revenue: revenue,
        orders: monthOrders
      });
      
      totalRevenue += revenue;
      totalOrders += monthOrders;
      
      // Track best and worst months
      if (revenue > bestMonth.revenue) {
        bestMonth = {
          name: monthNames[month],
          revenue: revenue,
          orders: monthOrders
        };
      }
      
      if (revenue < worstMonth.revenue) {
        worstMonth = {
          name: monthNames[month],
          revenue: revenue,
          orders: monthOrders
        };
      }
    }
    
    const avgMonthly = totalRevenue / 12;
    
    // Create report data
    const reportData = {
      year,
      total: totalRevenue,
      totalOrders,
      avgMonthly,
      bestMonth,
      worstMonth,
      monthlyBreakdown,
      generatedAt: new Date().toISOString()
    };
    
    // Save to Firebase
    const reportRef = ref(
      database,
      `waterStations/${stationId}/yearlyRevenue/${year}`
    );
    await set(reportRef, reportData);
    
    console.log(`✅ Annual report for ${year} generated successfully:`);
    console.log(`   Total Revenue: ₱${totalRevenue.toFixed(2)}`);
    console.log(`   Total Orders: ${totalOrders}`);
    console.log(`   Avg Monthly: ₱${avgMonthly.toFixed(2)}`);
    console.log(`   Best Month: ${bestMonth.name} (₱${bestMonth.revenue.toFixed(2)})`);
    console.log(`   Worst Month: ${worstMonth.name} (₱${worstMonth.revenue.toFixed(2)})`);
    
    return {
      success: true,
      year,
      data: reportData
    };
    
  } catch (error) {
    console.error(`❌ Error generating annual report for ${year}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get annual report for a specific year
 */
export const getAnnualReport = async (stationId, year) => {
  try {
    const reportRef = ref(
      database,
      `waterStations/${stationId}/yearlyRevenue/${year}`
    );
    const snapshot = await get(reportRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching annual report for ${year}:`, error);
    return null;
  }
};

/**
 * Get all available annual reports
 */
export const getAllAnnualReports = async (stationId) => {
  try {
    const reportsRef = ref(
      database,
      `waterStations/${stationId}/yearlyRevenue`
    );
    const snapshot = await get(reportsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.keys(data)
        .map(year => parseInt(year))
        .sort((a, b) => b - a); // Sort descending (newest first)
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching annual reports list:', error);
    return [];
  }
};