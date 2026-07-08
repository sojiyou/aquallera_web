//revenueCache.js
import { ref, get, set } from 'firebase/database';
import { database } from '../components/config/Firebase';
import { calculateMonthlyRevenue } from './revenueCalculator';

// Cache keys for localStorage
const CACHE_KEYS = {
  YEAR_PROJECTION: 'revenue_projection_cache',
  YEARLY_TOTALS: 'yearly_totals_cache',
  LAST_CALCULATION: 'last_calculation_date'
};

/**
 * Hybrid Cache System:
 * - Always shows predictions (no 3-day block)
 * - Caches results to avoid recalculating on every render
 * - Updates once per day maximum
 */
class RevenueCache {
  constructor(stationId) {
    this.stationId = stationId;
    this.memoryCache = new Map();
    this.loadFromStorage();
  }

  // Load cached data from localStorage
  loadFromStorage() {
    try {
      const projectionCache = localStorage.getItem(`${CACHE_KEYS.YEAR_PROJECTION}_${this.stationId}`);
      if (projectionCache) {
        const parsed = JSON.parse(projectionCache);
        const cacheDate = new Date(parsed.cachedAt);
        const today = new Date();
        
        // Use cache if it's from today
        if (cacheDate.toDateString() === today.toDateString()) {
          this.memoryCache.set('yearProjection', parsed.data);
        }
      }

      const yearlyTotals = localStorage.getItem(`${CACHE_KEYS.YEARLY_TOTALS}_${this.stationId}`);
      if (yearlyTotals) {
        this.memoryCache.set('yearlyTotals', JSON.parse(yearlyTotals));
      }
    } catch (error) {
      console.error('Error loading cache from storage:', error);
    }
  }

  // Save projection to cache
  async cacheYearProjection(projectionData) {
    try {
      const cacheEntry = {
        data: projectionData,
        cachedAt: new Date().toISOString(),
        stationId: this.stationId
      };

      localStorage.setItem(
        `${CACHE_KEYS.YEAR_PROJECTION}_${this.stationId}`,
        JSON.stringify(cacheEntry)
      );
      
      this.memoryCache.set('yearProjection', projectionData);
      localStorage.setItem(
        `${CACHE_KEYS.LAST_CALCULATION}_${this.stationId}`,
        new Date().toDateString()
      );
    } catch (error) {
      console.error('Error caching projection:', error);
    }
  }

