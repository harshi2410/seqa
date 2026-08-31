/**
 * Security Logging Service
 * Manages creation, persistence, query, and aggregation of security event logs.
 */

const { getConfig } = require('../config/config');
const { generateLogId, generateViolationId, generateBlockId, generateUnblockId, generateId } = require('../utils/idGenerator');
const jsonDb = require('./jsonDatabase');

const LOG_TYPES = {
  REQUEST: 'REQUEST',
  RATE_LIMIT_VIOLATION: 'RATE_LIMIT_VIOLATION',
  IP_BLOCKED: 'IP_BLOCKED',
  IP_UNBLOCKED: 'IP_UNBLOCKED',
  SUSPICIOUS_REQUEST: 'SUSPICIOUS_REQUEST'
};

/**
 * Log a standard API request
 * @param {object} param0 
 */
async function logRequest({ ip, method, path, statusCode, responseTime, userAgent = '' }) {
  const config = getConfig();
  const logEntry = {
    id: generateLogId(),
    type: LOG_TYPES.REQUEST,
    ip,
    method,
    path,
    statusCode,
    responseTime: Math.round(responseTime),
    userAgent: userAgent ? userAgent.substring(0, 150) : 'unknown',
    timestamp: new Date().toISOString()
  };

  // Append with size rotation limit
  await jsonDb.appendRecord(config.logsFile, logEntry, config.maxRequestLogs);
  
  // Asynchronously update request statistics
  updateStatsOnRequest({ ip, path, statusCode }).catch(err => {
    console.error('[Stats Update Error]:', err.message);
  });

  return logEntry;
}

/**
 * Log a rate limit violation event
 * @param {object} param0 
 */
async function logViolation({ ip, method, path, requestCount, limit, userAgent = '' }) {
  const config = getConfig();
  const logEntry = {
    id: generateViolationId(),
    type: LOG_TYPES.RATE_LIMIT_VIOLATION,
    ip,
    method,
    path,
    statusCode: 429,
    requestCount,
    limit,
    userAgent: userAgent ? userAgent.substring(0, 150) : 'unknown',
    timestamp: new Date().toISOString(),
    details: `Client exceeded maximum limit of ${limit} requests within the active window.`
  };

  await jsonDb.appendRecord(config.logsFile, logEntry, config.maxRequestLogs);

  // Increment violation stats
  updateStatsOnViolation({ ip }).catch(err => {
    console.error('[Stats Violation Error]:', err.message);
  });

  return logEntry;
}

/**
 * Log an IP Block event
 * @param {object} param0 
 */
async function logBlockEvent({ ip, reason, violationCount, blockedUntil, userAgent = '' }) {
  const config = getConfig();
  const logEntry = {
    id: generateBlockId(),
    type: LOG_TYPES.IP_BLOCKED,
    ip,
    statusCode: 403,
    reason,
    violationCount,
    blockedUntil,
    userAgent: userAgent ? userAgent.substring(0, 150) : 'unknown',
    timestamp: new Date().toISOString(),
    details: `IP automatically blocked until ${blockedUntil} after reaching ${violationCount} violations.`
  };

  await jsonDb.appendRecord(config.logsFile, logEntry, config.maxRequestLogs);

  // Update block stats
  updateStatsOnBlock().catch(err => {
    console.error('[Stats Block Error]:', err.message);
  });

  return logEntry;
}

/**
 * Log an IP Unblock event
 * @param {object} param0 
 */
async function logUnblockEvent({ ip, unblockedBy = 'ADMIN', reason = 'Manual administrator override' }) {
  const config = getConfig();
  const logEntry = {
    id: generateUnblockId(),
    type: LOG_TYPES.IP_UNBLOCKED,
    ip,
    statusCode: 200,
    unblockedBy,
    reason,
    timestamp: new Date().toISOString(),
    details: `IP was unblocked by ${unblockedBy}. Access restored.`
  };

  await jsonDb.appendRecord(config.logsFile, logEntry, config.maxRequestLogs);
  return logEntry;
}

/**
 * Internal helper to update request statistics in request_stats.json
 */
async function updateStatsOnRequest({ ip, path, statusCode }) {
  const config = getConfig();
  const stats = await jsonDb.readData(config.statsFile, {
    totalRequests: 0,
    totalViolations: 0,
    totalBlocks: 0,
    ipActivity: {},
    endpointHits: {},
    statusCodeHits: {},
    lastUpdated: new Date().toISOString()
  });

  stats.totalRequests = (stats.totalRequests || 0) + 1;

  // Track IP activity count
  stats.ipActivity = stats.ipActivity || {};
  stats.ipActivity[ip] = (stats.ipActivity[ip] || 0) + 1;

  // Track endpoint hits
  stats.endpointHits = stats.endpointHits || {};
  stats.endpointHits[path] = (stats.endpointHits[path] || 0) + 1;

  // Track status codes
  const code = String(statusCode);
  stats.statusCodeHits = stats.statusCodeHits || {};
  stats.statusCodeHits[code] = (stats.statusCodeHits[code] || 0) + 1;

  stats.lastUpdated = new Date().toISOString();
  await jsonDb.writeData(config.statsFile, stats);
}

/**
 * Internal helper for violation statistics
 */
async function updateStatsOnViolation({ ip }) {
  const config = getConfig();
  const stats = await jsonDb.readData(config.statsFile, {
    totalRequests: 0,
    totalViolations: 0,
    totalBlocks: 0,
    violationIps: {}
  });

  stats.totalViolations = (stats.totalViolations || 0) + 1;
  stats.violationIps = stats.violationIps || {};
  stats.violationIps[ip] = (stats.violationIps[ip] || 0) + 1;
  stats.lastUpdated = new Date().toISOString();

  await jsonDb.writeData(config.statsFile, stats);
}

/**
 * Internal helper for block event statistics
 */
async function updateStatsOnBlock() {
  const config = getConfig();
  const stats = await jsonDb.readData(config.statsFile, {
    totalRequests: 0,
    totalViolations: 0,
    totalBlocks: 0
  });

  stats.totalBlocks = (stats.totalBlocks || 0) + 1;
  stats.lastUpdated = new Date().toISOString();
  await jsonDb.writeData(config.statsFile, stats);
}

/**
 * Query security logs with rich filtering options
 * @param {object} filters 
 * @returns {Promise<{ total: number, results: any[] }>}
 */
async function queryLogs({ type, ip, method, statusCode, limit = 50, offset = 0, sortOrder = 'desc', search = '' }) {
  const config = getConfig();
  
  const predicate = (entry) => {
    if (type && type !== 'ALL' && entry.type !== type) return false;
    if (ip && !entry.ip.toLowerCase().includes(ip.toLowerCase())) return false;
    if (method && entry.method !== method) return false;
    if (statusCode && entry.statusCode !== Number(statusCode)) return false;
    
    if (search) {
      const q = search.toLowerCase();
      const matchIp = entry.ip && entry.ip.toLowerCase().includes(q);
      const matchPath = entry.path && entry.path.toLowerCase().includes(q);
      const matchType = entry.type && entry.type.toLowerCase().includes(q);
      const matchDetails = entry.details && entry.details.toLowerCase().includes(q);
      const matchId = entry.id && entry.id.toLowerCase().includes(q);
      if (!matchIp && !matchPath && !matchType && !matchDetails && !matchId) return false;
    }

    return true;
  };

  return jsonDb.findRecords(config.logsFile, predicate, limit, offset, sortOrder);
}

module.exports = {
  LOG_TYPES,
  logRequest,
  logViolation,
  logBlockEvent,
  logUnblockEvent,
  queryLogs
};
