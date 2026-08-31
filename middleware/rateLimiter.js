/**
 * Rate Limiter Middleware
 * Tracks request rates, sets rate-limit response headers, detects violations, and triggers IP blocking.
 */

const { getConfig } = require('../config/config');
const { getClientIp } = require('../utils/ipUtils');
const { checkRateLimit } = require('../services/rateLimitService');
const { logViolation } = require('../services/securityLogService');
const { recordViolation } = require('../services/blockService');

/**
 * Express Rate Limiter Middleware
 */
async function rateLimiter(req, res, next) {
  const config = getConfig();
  const clientIp = req.clientIp || getClientIp(req, config.trustProxy);
  const userAgent = req.headers['user-agent'] || '';

  const rateCheck = checkRateLimit(clientIp);

  // Set standard rate limit headers
  res.setHeader('X-RateLimit-Limit', rateCheck.limit);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);
  res.setHeader('X-RateLimit-Reset', rateCheck.resetTime);

  // If request is within allowed quota, proceed
  if (rateCheck.allowed) {
    return next();
  }

  // Rate limit exceeded: set Retry-After header
  res.setHeader('Retry-After', rateCheck.retryAfter);

  // 1. Log the violation event to persistent security logs
  await logViolation({
    ip: clientIp,
    method: req.method,
    path: req.originalUrl || req.url,
    requestCount: rateCheck.currentCount,
    limit: rateCheck.limit,
    userAgent
  });

  // 2. Record violation count and check if IP exceeds threshold to trigger block
  const blockResult = await recordViolation(clientIp, userAgent);

  // If IP just got blocked on this violation, return 403 Forbidden with block details
  if (blockResult.isBlocked) {
    return res.status(403).json({
      success: false,
      error: 'IP_BLOCKED',
      message: 'Your IP address has been temporarily blocked due to repeated rate-limit violations.',
      ip: clientIp,
      blockedUntil: blockResult.blockDetails ? blockResult.blockDetails.blockedUntil : undefined,
      violationCount: blockResult.violationCount
    });
  }

  // Otherwise return 429 Too Many Requests
  return res.status(429).json({
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    limit: rateCheck.limit,
    retryAfter: rateCheck.retryAfter,
    violations: blockResult.violationCount,
    threshold: config.violationThreshold
  });
}

module.exports = rateLimiter;
