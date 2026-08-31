/**
 * IP Block Service
 * Manages IP blocking state, violation threshold monitoring, block history, and automatic expiry.
 */

const { getConfig } = require('../config/config');
const { generateBlockId } = require('../utils/idGenerator');
const jsonDb = require('./jsonDatabase');
const { logBlockEvent, logUnblockEvent } = require('./securityLogService');

// In-memory violation counter per IP: { [ip]: { count: number, lastViolation: number } }
const violationTracker = new Map();

// In-memory active blocks cache for high performance: { [ip]: { blockedUntil: number, blockId: string } }
const activeBlocksCache = new Map();

/**
 * Record a violation for an IP and determine if it should be blocked
 * @param {string} ip 
 * @param {string} userAgent 
 * @returns {Promise<{ isBlocked: boolean, blockDetails?: object, violationCount: number }>}
 */
async function recordViolation(ip, userAgent = '') {
  const config = getConfig();
  const now = Date.now();

  const current = violationTracker.get(ip) || { count: 0, lastViolation: 0 };
  
  // If last violation was over 1 hour ago, reset count
  if (now - current.lastViolation > 3600000) {
    current.count = 0;
  }

  current.count += 1;
  current.lastViolation = now;
  violationTracker.set(ip, current);

  // Check if IP exceeded threshold
  if (current.count >= config.violationThreshold) {
    const blockDetails = await blockIp(
      ip, 
      `Exceeded violation threshold of ${config.violationThreshold} within the monitoring window`, 
      current.count, 
      config.blockDurationMs,
      userAgent
    );
    
    // Reset tracker after blocking
    violationTracker.delete(ip);

    return {
      isBlocked: true,
      blockDetails,
      violationCount: current.count
    };
  }

  return {
    isBlocked: false,
    violationCount: current.count
  };
}

/**
 * Block an IP address for a specific duration
 * @param {string} ip 
 * @param {string} reason 
 * @param {number} violationCount 
 * @param {number} durationMs 
 * @param {string} userAgent 
 * @returns {Promise<object>} Block record
 */
async function blockIp(ip, reason = 'Repeated rate-limit violations', violationCount = 3, durationMs = 300000, userAgent = '') {
  const config = getConfig();
  const now = new Date();
  const blockedUntilDate = new Date(now.getTime() + durationMs);

  const blockRecord = {
    id: generateBlockId(),
    ip,
    reason,
    violationCount,
    blockedAt: now.toISOString(),
    blockedUntil: blockedUntilDate.toISOString(),
    durationMs,
    status: 'ACTIVE',
    unblockedAt: null,
    unblockedBy: null
  };

  // Update in-memory active cache
  activeBlocksCache.set(ip, {
    blockedUntil: blockedUntilDate.getTime(),
    blockId: blockRecord.id
  });

  // Save to persistent database
  await jsonDb.appendRecord(config.blocksFile, blockRecord);

  // Log IP_BLOCKED event
  await logBlockEvent({
    ip,
    reason,
    violationCount,
    blockedUntil: blockRecord.blockedUntil,
    userAgent
  });

  console.warn(`[SECURITY ALERT] IP ${ip} has been BLOCKED until ${blockRecord.blockedUntil} (Reason: ${reason})`);

  return blockRecord;
}

/**
 * Checks if an IP is currently blocked.
 * Handles automatic expiration when time has elapsed.
 * @param {string} ip 
 * @returns {Promise<{ isBlocked: boolean, block?: object }>}
 */