  // Get cached projection if it exists and is from today
  getCachedYearProjection() {
    const cached = this.memoryCache.get('yearProjection');
    if (cached) return cached;

    try {
      const storageCache = localStorage.getItem(`${CACHE_KEYS.YEAR_PROJECTION}_${this.stationId}`);
      if (storageCache) {
        const parsed = JSON.parse(storageCache);
        const cacheDate = new Date(parsed.cachedAt);
        const today = new Date();
        
        if (cacheDate.toDateString() === today.toDateString()) {
          this.memoryCache.set('yearProjection', parsed.data);
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('Error reading cached projection:', error);
    }
    
    return null;
  }

  // Check if we need to recalculate (once per day)
  shouldRecalculate() {
    const lastCalc = localStorage.getItem(`${CACHE_KEYS.LAST_CALCULATION}_${this.stationId}`);
    const today = new Date().toDateString();
    return lastCalc !== today;
  }

  // Update yearly totals in cache
  async updateYearlyTotal(year, total) {
    const yearlyData = this.memoryCache.get('yearlyTotals') || {};
    yearlyData[year] = {
      total,
      lastUpdated: new Date().toISOString()
    };
    
    this.memoryCache.set('yearlyTotals', yearlyData);
    
    localStorage.setItem(
      `${CACHE_KEYS.YEARLY_TOTALS}_${this.stationId}`,
      JSON.stringify(yearlyData)
    );

    // Check if it's Dec 31 - save to Firebase permanently
    const today = new Date();
    const isLastDayOfYear = today.getMonth() === 11 && today.getDate() === 31;
    
    if (isLastDayOfYear) {
      await this.saveYearlyTotalToFirebase(year, total);
    }
  }

  // Save final yearly total to Firebase on Dec 31
  async saveYearlyTotalToFirebase(year, total) {
    try {
      const yearlyRef = ref(database, `waterStations/${this.stationId}/yearlyRevenue/${year}`);
      await set(yearlyRef, {
        total,
        finalizedAt: new Date().toISOString(),
        year
      });
      console.log(`Yearly total for ${year} saved to Firebase: ₱${total}`);
    } catch (error) {
      console.error('Error saving yearly total to Firebase:', error);
    }
  }

  // Get comparison data (current year vs previous year)
  async getYearComparison() {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Get current year total from cache or calculate
    const yearlyTotals = this.memoryCache.get('yearlyTotals') || {};
    let currentYearTotal = yearlyTotals[currentYear]?.total;
    let previousYearTotal = yearlyTotals[previousYear]?.total;
    
    // If not in cache, try to get from Firebase
    if (!previousYearTotal) {
      try {
        const prevYearRef = ref(database, `waterStations/${this.stationId}/yearlyRevenue/${previousYear}`);
        const snapshot = await get(prevYearRef);
        if (snapshot.exists()) {
          previousYearTotal = snapshot.val().total;
          // Update cache
          yearlyTotals[previousYear] = {
            total: previousYearTotal,
            lastUpdated: snapshot.val().finalizedAt
          };
        }
      } catch (error) {
        console.error('Error fetching previous year total:', error);
      }
    }
    
    // Calculate current year total if not cached
    if (!currentYearTotal) {
      let total = 0;
      for (let month = 0; month <= 11; month++) {
        total += await calculateMonthlyRevenue(this.stationId, currentYear, month);
      }
      currentYearTotal = total;
      await this.updateYearlyTotal(currentYear, total);
    }
    
    // Calculate growth percentage
    let growthPercentage = null;
    if (previousYearTotal && previousYearTotal > 0) {
      growthPercentage = ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100;
    }
    
    return {
      currentYear,
      previousYear,
      currentYearTotal,
      previousYearTotal: previousYearTotal || 0,
      growthPercentage,
      hasPreviousYearData: !!previousYearTotal
    };
  }

  // Clear old cache (call this on Jan 1)
  async archiveYearData() {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    
    try {
      // Keep last year's total in Firebase, remove from localStorage cache
      const yearlyTotals = this.memoryCache.get('yearlyTotals') || {};
      delete yearlyTotals[lastYear - 1]; // Remove year before last
      
      localStorage.setItem(
        `${CACHE_KEYS.YEARLY_TOTALS}_${this.stationId}`,
        JSON.stringify(yearlyTotals)
      );
      
      this.memoryCache.set('yearlyTotals', yearlyTotals);
      
      // Clear projection cache for new year
      localStorage.removeItem(`${CACHE_KEYS.YEAR_PROJECTION}_${this.stationId}`);
      localStorage.removeItem(`${CACHE_KEYS.LAST_CALCULATION}_${this.stationId}`);
      this.memoryCache.delete('yearProjection');
      
      console.log(`Cache archived: New year ${currentYear}, keeping ${lastYear} for comparison`);
    } catch (error) {
      console.error('Error archiving cache:', error);
    }
  }
}

// Singleton instances per station
const cacheInstances = new Map();

export const getRevenueCache = (stationId) => {
  if (!cacheInstances.has(stationId)) {
    cacheInstances.set(stationId, new RevenueCache(stationId));
  }
  return cacheInstances.get(stationId);
};

// Hook-friendly function for components
export const useYearComparison = async (stationId) => {
  const cache = getRevenueCache(stationId);
  return await cache.getYearComparison();
};

// Call this on Jan 1
export const archiveOldYearData = async (stationId) => {
  const cache = getRevenueCache(stationId);
  await cache.archiveYearData();
};