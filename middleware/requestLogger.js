/**
 * Request Logging Middleware
 * Intercepts requests, measures response time, extracts sanitized telemetry, and logs to JSON DB.
 */

const { getConfig } = require('../config/config');
const { getClientIp } = require('../utils/ipUtils');
const { logRequest } = require('../services/securityLogService');

/**
 * Express Request Logger Middleware
 */
function requestLogger(req, res, next) {
  const config = getConfig();
  const startTime = process.hrtime();
  const clientIp = getClientIp(req, config.trustProxy);

  // Attach detected IP to request for downstream middlewares
  req.clientIp = clientIp;

  // Intercept response finish event to record final status and duration
  res.on('finish', () => {
    // Exclude static assets or favicon from cluttering security audit logs if needed
    const isStatic = req.path.startsWith('/css') || req.path.startsWith('/js') || req.path === '/favicon.ico';
    if (isStatic) return;

    const diff = process.hrtime(startTime);
    const responseTimeMs = (diff[0] * 1e3) + (diff[1] * 1e-6);

    const userAgent = req.headers['user-agent'] || '';

    logRequest({
      ip: clientIp,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime: responseTimeMs,
      userAgent
    }).catch(err => {
      console.error('[RequestLogger Error]:', err.message);
    });
  });

  next();
}

module.exports = requestLogger;
