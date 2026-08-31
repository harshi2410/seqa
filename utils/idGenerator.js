/**
 * Unique ID Generator for Security Events and Logs
 * Creates formatted, collision-resistant event identifiers with contextual prefixes.
 */

const crypto = require('crypto');

let counter = 0;

/**
 * Generate a unique ID with custom prefix
 * @param {string} prefix - e.g., 'LOG', 'VL', 'BL', 'UNBL'
 * @returns {string} Formatted ID (e.g., 'VL-20260901-4A8F9')
 */
function generateId(prefix = 'EVT') {
  counter = (counter + 1) % 10000;
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  const seq = counter.toString().padStart(4, '0');
  return `${prefix}-${timestamp}-${random}${seq.slice(-2)}`;
}

module.exports = {
  generateId,
  generateLogId: () => generateId('LOG'),
  generateViolationId: () => generateId('VL'),
  generateBlockId: () => generateId('BL'),
  generateUnblockId: () => generateId('UNBL')
};
