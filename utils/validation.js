/**
 * Validation Utility
 * Validates configuration parameters, numerical inputs, and sanitizes payloads.
 */

const { isValidIp } = require('./ipUtils');

/**
 * Validates rate limit and security configuration settings
 * @param {object} config - Configuration object to validate
 * @returns {{ valid: boolean, errors: string[], sanitized: object }}
 */
function validateConfig(config) {
  const errors = [];
  const sanitized = {};

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration payload must be an object'], sanitized: {} };
  }

  // Validate windowMs (1 second to 1 hour: 1000 - 3600000)
  if (config.windowMs !== undefined) {
    const val = Number(config.windowMs);
    if (isNaN(val) || !Number.isInteger(val) || val < 1000 || val > 3600000) {
      errors.push('windowMs must be an integer between 1000 (1s) and 3600000 (1 hour)');
    } else {
      sanitized.windowMs = val;
    }
  }

  // Validate maxRequests (1 to 100,000)
  if (config.maxRequests !== undefined) {
    const val = Number(config.maxRequests);
    if (isNaN(val) || !Number.isInteger(val) || val < 1 || val > 100000) {
      errors.push('maxRequests must be an integer between 1 and 100,000');
    } else {
      sanitized.maxRequests = val;
    }
  }

  // Validate violationThreshold (1 to 50)
  if (config.violationThreshold !== undefined) {
    const val = Number(config.violationThreshold);
    if (isNaN(val) || !Number.isInteger(val) || val < 1 || val > 50) {
      errors.push('violationThreshold must be an integer between 1 and 50');
    } else {
      sanitized.violationThreshold = val;
    }
  }

  // Validate blockDurationMs (5 seconds to 24 hours: 5000 - 86400000)
  if (config.blockDurationMs !== undefined) {
    const val = Number(config.blockDurationMs);
    if (isNaN(val) || !Number.isInteger(val) || val < 5000 || val > 86400000) {
      errors.push('blockDurationMs must be an integer between 5000 (5s) and 86400000 (24h)');
    } else {
      sanitized.blockDurationMs = val;
    }
  }

  // Validate trustProxy (boolean)
  if (config.trustProxy !== undefined) {
    if (typeof config.trustProxy === 'boolean') {
      sanitized.trustProxy = config.trustProxy;
    } else if (config.trustProxy === 'true' || config.trustProxy === 'false') {
      sanitized.trustProxy = config.trustProxy === 'true';
    } else {
      errors.push('trustProxy must be a boolean (true or false)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validates an unblock request payload
 * @param {object} body - Payload with { ip }
 * @returns {{ valid: boolean, error?: string, ip?: string }}
 */
function validateUnblockInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { ip } = body;
  if (!ip || typeof ip !== 'string' || !isValidIp(ip)) {
    return { valid: false, error: 'A valid IPv4 or IPv6 address is required' };
  }

  return { valid: true, ip: ip.trim() };
}

module.exports = {
  validateConfig,
  validateUnblockInput
};
