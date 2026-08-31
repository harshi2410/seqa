/**
 * Rate Limiter Middleware and Service Tests
 */

const request = require('supertest');
const app = require('../app');
const { updateConfig, resetConfig } = require('../config/config');
const { resetRateLimitState } = require('../services/rateLimitService');
const { resetBlockState } = require('../services/blockService');

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    resetConfig();
    resetRateLimitState();
    resetBlockState();
  });

  test('should allow requests under the limit and set rate-limit headers', async () => {
    updateConfig({ windowMs: 60000, maxRequests: 5 });

    const res = await request(app).get('/api/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBe('4');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  test('should decrement remaining quota on successive requests', async () => {
    updateConfig({ windowMs: 60000, maxRequests: 3 });

    const res1 = await request(app).get('/api/test');
    expect(res1.status).toBe(200);
    expect(res1.headers['x-ratelimit-remaining']).toBe('2');

    const res2 = await request(app).get('/api/test');
    expect(res2.status).toBe(200);
    expect(res2.headers['x-ratelimit-remaining']).toBe('1');

    const res3 = await request(app).get('/api/test');
    expect(res3.status).toBe(200);
    expect(res3.headers['x-ratelimit-remaining']).toBe('0');
  });

  test('should return 429 Too Many Requests and Retry-After header when limit is exceeded', async () => {
    updateConfig({ windowMs: 60000, maxRequests: 2, violationThreshold: 5 });

    // Send 2 allowed requests
    await request(app).get('/api/test');
    await request(app).get('/api/test');

    // 3rd request should trigger 429
    const res3 = await request(app).get('/api/test');
    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(res3.headers['retry-after']).toBeDefined();
    expect(res3.headers['x-ratelimit-remaining']).toBe('0');
  });
});
