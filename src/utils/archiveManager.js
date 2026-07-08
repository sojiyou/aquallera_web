// utils/archiveManager.js
import { archiveLastMonth } from './monthlyArchiver';
import { generateAnnualReport } from './yearlyReportGenerator';

/**
 * Auto Archive Manager
 * Checks and runs archiving tasks automatically
 */
class ArchiveManager {
  constructor(stationId) {
    this.stationId = stationId;
    this.checkInterval = null;
    this.lastCheck = localStorage.getItem(`lastArchiveCheck_${stationId}`);
  }

  /**
   * Start automatic archiving checks
   * Checks every hour if archiving is needed
   */
  start() {
    console.log(`Archive Manager started for station ${this.stationId}`);
    
    // Check immediately
    this.checkAndArchive();
    
    // Then check every hour
    this.checkInterval = setInterval(() => {
      this.checkAndArchive();
    }, 60 * 60 * 1000); // Every 1 hour
  }

  /**
   * Stop automatic archiving
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      console.log('Archive Manager stopped');
    }
  }

  /**
   * Check if archiving is needed and run it
   */
  async checkAndArchive() {
    const now = new Date();
    const today = now.toDateString();
    
    // Only run once per day
    if (this.lastCheck === today) {
      return;
    }
    
    console.log('Checking if archiving is needed...');
    
    // Check if it's the 1st of the month (archive last month)
    if (now.getDate() === 1 && now.getHours() === 0) {
      console.log('It\'s the 1st of the month! Archiving last month...');
      await this.runMonthlyArchive();
    }
    
    // Check if it's Dec 31 (generate annual report)
    if (now.getMonth() === 11 && now.getDate() === 31 && now.getHours() === 23) {
      console.log('It\'s December 31! Generating annual report...');
      await this.runAnnualReport();
    }
    
    // Update last check
    this.lastCheck = today;
    localStorage.setItem(`lastArchiveCheck_${this.stationId}`, today);
  }

  /**
   * Run monthly archiving
   */
  async runMonthlyArchive() {
    try {
      const result = await archiveLastMonth(this.stationId);
      
      if (result.success) {
        console.log(`Monthly archive completed for ${result.month} ${result.year}`);
        
        // Show notification to user (optional)
        this.notifyUser(
          'Monthly Archive Complete', 
          `${result.month} ${result.year} data has been archived successfully.`
        );
      } else {
        console.error('Monthly archive failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Error running monthly archive:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run annual report generation
   */
  async runAnnualReport() {
    try {
      const year = new Date().getFullYear();
      const result = await generateAnnualReport(this.stationId, year);
      
      if (result.success) {
        console.log(`Annual report generated for ${year}`);
        
        // Show notification to user (optional)
        this.notifyUser(
          'Annual Report Ready', 
          `Your ${year} annual report is now available!`
        );
      } else {
        console.error('Annual report generation failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Error generating annual report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Optional: Show notification to user
   */
  notifyUser(title, message) {
    // You can implement custom notifications here
    // For now, just log to console
    console.log(`${title}: ${message}`);
    
    // Example: Could show a toast notification
    // toast.success(`${title}: ${message}`);
  }

  /**
   * Manual trigger for month archive (for testing or manual use)
   */
  async manualArchiveMonth() {
    console.log('Manual archive triggered...');
    return await this.runMonthlyArchive();
  }

  /**
   * Manual trigger for annual report (for testing or manual use)
   */
  async manualGenerateReport(year) {
    console.log(`Manual report generation triggered for ${year}...`);
    const reportYear = year || new Date().getFullYear();
    return await generateAnnualReport(this.stationId, reportYear);
  }
}

// Singleton instance per station
const managerInstances = new Map();

/**
 * Get or create Archive Manager for a station
 */
export const getArchiveManager = (stationId) => {
  if (!managerInstances.has(stationId)) {
    managerInstances.set(stationId, new ArchiveManager(stationId));
  }
  return managerInstances.get(stationId);
};

/**
 * Start auto-archiving for a station
 */
export const startAutoArchiving = (stationId) => {
  const manager = getArchiveManager(stationId);
  manager.start();
  return manager;
};

/**
 * Stop auto-archiving for a station
 */
export const stopAutoArchiving = (stationId) => {
  const manager = managerInstances.get(stationId);
  if (manager) {
    manager.stop();
  }
};