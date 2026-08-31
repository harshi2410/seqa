/**
 * Rate Limiter Service
 * High-performance sliding/fixed-window request tracker with automated memory management.
 */

const { getConfig } = require('../config/config');

// Memory store for tracking request windows per IP
// Map<ip, { count: number, resetTime: number, timestamps: number[] }>
const ipWindows = new Map();

/**
 * Check and track request rate for an IP address
 * @param {string} ip 
 * @returns {{ allowed: boolean, limit: number, remaining: number, resetTime: number, retryAfter: number, currentCount: number }}
 */
function checkRateLimit(ip) {
  const config = getConfig();
  const now = Date.now();
  const windowMs = config.windowMs;
  const maxRequests = config.maxRequests;

  let windowData = ipWindows.get(ip);

  // If no entry exists or previous window has expired, initialize a fresh window
  if (!windowData || now >= windowData.resetTime) {
    windowData = {
      count: 1,
      resetTime: now + windowMs,
      startTime: now
    };
    ipWindows.set(ip, windowData);

    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - 1),
      resetTime: Math.ceil(windowData.resetTime / 1000),
      retryAfter: 0,
      currentCount: 1
    };
  }

  // Increment request count
  windowData.count += 1;
  const currentCount = windowData.count;
  const remaining = Math.max(0, maxRequests - currentCount);
  const resetTimeSec = Math.ceil(windowData.resetTime / 1000);
  const retryAfterSec = Math.max(1, Math.ceil((windowData.resetTime - now) / 1000));

  if (currentCount <= maxRequests) {
    return {
      allowed: true,
      limit: maxRequests,
      remaining,
      resetTime: resetTimeSec,
      retryAfter: 0,
      currentCount
    };
  }

  // Rate limit exceeded
  return {
    allowed: false,
    limit: maxRequests,
    remaining: 0,
    resetTime: resetTimeSec,
    retryAfter: retryAfterSec,
    currentCount
  };
}

/**
 * Periodic cleanup of stale rate limit tracking data to prevent memory leaks
 */
function cleanupExpiredWindows() {
  const now = Date.now();
  for (const [ip, windowData] of ipWindows.entries()) {
    if (now >= windowData.resetTime + 30000) { // grace period of 30 seconds
      ipWindows.delete(ip);
    }
  }
}

/**
 * Clear in-memory rate limit store (useful for tests)
 */
function resetRateLimitState() {
  ipWindows.clear();
}

/**
 * Get active tracking stats
 */
function getActiveTrackerCount() {
  return ipWindows.size;
}

module.exports = {
  checkRateLimit,
  cleanupExpiredWindows,
  resetRateLimitState,
  getActiveTrackerCount
};
