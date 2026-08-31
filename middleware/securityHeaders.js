/**
 * Security Headers Middleware
 * Configures Helmet and custom security headers to protect against common web vulnerabilities.
 */

const helmet = require('helmet');

/**
 * Configure Helmet middleware allowing required CDNs (Bootstrap, Chart.js, Google Fonts)
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com'
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://fonts.googleapis.com'
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com'
      ],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

/**
 * Combined Security Headers Middleware
 */
function securityHeaders(req, res, next) {
  // Apply Helmet protections
  helmetMiddleware(req, res, (err) => {
    if (err) return next(err);

    // Custom explicit security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.removeHeader('X-Powered-By');

    next();
  });
}

module.exports = securityHeaders;
