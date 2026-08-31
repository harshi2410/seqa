/**
 * Centralized Error & 404 Handler Middleware
 */

const { getConfig } = require('../config/config');

/**
 * 404 Not Found Handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Endpoint ${req.method} ${req.originalUrl || req.url} not found`
  });
}

/**
 * Global Exception Handler
 */
function errorHandler(err, req, res, next) {
  const config = getConfig();
  const statusCode = err.status || err.statusCode || 500;
  
  if (config.nodeEnv !== 'test') {
    console.error(`[UNHANDLED ERROR] ${req.method} ${req.url}:`, err);
  }

  const response = {
    success: false,
    error: err.code || 'SERVER_ERROR',
    message: err.message || 'An unexpected internal server error occurred'
  };

  // Only expose stack trace in development
  if (config.nodeEnv === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler
};
