/**
 * Administrator API Routes
 * Protected endpoints for security log inspection, analytics, IP unblocking, and live configuration.
 */

const express = require('express');
const router = express.Router();
const { getConfig, updateConfig, resetConfig } = require('../config/config');
const { queryLogs, LOG_TYPES } = require('../services/securityLogService');
const { queryBlocks, unblockIp } = require('../services/blockService');
const { getDashboardStats } = require('../services/statisticsService');
const { validateConfig, validateUnblockInput } = require('../utils/validation');
const jsonDb = require('../services/jsonDatabase');

/**
 * Admin Authentication Middleware
 * Enforces X-Admin-Key validation against configured ADMIN_API_KEY
 */
function requireAdminAuth(req, res, next) {
  const config = getConfig();
  const providedKey = req.headers['x-admin-key'] || req.query.adminKey || req.query.key;

  if (!providedKey) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing admin API key. Please provide X-Admin-Key header.'
    });
  }

  if (providedKey !== config.adminApiKey) {
    return res.status(401).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Invalid admin API key provided.'
    });
  }

  next();
}

// Apply admin authentication to all routes in this router
router.use(requireAdminAuth);

/**
 * GET /api/admin/stats
 * Retrieves aggregated analytics and telemetry for charts and metric cards
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/logs
 * Query security event logs with pagination, search, and type filters
 */
router.get('/logs', async (req, res, next) => {
  try {
    const { type, ip, method, statusCode, limit, offset, search, sort } = req.query;
    
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 500);
    const parsedOffset = parseInt(offset, 10) || 0;

    const data = await queryLogs({
      type,
      ip,
      method,
      statusCode,
      limit: parsedLimit,
      offset: parsedOffset,
      search,
      sortOrder: sort === 'asc' ? 'asc' : 'desc'
    });

    res.status(200).json({
      success: true,
      total: data.total,
      limit: parsedLimit,
      offset: parsedOffset,
      logs: data.results
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/violations
 * Convenience endpoint for rate-limit violations
 */
router.get('/violations', async (req, res, next) => {
  try {
    const { ip, limit, offset } = req.query;
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 500);
    const parsedOffset = parseInt(offset, 10) || 0;

    const data = await queryLogs({
      type: LOG_TYPES.RATE_LIMIT_VIOLATION,
      ip,
      limit: parsedLimit,
      offset: parsedOffset
    });

    res.status(200).json({
      success: true,
      total: data.total,
      violations: data.results
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/blocks
 * Query blocked IPs and historical block records
 */
router.get('/blocks', async (req, res, next) => {
  try {
    const { status, ip, limit, offset } = req.query;
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const parsedOffset = parseInt(offset, 10) || 0;

    const data = await queryBlocks({
      status,
      ip,
      limit: parsedLimit,
      offset: parsedOffset
    });

    res.status(200).json({
      success: true,
      total: data.total,
      blocks: data.results
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/unblock
 * Unblocks an IP address, logs an IP_UNBLOCKED event, and restores client access
 */
router.post('/unblock', async (req, res, next) => {
  try {
    const validation = validateUnblockInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: validation.error
      });
    }

    const unblockResult = await unblockIp(validation.ip, 'ADMIN', req.body.reason);

    res.status(200).json({
      success: true,
      message: unblockResult.message,
      ip: validation.ip
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/config
 * View current rate limit and security policy configuration
 */
router.get('/config', (req, res) => {
  const config = getConfig();
  res.status(200).json({
    success: true,
    config: {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      violationThreshold: config.violationThreshold,
      blockDurationMs: config.blockDurationMs,
      trustProxy: config.trustProxy,
      maxRequestLogs: config.maxRequestLogs
    }
  });
});

/**
 * PUT /api/admin/config
 * Update rate limit and security policy configuration dynamically
 */
router.put('/config', async (req, res, next) => {
  try {
    const validation = validateConfig(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        errors: validation.errors
      });
    }

    const updated = updateConfig(validation.sanitized);

    // Persist configuration to data/config.json
    await jsonDb.writeData(updated.configFile, {
      windowMs: updated.windowMs,
      maxRequests: updated.maxRequests,
      violationThreshold: updated.violationThreshold,
      blockDurationMs: updated.blockDurationMs,
      trustProxy: updated.trustProxy
    });

    res.status(200).json({
      success: true,
      message: 'Configuration updated successfully',
      config: {
        windowMs: updated.windowMs,
        maxRequests: updated.maxRequests,
        violationThreshold: updated.violationThreshold,
        blockDurationMs: updated.blockDurationMs,
        trustProxy: updated.trustProxy
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/reset-config
 * Resets configuration back to defaults
 */
router.post('/reset-config', async (req, res, next) => {
  try {
    const reset = resetConfig();
    await jsonDb.writeData(reset.configFile, {
      windowMs: reset.windowMs,
      maxRequests: reset.maxRequests,
      violationThreshold: reset.violationThreshold,
      blockDurationMs: reset.blockDurationMs,
      trustProxy: reset.trustProxy
    });

    res.status(200).json({
      success: true,
      message: 'Configuration reset to defaults successfully',
      config: {
        windowMs: reset.windowMs,
        maxRequests: reset.maxRequests,
        violationThreshold: reset.violationThreshold,
        blockDurationMs: reset.blockDurationMs,
        trustProxy: reset.trustProxy
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
