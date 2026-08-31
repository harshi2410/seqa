/**
 * Server Entry Point
 * Initializes database, loads configuration, schedules background tasks, and starts HTTP listener.
 */

const app = require('./app');
const { getConfig, updateConfig } = require('./config/config');
const jsonDb = require('./services/jsonDatabase');
const { cleanExpiredBlocks } = require('./services/blockService');
const { cleanupExpiredWindows } = require('./services/rateLimitService');

async function startServer() {
  const config = getConfig();

  // Initialize JSON database directories and seed files
  await jsonDb.initializeDatabase(config);

  // Load any previously saved dynamic config from data/config.json
  try {
    const savedConfig = await jsonDb.readData(config.configFile, null);
    if (savedConfig && typeof savedConfig === 'object') {
      updateConfig(savedConfig);
    }
  } catch (err) {
    console.warn('[CONFIG] Using default configuration:', err.message);
  }

  // Periodic background tasks:
  // 1. Clean expired rate-limit memory windows every 60s
  const rateLimitCleanupInterval = setInterval(cleanupExpiredWindows, 60000);
  
  // 2. Clean expired IP blocks in database every 60s
  const blockCleanupInterval = setInterval(() => {
    cleanExpiredBlocks().catch(err => console.error('[Block Cleanup Error]:', err.message));
  }, 60000);

  const server = app.listen(config.port, () => {
    console.log('\n======================================================');
    console.log('🛡️  API RATE-LIMITING & MIDDLEWARE SECURITY LOGGER');
    console.log('======================================================');
    console.log(`🚀 Server running on: http://localhost:${config.port}`);
    console.log(`📊 Security Dashboard: http://localhost:${config.port}/dashboard`);
    console.log(`🧪 API Test Sandbox:  http://localhost:${config.port}/dashboard/api-test`);
    console.log(`⚙️  Settings Panel:    http://localhost:${config.port}/dashboard/settings`);
    console.log(`🔑 Admin API Key:      ${config.adminApiKey}`);
    console.log(`⏱️  Rate Limit Window:  ${config.windowMs}ms | Max: ${config.maxRequests} req`);
    console.log(`⛔ Violation Threshold: ${config.violationThreshold} | Block: ${config.blockDurationMs}ms`);
    console.log('======================================================\n');
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[SERVER] Gracefully stopping server and background intervals...');
    clearInterval(rateLimitCleanupInterval);
    clearInterval(blockCleanupInterval);
    server.close(() => {
      console.log('[SERVER] Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

// Start if executed directly
if (require.main === module) {
  startServer().catch(err => {
    console.error('[FATAL SERVER START ERROR]:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
