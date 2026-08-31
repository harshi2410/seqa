/**
 * IP Utility Module
 * Safely extracts and normalizes client IP addresses.
 * Protects against X-Forwarded-For spoofing unless explicitly configured.
 */

/**
 * Normalizes an IP string (handles IPv6 mapping and loopback).
 * @param {string} ipRaw 
 * @returns {string} Normalized IP address
 */
function normalizeIp(ipRaw) {
  if (!ipRaw || typeof ipRaw !== 'string') {
    return '127.0.0.1';
  }

  let ip = ipRaw.trim();

  // Convert IPv4-mapped IPv6 address (::ffff:192.168.1.1 -> 192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Normalize IPv6 localhost
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
    return '127.0.0.1';
  }

  return ip;
}

/**
 * Extracts client IP safely based on application trust configuration.
 * @param {object} req - Express request object
 * @param {boolean} trustProxy - Whether reverse proxy is trusted
 * @returns {string} Clean normalized IP
 */
function getClientIp(req, trustProxy = false) {
  if (!req) return '127.0.0.1';

  let rawIp = '';

  if (trustProxy) {
    // If behind trusted proxy, inspect standard forwarding headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      // First IP in list is the original client IP
      rawIp = forwarded.split(',')[0].trim();
    } else if (req.headers['x-real-ip']) {
      rawIp = req.headers['x-real-ip'];
    }
  }

  // Fallback to direct socket / Express detected IP
  if (!rawIp) {
    rawIp = req.ip || 
            (req.socket && req.socket.remoteAddress) || 
            (req.connection && req.connection.remoteAddress) || 
            '127.0.0.1';
  }

  return normalizeIp(rawIp);
}

/**
 * Checks if string is a reasonably valid IP format (IPv4 or IPv6)
 * @param {string} ip 
 * @returns {boolean}
 */
function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // Basic IPv4 check
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every(part => part >= 0 && part <= 255);
  }

  // Basic IPv6 check
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$|^::$|^::1$/;
  return ipv6Regex.test(ip);
}

module.exports = {
  normalizeIp,
  getClientIp,
  isValidIp
};
