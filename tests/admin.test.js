/**
 * Admin API & Authentication Tests
 */

const request = require('supertest');
const app = require('../app');
const { getConfig, resetConfig } = require('../config/config');

describe('Admin Protected Endpoints & Authentication', () => {
  beforeEach(() => {
    resetConfig();
  });

  test('should return 401 Unauthorized when X-Admin-Key is missing', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  test('should return 401 Forbidden when X-Admin-Key is invalid', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('X-Admin-Key', 'wrong-key-12345');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  test('should return 200 and telemetry stats when valid X-Admin-Key is provided', async () => {
    const config = getConfig();
    const res = await request(app)
      .get('/api/admin/stats')
      .set('X-Admin-Key', config.adminApiKey);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.charts).toBeDefined();
  });

  test('should return logs array on GET /api/admin/logs', async () => {
    const config = getConfig();
    const res = await request(app)
      .get('/api/admin/logs')
      .set('X-Admin-Key', config.adminApiKey);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  test('should validate and update configuration on PUT /api/admin/config', async () => {
    const config = getConfig();
    const res = await request(app)
      .put('/api/admin/config')
      .set('X-Admin-Key', config.adminApiKey)
      .send({
        windowMs: 45000,
        maxRequests: 75,
        violationThreshold: 4,
        blockDurationMs: 120000,
        trustProxy: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.maxRequests).toBe(75);
    expect(res.body.config.windowMs).toBe(45000);
    expect(res.body.config.violationThreshold).toBe(4);
    expect(res.body.config.trustProxy).toBe(true);
  });

  test('should reject invalid configuration values with 400 Bad Request', async () => {
    const config = getConfig();
    const res = await request(app)
      .put('/api/admin/config')
      .set('X-Admin-Key', config.adminApiKey)
      .send({
        windowMs: -500, // Invalid negative
        maxRequests: 'not-a-number', // Invalid NaN
        violationThreshold: 9999 // Out of range
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
  });
});
