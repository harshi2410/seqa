/**
 * IP Blocker Middleware
 * Intercepts requests and enforces temporary IP blocks before reaching route handlers.
 */

const { getConfig } = require('../config/config');
const { getClientIp } = require('../utils/ipUtils');
const { isIpBlocked } = require('../services/blockService');

/**
 * Checks if incoming client IP is currently active in the blocklist
 */
async function ipBlocker(req, res, next) {
  const config = getConfig();
  const clientIp = req.clientIp || getClientIp(req, config.trustProxy);
  req.clientIp = clientIp;

  try {
    const { isBlocked, block } = await isIpBlocked(clientIp);

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'IP_BLOCKED',
        message: 'Your IP address has been temporarily blocked due to repeated rate-limit violations.',
        ip: clientIp,
        blockedUntil: block ? block.blockedUntil : undefined,
        reason: block ? block.reason : 'Security violation threshold exceeded'
      });
    }

    next();
  } catch (err) {
    console.error('[IPBlocker Middleware Error]:', err.message);
    next(); // Fail open gracefully or pass to error handler
  }
}

module.exports = ipBlocker;
