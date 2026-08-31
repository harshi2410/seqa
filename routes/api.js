/**
 * Public & Demonstration API Routes
 * These endpoints pass through security middleware (IP blocker, rate limiter, request logger).
 */

const express = require('express');
const router = express.Router();

/**
 * Health check endpoint
 * Excluded from blocking if needed or lightweight
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'API Rate-Limiting & Middleware Security Logger',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Primary demonstration endpoint for TAE testing
 */
router.get('/api/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API request successful',
    clientIp: req.clientIp || req.ip,
    timestamp: new Date().toISOString()
  });
});

/**
 * Data retrieval demonstration endpoint
 */
router.get('/api/data', (req, res) => {
  res.status(200).json({
    success: true,
    items: [
      { id: 101, name: 'Cyber Threat Intelligence Report', category: 'Security', status: 'Published' },
      { id: 102, name: 'Web Application Firewall Metrics', category: 'Infrastructure', status: 'Active' },
      { id: 103, name: 'DDoS Mitigation Heuristics', category: 'Network', status: 'Monitoring' }
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * Simulates a delayed response endpoint for latency testing
 */
router.get('/api/slow', async (req, res) => {
  const delayMs = parseInt(req.query.delay, 10) || 500;
  await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 2000)));

  res.status(200).json({
    success: true,
    message: `Simulated slow endpoint completed after ${delayMs}ms`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
