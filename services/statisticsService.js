/**
 * Statistics & Analytics Service
 * Aggregates cybersecurity telemetry, traffic trends, violation distributions, and chart data.
 */

const { getConfig } = require('../config/config');
const jsonDb = require('./jsonDatabase');

/**
 * Generates aggregated security dashboard metrics
 * @returns {Promise<object>}
 */
async function getDashboardStats() {
  const config = getConfig();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Read logs, blocks, and stats
  const [logs, blocks, statsFile] = await Promise.all([
    jsonDb.readData(config.logsFile, []),
    jsonDb.readData(config.blocksFile, []),
    jsonDb.readData(config.statsFile, { totalRequests: 0, totalViolations: 0, totalBlocks: 0 })
  ]);

  // Total counters
  let totalRequests = statsFile.totalRequests || 0;
  let totalViolations = statsFile.totalViolations || 0;
  let totalBlocks = statsFile.totalBlocks || 0;

  // Fallbacks if stats file was reset
  if (totalRequests === 0 && logs.length > 0) {
    totalRequests = logs.filter(l => l.type === 'REQUEST').length;
    totalViolations = logs.filter(l => l.type === 'RATE_LIMIT_VIOLATION').length;
    totalBlocks = blocks.length;
  }

  // Active blocks calculation
  const activeBlocksList = blocks.filter(b => {
    const isUnblocked = b.status === 'UNBLOCKED';
    const isPast = new Date(b.blockedUntil).getTime() <= now;
    return b.status === 'ACTIVE' && !isUnblocked && !isPast;
  });
  const currentlyBlockedIps = activeBlocksList.length;

  // Requests in last 24h & unique IPs
  const uniqueIps = new Set();
  let requestsToday = 0;
  const ipViolationMap = {};
  const endpointMap = {};
  const statusCodesMap = {};
  const hourlyActivity = Array(24).fill(0);
  const hourlyViolations = Array(24).fill(0);

  const currentHour = new Date().getHours();

  for (const log of logs) {
    if (log.ip) uniqueIps.add(log.ip);

    const logTime = new Date(log.timestamp).getTime();
    if (logTime >= oneDayAgo) {
      if (log.type === 'REQUEST') {
        requestsToday++;
        const logHour = new Date(log.timestamp).getHours();
        hourlyActivity[logHour] = (hourlyActivity[logHour] || 0) + 1;
      }
      if (log.type === 'RATE_LIMIT_VIOLATION') {
        const logHour = new Date(log.timestamp).getHours();
        hourlyViolations[logHour] = (hourlyViolations[logHour] || 0) + 1;
      }
    }

    if (log.type === 'RATE_LIMIT_VIOLATION') {
      ipViolationMap[log.ip] = (ipViolationMap[log.ip] || 0) + 1;
    }

    if (log.path) {
      endpointMap[log.path] = (endpointMap[log.path] || 0) + 1;
    }

    if (log.statusCode) {
      const code = String(log.statusCode);
      statusCodesMap[code] = (statusCodesMap[code] || 0) + 1;
    }
  }

  // Top Violating IPs
  const topViolatingIps = Object.entries(ipViolationMap)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Most Targeted Endpoints
  const mostTargetedEndpoints = Object.entries(endpointMap)
    .map(([endpoint, hits]) => ({ endpoint, hits }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5);

  // Reorder hourly buckets so they display past 24 hours leading up to current hour
  const hourlyLabels = [];
  const hourlyReqData = [];
  const hourlyViolData = [];

  for (let i = 23; i >= 0; i--) {
    const h = (currentHour - i + 24) % 24;
    const label = `${h.toString().padStart(2, '0')}:00`;
    hourlyLabels.push(label);
    hourlyReqData.push(hourlyActivity[h] || 0);
    hourlyViolData.push(hourlyViolations[h] || 0);
  }

  return {
    summary: {
      totalRequests,
      requestsToday: requestsToday || totalRequests,
      rateLimitViolations: totalViolations,
      uniqueIpsCount: uniqueIps.size,
      currentlyBlockedIps,
      totalBlocks
    },
    topViolatingIps,
    mostTargetedEndpoints,
    statusCodes: statusCodesMap,
    charts: {
      hourly: {
        labels: hourlyLabels,
        requests: hourlyReqData,
        violations: hourlyViolData
      },
      eventTypes: {
        requests: totalRequests,
        violations: totalViolations,
        blocks: totalBlocks
      }
    },
    activeBlocks: activeBlocksList.map(b => ({
      id: b.id,
      ip: b.ip,
      reason: b.reason,
      violationCount: b.violationCount,
      blockedAt: b.blockedAt,
      blockedUntil: b.blockedUntil
    }))
  };
}

module.exports = {
  getDashboardStats
};
