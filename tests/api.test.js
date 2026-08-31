/**
 * Public API & Error Handling Tests
 */

const request = require('supertest');
const app = require('../app');
const { resetConfig } = require('../config/config');
const { resetRateLimitState } = require('../services/rateLimitService');
const { resetBlockState } = require('../services/blockService');

describe('Public API Endpoints and Error Handling', () => {
  beforeEach(() => {
    resetConfig();
    resetRateLimitState();
    resetBlockState();
  });

  test('GET /health should return 200 OK and service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBeDefined();
  });

  test('GET /api/test should return 200 OK with success payload', async () => {
    const res = await request(app).get('/api/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('API request successful');
  });

  test('GET /api/data should return 200 OK with data array', async () => {
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test('GET /api/slow should handle simulated latency and return 200', async () => {
    const res = await request(app).get('/api/slow?delay=50');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Unknown route should return 404 with standardized JSON error', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
