/**
 * Application Configuration Management
 * Loads environment variables from .env and supports dynamic runtime updates.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env if present
dotenv.config();

const DEFAULT_CONFIG = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  adminApiKey: process.env.ADMIN_API_KEY || 'admin-secret-key-2026',
  
  // Rate Limiter parameters
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000, // 60 seconds
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100, // 100 req / window
  violationThreshold: parseInt(process.env.VIOLATION_THRESHOLD, 10) || 3, // 3 violations -> block
  blockDurationMs: parseInt(process.env.BLOCK_DURATION_MS, 10) || 300000, // 5 minutes
  
  // Security & Proxy
  trustProxy: process.env.TRUST_PROXY === 'true',
  
  // Data Retention
  maxRequestLogs: parseInt(process.env.MAX_REQUEST_LOGS, 10) || 10000,
  
  // Storage Paths
  dataDir: path.join(__dirname, '..', 'data'),
  logsFile: path.join(__dirname, '..', 'data', 'security_logs.json'),
  blocksFile: path.join(__dirname, '..', 'data', 'ip_blocks.json'),
  statsFile: path.join(__dirname, '..', 'data', 'request_stats.json'),
  configFile: path.join(__dirname, '..', 'data', 'config.json')
};

// In-memory active configuration
let activeConfig = { ...DEFAULT_CONFIG };

/**
 * Get current configuration
 * @returns {object} Active configuration
 */
function getConfig() {
  return { ...activeConfig };
}

/**
 * Update active configuration with validated values
 * @param {object} newValues 
 * @returns {object} Updated active configuration
 */
function updateConfig(newValues) {
  activeConfig = {
    ...activeConfig,
    ...newValues
  };
  return { ...activeConfig };
}

/**
 * Reset config to defaults
 * @returns {object}
 */
function resetConfig() {
  activeConfig = { ...DEFAULT_CONFIG };
  return { ...activeConfig };
}

module.exports = {
  getConfig,
  updateConfig,
  resetConfig,
  DEFAULT_CONFIG
};
