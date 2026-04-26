// utils/consumptionCalculator.js
import { ref, onValue, get } from 'firebase/database';
import { database } from '../components/config/Firebase';

/**
 * Calculate total water consumption for a specific month and year
 * @param {string} stationId - Water station ID
 * @param {number} year - e.g., 2026
 * @param {number} month - 0-11 (0 = January, 1 = February, etc.)
 * @returns {Promise<Object>} - Consumption totals by water type
 */
export const calculateMonthlyConsumption = async (stationId, year, month) => {
  try {
    const ordersRef = ref(database, 'orders');
    
    return new Promise((resolve) => {
      onValue(ordersRef, (snapshot) => {
        const orders = snapshot.val();
        if (!orders) {
          resolve({
            pureWater: 0,
            springWater: 0,
            mineralWater: 0,
            totalOrders: 0
          });
          return;
        }

        const monthlyOrders = Object.values(orders).filter(order => {
          if (order.stationId !== stationId) return false;
          
          const orderDate = new Date(order.createdAt);
          return orderDate.getMonth() === month && 
                 orderDate.getFullYear() === year &&
                 (order.status === 'completed' || 
                  order.status === 'Completed' ||
                  order.status === 'delivered' ||
                  order.status === 'Delivered');
        });

        const consumption = monthlyOrders.reduce((acc, order) => {
          acc.pureWater += parseInt(order.pureWaterQty) || 0;
          acc.springWater += parseInt(order.springWaterQty) || 0;
          acc.mineralWater += parseInt(order.mineralWaterQty) || 0;
          return acc;
        }, { pureWater: 0, springWater: 0, mineralWater: 0 });

        console.log(`💧 Month ${month + 1}/${year}: Pure ${consumption.pureWater}gal, Spring ${consumption.springWater}L, Mineral ${consumption.mineralWater}gal (${monthlyOrders.length} orders)`);
        
        resolve({
          ...consumption,
          totalOrders: monthlyOrders.length
        });
      }, { onlyOnce: true });
    });
  } catch (error) {
    console.error('Error calculating monthly consumption:', error);
    return { pureWater: 0, springWater: 0, mineralWater: 0, totalOrders: 0 };
  }
};

/**
 * Get daily consumption data for a specific month
 * @param {string} stationId 
 * @param {number} year 
 * @param {number} month 
 * @returns {Promise<Object>} - Daily breakdown by water type
 */
export const getDailyConsumptionForMonth = async (stationId, year, month) => {
  try {
    const ordersRef = ref(database, 'orders');
    
    return new Promise((resolve) => {
      onValue(ordersRef, (snapshot) => {
        const orders = snapshot.val();
        if (!orders) {
          resolve({ dailyData: [], totals: { pureWater: 0, springWater: 0, mineralWater: 0 } });
          return;
        }

        // Initialize daily consumption tracking
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dailyConsumption = {};
        
        for (let day = 1; day <= daysInMonth; day++) {
          dailyConsumption[day] = {
            pureWater: 0,
            springWater: 0,
            mineralWater: 0,
            orderCount: 0
          };
        }
        
        const totals = { pureWater: 0, springWater: 0, mineralWater: 0 };
        
        Object.values(orders)
          .filter(order => {
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
            
            const pureQty = parseInt(order.pureWaterQty) || 0;
            const springQty = parseInt(order.springWaterQty) || 0;
            const mineralQty = parseInt(order.mineralWaterQty) || 0;
            
            dailyConsumption[day].pureWater += pureQty;
            dailyConsumption[day].springWater += springQty;
            dailyConsumption[day].mineralWater += mineralQty;
            dailyConsumption[day].orderCount += 1;
            
            totals.pureWater += pureQty;
            totals.springWater += springQty;
            totals.mineralWater += mineralQty;
          });

        // Convert to array format
        const dailyData = [];
        for (let day = 1; day <= daysInMonth; day++) {
          dailyData.push({
            day,
            ...dailyConsumption[day]
          });
        }

        console.log(`📅 Daily consumption for ${month + 1}/${year}: ${Object.values(dailyConsumption).filter(d => d.orderCount > 0).length} days with orders`);

        resolve({
          dailyData,
          totals,
          daysInMonth
        });
      }, { onlyOnce: true });
    });
  } catch (error) {
    console.error('Error getting daily consumption:', error);
    return { dailyData: [], totals: { pureWater: 0, springWater: 0, mineralWater: 0 } };
  }
};

/**
 * Get daily consumption breakdown for archiving (uses get() instead of onValue)
 */
export const getDailyConsumptionForArchive = async (stationId, year, month) => {
  try {
    const ordersRef = ref(database, 'orders');
    const snapshot = await get(ordersRef);
    
    if (!snapshot.exists()) {
      return { dailyData: [], totals: { pureWater: 0, springWater: 0, mineralWater: 0 } };
    }
    
    const orders = snapshot.val();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Initialize daily data
    const dailyConsumption = new Array(daysInMonth).fill(null).map(() => ({
      pureWater: 0,
      springWater: 0,
      mineralWater: 0,
      orderCount: 0
    }));
    
    const totals = { pureWater: 0, springWater: 0, mineralWater: 0 };
    
    Object.values(orders).forEach(order => {
      if (order.stationId !== stationId) return;
      
      const orderDate = new Date(order.createdAt);
      if (orderDate.getMonth() !== month || orderDate.getFullYear() !== year) return;
      
      if (!(order.status === 'completed' || 
            order.status === 'Completed' ||
            order.status === 'delivered' ||
            order.status === 'Delivered')) {
        return;
      }
      
      const day = orderDate.getDate();
      const pureQty = parseInt(order.pureWaterQty) || 0;
      const springQty = parseInt(order.springWaterQty) || 0;
      const mineralQty = parseInt(order.mineralWaterQty) || 0;
      
      dailyConsumption[day - 1].pureWater += pureQty;
      dailyConsumption[day - 1].springWater += springQty;
      dailyConsumption[day - 1].mineralWater += mineralQty;
      dailyConsumption[day - 1].orderCount += 1;
      
      totals.pureWater += pureQty;
      totals.springWater += springQty;
      totals.mineralWater += mineralQty;
    });
    
    // Create daily data array with dates
    const dailyData = dailyConsumption.map((data, index) => ({
      day: index + 1,
      date: new Date(year, month, index + 1).toISOString(),
      ...data
    }));
    
    return {
      dailyData,
      totals
    };
    
  } catch (error) {
    console.error('Error getting daily consumption for archive:', error);
    return { dailyData: [], totals: { pureWater: 0, springWater: 0, mineralWater: 0 } };
  }
};

/**
 * Get current date info (same as revenue calculator)
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