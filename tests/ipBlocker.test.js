/**
 * IP Blocker and Automatic Threshold Enforcement Tests
 */

const request = require('supertest');
const app = require('../app');
const { updateConfig, resetConfig, getConfig } = require('../config/config');
const { resetRateLimitState } = require('../services/rateLimitService');
const { resetBlockState, unblockIp, blockIp } = require('../services/blockService');

describe('IP Blocker and Security Enforcement', () => {
  beforeEach(() => {
    resetConfig();
    resetRateLimitState();
    resetBlockState();
  });

  test('should trigger automatic IP block upon reaching violation threshold', async () => {
    const config = updateConfig({
      windowMs: 60000,
      maxRequests: 1, // Only 1 request allowed per window
      violationThreshold: 2, // Block after 2 violations
      blockDurationMs: 10000
    });

    // Request 1: Allowed (200)
    const req1 = await request(app).get('/api/test');
    expect(req1.status).toBe(200);

    // Request 2: Violation #1 -> 429
    const req2 = await request(app).get('/api/test');
    expect(req2.status).toBe(429);
    expect(req2.body.error).toBe('RATE_LIMIT_EXCEEDED');

    // Request 3: Violation #2 -> Reached threshold of 2 -> Immediately Blocked (403)
    const req3 = await request(app).get('/api/test');
    expect(req3.status).toBe(403);
    expect(req3.body.error).toBe('IP_BLOCKED');
    expect(req3.body.blockedUntil).toBeDefined();

    // Request 4: Blocked by ipBlocker middleware before any processing -> 403
    const req4 = await request(app).get('/api/test');
    expect(req4.status).toBe(403);
    expect(req4.body.error).toBe('IP_BLOCKED');
  });

  test('should restore access after manual administrator unblock', async () => {
    const config = getConfig();

    // Directly block IP 127.0.0.1
    await blockIp('127.0.0.1', 'Manual test block', 3, 60000);

    // Verify it is blocked
    const resBlocked = await request(app).get('/api/test');
    expect(resBlocked.status).toBe(403);

    // Unblock IP via admin API
    const unblockRes = await request(app)
      .post('/api/admin/unblock')
      .set('X-Admin-Key', config.adminApiKey)
      .send({ ip: '127.0.0.1', reason: 'Test verification unblock' });

    expect(unblockRes.status).toBe(200);
    expect(unblockRes.body.success).toBe(true);

    // Reset rate limit quota for fresh test
    resetRateLimitState();

    // Verify request succeeds again
    const resRestored = await request(app).get('/api/test');
    expect(resRestored.status).toBe(200);
    expect(resRestored.body.success).toBe(true);
  });
});
