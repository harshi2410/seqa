/**
 * Express Application Setup
 * Orchestrates security middleware pipeline, route dispatchers, and error handling.
 */

const express = require('express');
const path = require('path');
const { getConfig } = require('./config/config');
const jsonDb = require('./services/jsonDatabase');

// Middlewares
const securityHeaders = require('./middleware/securityHeaders');
const requestLogger = require('./middleware/requestLogger');
const ipBlocker = require('./middleware/ipBlocker');
const rateLimiter = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Routes
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const config = getConfig();

// Ensure data directory exists
jsonDb.ensureDirSync(config.dataDir);

// Configure trust proxy based on application settings
app.set('trust proxy', config.trustProxy);

// 1. Security HTTP Headers (Helmet, Content-Security-Policy, Frameguard)
app.use(securityHeaders);

// 2. Request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 3. Static Assets for Frontend UI
app.use(express.static(path.join(__dirname, 'public')));

// 4. Request Logging & Telemetry Interceptor (executes for all requests)
app.use(requestLogger);

// 5. Web Dashboard Pages (public web views)
app.use('/', dashboardRoutes);

// 6. Protected Administrative API (/api/admin/*)
app.use('/api/admin', adminRoutes);

// 7. Security Protection Pipeline for Public APIs:
// - Step A: IP Blocker (Verifies IP is not in active blocked list -> 403 Forbidden)
// - Step B: Rate Limiter (Enforces sliding window quota -> 429 Too Many Requests, tracks threshold)
// - Step C: API Route Handlers (/health, /api/test, /api/data, /api/slow)
app.use('/', ipBlocker, rateLimiter, apiRoutes);

// 8. 404 Route Not Found Handler
app.use(notFoundHandler);

// 9. Centralized Error Handler
app.use(errorHandler);

module.exports = app;
