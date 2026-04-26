//revenueCalculator.js
import { ref, onValue, get } from 'firebase/database';
import { database } from '../components/config/Firebase';

/**
 * Calculate total revenue for a specific month and year
 * @param {string} stationId - Water station ID
 * @param {number} year - e.g., 2026
 * @param {number} month - 0-11 (0 = January, 1 = February, etc.)
 * @returns {Promise<number>} - Total revenue in ₱
 */
export const calculateMonthlyRevenue = async (stationId, year, month) => {
  try {
    // ✅ FIX: Get ALL orders from root level (not nested under stationId)
    const ordersRef = ref(database, 'orders');
    
    return new Promise((resolve) => {
      onValue(ordersRef, (snapshot) => {
        const orders = snapshot.val();
        if (!orders) {
          resolve(0);
          return;
        }

        // ✅ FIX: Filter orders for this specific station AND month/year
        const monthlyTotal = Object.values(orders)
          .filter(order => {
            // Match station ID
            if (order.stationId !== stationId) return false;
            
            // Match month/year and completed status
            const orderDate = new Date(order.createdAt);
            return orderDate.getMonth() === month && 
                   orderDate.getFullYear() === year &&
                   (order.status === 'completed' || 
                    order.status === 'Completed' ||
                    order.status === 'delivered' ||
                    order.status === 'Delivered');
          })
          .reduce((sum, order) => {
            // ✅ FIX: Calculate total from individual water type totals + delivery fee
            const pureTotal = parseFloat(order.pureWaterTotal) || 0;
            const springTotal = parseFloat(order.springWaterTotal) || 0;
            const mineralTotal = parseFloat(order.mineralWaterTotal) || 0;
            const deliveryFee = parseFloat(order.deliveryFee) || 0;
            return sum + pureTotal + springTotal + mineralTotal + deliveryFee;
          }, 0);

        console.log(`📊 Month ${month + 1}/${year}: ₱${monthlyTotal.toFixed(2)} (${Object.values(orders).filter(o => o.stationId === stationId).length} orders)`);
        resolve(monthlyTotal);
      }, { onlyOnce: true });
    });
  } catch (error) {
    console.error('Error calculating monthly revenue:', error);
    return 0;
  }
};

/**
 * Get daily revenue data for a specific month (for chart)
 * @param {string} stationId 
 * @param {number} year 
 * @param {number} month 
 * @returns {Promise<Object>} - Daily breakdown
 */
export const getDailyRevenueForMonth = async (stationId, year, month) => {
  try {
    // ✅ FIX: Get ALL orders from root level
    const ordersRef = ref(database, 'orders');
    
    return new Promise((resolve) => {
      onValue(ordersRef, (snapshot) => {
        const orders = snapshot.val();
        if (!orders) {
          resolve({ dailyData: [], total: 0 });
          return;
        }

        // Create map of day -> revenue
        const dailyRevenue = {};
        
        Object.values(orders)
          .filter(order => {
            // ✅ FIX: Match station ID first
            if (order.stationId !== stationId) return false;
            
            const orderDate = new Date(order.createdAt);
            return orderDate.getMonth() === month && 
                   orderDate.getFullYear() === year &&
                   (order.status === 'completed' ||
                    order.status === 'Completed' ||
                    order.status === 'delivered' ||
                    order.status === 'Delivered');
          })
          .forEach(order => {
            const orderDate = new Date(order.createdAt);
            const day = orderDate.getDate();
            
            // ✅ FIX: Calculate total properly
            const orderTotal = (parseFloat(order.pureWaterTotal) || 0) +
                              (parseFloat(order.springWaterTotal) || 0) +
                              (parseFloat(order.mineralWaterTotal) || 0) +
                              (parseFloat(order.deliveryFee) || 0);
            
            dailyRevenue[day] = (dailyRevenue[day] || 0) + orderTotal;
          });

        // Convert to array format for chart
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dailyData = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
          dailyData.push({
            day,
            revenue: dailyRevenue[day] || 0
          });
        }

        const total = Object.values(dailyRevenue).reduce((a, b) => a + b, 0);
        
        console.log(`📅 Daily data for ${month + 1}/${year}: ${dailyData.filter(d => d.revenue > 0).length} days with revenue, Total: ₱${total.toFixed(2)}`);

        resolve({
          dailyData,
          total
        });
      }, { onlyOnce: true });
    });
  } catch (error) {
    console.error('Error getting daily revenue:', error);
    return { dailyData: [], total: 0 };
  }
};

/**
 * ===== NEW FUNCTION FOR ARCHIVING =====
 * Get daily revenue breakdown for archiving (uses get() instead of onValue)
 * This version doesn't create listeners - safer for archiving
 */
export const getDailyRevenueForArchive = async (stationId, year, month) => {
  try {
    const ordersRef = ref(database, 'orders');
    const snapshot = await get(ordersRef);
    
    if (!snapshot.exists()) {
      return { dailyData: [], total: 0 };
    }
    
    const orders = snapshot.val();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Initialize daily data
    const dailyRevenue = new Array(daysInMonth).fill(0);
    
    // Calculate revenue for each day
    Object.values(orders).forEach(order => {
      if (order.stationId !== stationId) return;
      
      const orderDate = new Date(order.createdAt);
      if (orderDate.getMonth() !== month || orderDate.getFullYear() !== year) return;
      
      // Only count completed/delivered orders
      if (!(order.status === 'completed' || 
            order.status === 'Completed' ||
            order.status === 'delivered' ||
            order.status === 'Delivered')) {
        return;
      }
      
      const day = orderDate.getDate();
      const pureTotal = parseFloat(order.pureWaterTotal) || 0;
      const springTotal = parseFloat(order.springWaterTotal) || 0;
      const mineralTotal = parseFloat(order.mineralWaterTotal) || 0;
      const deliveryFee = parseFloat(order.deliveryFee) || 0;
      
      const orderRevenue = pureTotal + springTotal + mineralTotal + deliveryFee;
      dailyRevenue[day - 1] += orderRevenue;
    });
    
    // Create daily data array with dates
    const dailyData = dailyRevenue.map((revenue, index) => ({
      day: index + 1,
      date: new Date(year, month, index + 1).toISOString(),
      revenue: revenue
    }));
    
    const total = dailyRevenue.reduce((sum, val) => sum + val, 0);
    
    return {
      dailyData,
      total
    };
    
  } catch (error) {
    console.error('Error getting daily revenue for archive:', error);
    return { dailyData: [], total: 0 };
  }
};

/**
 * Get today's date info
 */
export const getCurrentDateInfo = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    daysRemaining: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
  };
};