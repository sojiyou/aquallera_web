// utils/monthlyArchiver.js
import { ref, set, get } from 'firebase/database';
import { database } from '../components/config/Firebase';
import { calculateMonthlyRevenue, getDailyRevenueForArchive } from './revenueCalculator';

/**
 * Archive last month's data automatically
 * Runs at midnight on the 1st of each month
 */
export const archiveLastMonth = async (stationId) => {
  try {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthKey = monthNames[lastMonth];
    
    console.log(`📦 Archiving ${monthKey} ${year} for station ${stationId}...`);
    
    // Get actual revenue for the month
    const actualRevenue = await calculateMonthlyRevenue(stationId, year, lastMonth);
    
    // Get daily breakdown
    const { dailyData, total } = await getDailyRevenueForArchive(stationId, year, lastMonth);
    
    // Get projected revenue (from cache if available)
    let projectedRevenue = 0;
    try {
      const { getRevenueCache } = await import('./revenueCache');
      const cache = getRevenueCache(stationId);
      const cached = cache.getCachedYearProjection();
      
      // If we have cached projections from that month, use them
      if (cached?.currentMonth?.month === lastMonth && cached?.currentMonth?.year === year) {
        projectedRevenue = cached.currentMonth.projectedRevenue || 0;
      }
    } catch (err) {
      console.log('No projected data found, using actual as projected');
      projectedRevenue = actualRevenue; // Fallback: use actual as projected
    }
    
    // Count total orders for the month
    const ordersRef = ref(database, 'orders');
    const ordersSnapshot = await get(ordersRef);
    let monthOrderCount = 0;
    
    if (ordersSnapshot.exists()) {
      const orders = ordersSnapshot.val();
      monthOrderCount = Object.values(orders).filter(order => {
        if (order.stationId !== stationId) return false;
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() === lastMonth && 
               orderDate.getFullYear() === year &&
               (order.status === 'completed' || 
                order.status === 'Completed' ||
                order.status === 'delivered' ||
                order.status === 'Delivered');
      }).length;
    }
    
    // Calculate accuracy
    const accuracy = projectedRevenue > 0 
      ? (actualRevenue / projectedRevenue) * 100 
      : 0;
    
    // Archive data structure
    const archiveData = {
      projected: projectedRevenue,
      actual: actualRevenue,
      orders: monthOrderCount,
      accuracy: parseFloat(accuracy.toFixed(2)),
      dailyData: dailyData,
      archivedAt: new Date().toISOString(),
      month: lastMonth,
      monthName: monthKey,
      year: year
    };
    
    // Save to Firebase
    const archiveRef = ref(
      database, 
      `waterStations/${stationId}/monthlyArchive/${year}/${monthKey}`
    );
    await set(archiveRef, archiveData);
    
    console.log(`✅ Successfully archived ${monthKey} ${year}:`);
    console.log(`   Projected: ₱${projectedRevenue.toFixed(2)}`);
    console.log(`   Actual: ₱${actualRevenue.toFixed(2)}`);
    console.log(`   Accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`   Orders: ${monthOrderCount}`);
    
    return {
      success: true,
      month: monthKey,
      year,
      data: archiveData
    };
    
  } catch (error) {
    console.error('❌ Error archiving last month:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get archived data for a specific month
 */
export const getArchivedMonth = async (stationId, year, monthIndex) => {
  try {
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthKey = monthNames[monthIndex];
    
    const archiveRef = ref(
      database, 
      `waterStations/${stationId}/monthlyArchive/${year}/${monthKey}`
    );
    const snapshot = await get(archiveRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching archived month:', error);
    return null;
  }
};

/**
 * Get all archived months for a specific year
 */
export const getArchivedYear = async (stationId, year) => {
  try {
    const archiveRef = ref(
      database, 
      `waterStations/${stationId}/monthlyArchive/${year}`
    );
    const snapshot = await get(archiveRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching archived year:', error);
    return null;
  }
};

/**
 * Get list of all archived years for a station
 */
export const getArchivedYears = async (stationId) => {
  try {
    const archiveRef = ref(
      database, 
      `waterStations/${stationId}/monthlyArchive`
    );
    const snapshot = await get(archiveRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.keys(data).map(year => parseInt(year)).sort((a, b) => b - a);
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching archived years:', error);
    return [];
  }
};