async function isIpBlocked(ip) {
  const now = Date.now();

  // Check in-memory cache first
  if (activeBlocksCache.has(ip)) {
    const cached = activeBlocksCache.get(ip);
    if (cached.blockedUntil > now) {
      return {
        isBlocked: true,
        block: {
          ip,
          id: cached.blockId,
          blockedUntil: new Date(cached.blockedUntil).toISOString(),
          status: 'ACTIVE'
        }
      };
    } else {
      // Expired in memory
      activeBlocksCache.delete(ip);
      // Mark as EXPIRED in database asynchronously
      markBlockExpired(ip).catch(err => console.error('[Expire Block Error]:', err.message));
      return { isBlocked: false };
    }
  }

  // Fallback to checking persistent storage
  const config = getConfig();
  const blocks = await jsonDb.readData(config.blocksFile, []);
  
  // Find latest active block for this IP
  const activeBlock = blocks.slice().reverse().find(b => b.ip === ip && b.status === 'ACTIVE');

  if (!activeBlock) {
    return { isBlocked: false };
  }

  const blockedUntilMs = new Date(activeBlock.blockedUntil).getTime();
  if (blockedUntilMs > now) {
    // Populate cache
    activeBlocksCache.set(ip, {
      blockedUntil: blockedUntilMs,
      blockId: activeBlock.id
    });
    return { isBlocked: true, block: activeBlock };
  } else {
    // Expired
    await markBlockExpired(ip);
    return { isBlocked: false };
  }
}

/**
 * Mark active blocks for an IP as EXPIRED
 * @param {string} ip 
 */
async function markBlockExpired(ip) {
  const config = getConfig();
  activeBlocksCache.delete(ip);

  await jsonDb.updateRecord(
    config.blocksFile,
    (item) => item.ip === ip && item.status === 'ACTIVE',
    (item) => ({ ...item, status: 'EXPIRED' })
  );
}

/**
 * Manually unblock an IP (Admin action)
 * @param {string} ip 
 * @param {string} unblockedBy 
 * @param {string} reason 
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function unblockIp(ip, unblockedBy = 'ADMIN', reason = 'Manual administrator unblock') {
  const config = getConfig();
  const now = new Date().toISOString();

  // Remove from in-memory cache and violation tracker
  activeBlocksCache.delete(ip);
  violationTracker.delete(ip);

  // Update records in database
  const { updatedCount } = await jsonDb.updateRecord(
    config.blocksFile,
    (item) => item.ip === ip && item.status === 'ACTIVE',
    (item) => ({
      ...item,
      status: 'UNBLOCKED',
      unblockedAt: now,
      unblockedBy
    })
  );

  // Log the unblock event
  await logUnblockEvent({ ip, unblockedBy, reason });

  console.log(`[SECURITY] IP ${ip} was UNBLOCKED by ${unblockedBy}`);

  return {
    success: true,
    message: updatedCount > 0 
      ? `IP ${ip} was successfully unblocked.` 
      : `IP ${ip} was cleared from active tracking.`
  };
}

/**
 * Query block history records
 * @param {object} filters 
 * @returns {Promise<{ total: number, results: any[] }>}
 */
async function queryBlocks({ status, ip, limit = 50, offset = 0 } = {}) {
  const config = getConfig();
  const now = Date.now();

  const predicate = (entry) => {
    // Check if status is still active based on current time
    let computedStatus = entry.status;
    if (computedStatus === 'ACTIVE' && new Date(entry.blockedUntil).getTime() <= now) {
      computedStatus = 'EXPIRED';
    }

    if (status && status !== 'ALL' && computedStatus !== status) return false;
    if (ip && !entry.ip.toLowerCase().includes(ip.toLowerCase())) return false;
    return true;
  };

  const res = await jsonDb.findRecords(config.blocksFile, predicate, limit, offset, 'desc');
  
  // Format results with accurate computed status
  const formattedResults = res.results.map(item => {
    let currentStatus = item.status;
    if (currentStatus === 'ACTIVE' && new Date(item.blockedUntil).getTime() <= now) {
      currentStatus = 'EXPIRED';
    }
    return { ...item, status: currentStatus };
  });

  return { total: res.total, results: formattedResults };
}

/**
 * Periodic cleanup task to update expired blocks in DB
 */
async function cleanExpiredBlocks() {
  const config = getConfig();
  const now = Date.now();

  await jsonDb.updateRecord(
    config.blocksFile,
    (item) => item.status === 'ACTIVE' && new Date(item.blockedUntil).getTime() <= now,
    (item) => ({ ...item, status: 'EXPIRED' })
  );
}

/**
 * Reset in-memory trackers (useful for unit tests)
 */
function resetBlockState() {
  violationTracker.clear();
  activeBlocksCache.clear();
}

module.exports = {
  recordViolation,
  blockIp,
  isIpBlocked,
  unblockIp,
  queryBlocks,
  cleanExpiredBlocks,
  resetBlockState
};
