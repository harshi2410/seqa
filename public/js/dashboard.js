/**
 * Cybersecurity Dashboard Main Controller with AI Threat Intelligence Copilot
 */

// State
let currentLogTypeFilter = 'ALL';
let logSearchQuery = '';
let autoRefreshTimer = null;
let countdownSeconds = 5;

const DEFAULT_ADMIN_KEY = 'admin-secret-key-2026';

function getAdminKey() {
  return localStorage.getItem('sec_admin_key') || DEFAULT_ADMIN_KEY;
}

function setAdminKey(key) {
  localStorage.setItem('sec_admin_key', key);
  updateAdminKeyDisplay();
}

function updateAdminKeyDisplay() {
  const key = getAdminKey();
  const keyInput = document.getElementById('adminKeyInput');
  if (keyInput) {
    keyInput.value = key;
  }
  const bannerInput = document.getElementById('bannerAdminKeyInput');
  if (bannerInput && !bannerInput.value) {
    bannerInput.value = key;
  }
}

function showAuthBanner(show) {
  const banner = document.getElementById('adminAuthBanner');
  if (banner) {
    if (show) {
      banner.classList.remove('d-none');
    } else {
      banner.classList.add('d-none');
    }
  }
}

// Helper to make authenticated admin requests
async function fetchAdmin(endpoint, options = {}) {
  const adminKey = getAdminKey();
  const headers = {
    'Content-Type': 'application/json',
    'X-Admin-Key': adminKey,
    ...(options.headers || {})
  };

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401) {
    showAuthBanner(true);
    showToast('Admin Authentication Failed. Please enter your valid Admin API Key.', 'danger');
  } else if (response.ok) {
    showAuthBanner(false);
  }

  return response;
}

// Toast notification helper
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;

  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'danger' ? 'bg-danger' : (type === 'success' ? 'bg-success' : 'bg-primary');
  
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body font-mono">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  const toastEl = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

/**
 * Load and render dashboard telemetry statistics & charts
 */
async function loadStats() {
  try {
    const res = await fetchAdmin('/api/admin/stats');
    if (!res.ok) return;

    const data = await res.json();
    if (!data.success || !data.data) return;

    const { summary, charts, topViolatingIps, mostTargetedEndpoints, activeBlocks } = data.data;

    // Update Metric Cards
    document.getElementById('metricTotalRequests').textContent = (summary.totalRequests || 0).toLocaleString();
    document.getElementById('metricViolations').textContent = (summary.rateLimitViolations || 0).toLocaleString();
    document.getElementById('metricBlockedIps').textContent = (summary.currentlyBlockedIps || 0).toLocaleString();
    document.getElementById('metricTotalBlocks').textContent = (summary.totalBlocks || 0).toLocaleString();

    // Update AI Threat Copilot Insights
    updateAiCopilotInsights(summary, topViolatingIps, activeBlocks);

    // Render Charts
    if (charts && charts.hourly) {
      window.renderActivityChart(charts.hourly);
    }
    if (charts && charts.eventTypes) {
      window.renderEventsDistributionChart(charts.eventTypes);
    }

    // Render Top Violating IPs
    renderTopViolators(topViolatingIps || []);

    // Render Most Targeted Endpoints
    renderTargetedEndpoints(mostTargetedEndpoints || []);

    // Render Active Blocks
    renderActiveBlocks(activeBlocks || []);

  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

/**
 * AI Threat Intelligence Copilot Heuristics Engine
 */
function updateAiCopilotInsights(summary, topViolators, activeBlocks) {
  const threatBadge = document.getElementById('aiThreatLevel');
  const summaryEl = document.getElementById('aiCopilotSummary');
  if (!threatBadge || !summaryEl) return;

  const totalReq = summary.totalRequests || 0;
  const violations = summary.rateLimitViolations || 0;
  const blocked = summary.currentlyBlockedIps || 0;

  const violationRatio = totalReq > 0 ? (violations / totalReq) : 0;

  if (blocked > 0) {
    threatBadge.className = 'badge bg-danger bg-opacity-25 text-danger border border-danger font-mono small';
    threatBadge.textContent = `ATTACK MITIGATED (${blocked} IP QUARANTINED)`;
    summaryEl.innerHTML = `⚠️ <strong>High threat activity detected:</strong> ${blocked} abusive client IP(s) currently blocked. Rate-limiting algorithm actively shielding protected APIs. Recommended: Inspect logs or maintain block policy.`;
  } else if (violations > 0 || violationRatio > 0.1) {
    threatBadge.className = 'badge bg-warning bg-opacity-25 text-warning border border-warning font-mono small';
    threatBadge.textContent = 'ELEVATED VIOLATION RATE';
    const topIp = topViolators.length > 0 ? topViolators[0].ip : 'detected client';
    summaryEl.innerHTML = `⚡ <strong>Heuristic Warning:</strong> Client <code>${topIp}</code> exceeded rate limits with ${violations} violations. Approaching automatic IP quarantine threshold.`;
  } else {
    threatBadge.className = 'badge bg-success bg-opacity-25 text-success border border-success font-mono small';
    threatBadge.textContent = 'DEFENSES OPTIMAL';
    summaryEl.innerHTML = `🛡️ <strong>Normal baseline traffic:</strong> Quotas healthy across active sessions. Middleware security interceptor running smoothly with zero active quarantine blocks.`;
  }
}

/**
 * Render Top Violating IPs list
 */
function renderTopViolators(list) {
  const container = document.getElementById('topViolatorsList');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<div class="text-muted small py-2">No rate-limit violations recorded yet.</div>';
    return;
  }

  const html = list.map(item => `
    <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-dark">
      <span class="font-mono text-cyan">${item.ip}</span>
      <span class="badge bg-danger rounded-pill">${item.count} violations</span>
    </div>
  `).join('');

  container.innerHTML = html;
}

/**
 * Render Most Targeted Endpoints
 */
function renderTargetedEndpoints(list) {
  const container = document.getElementById('targetedEndpointsList');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<div class="text-muted small py-2">No endpoint hits recorded.</div>';
    return;
  }

  const html = list.map(item => `
    <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-dark">
      <span class="font-mono text-light">${item.endpoint}</span>
      <span class="badge bg-secondary rounded-pill">${item.hits} hits</span>
    </div>
  `).join('');

  container.innerHTML = html;
}

/**
 * Render Currently Blocked IPs Table
 */
function renderActiveBlocks(blocks) {
  const tbody = document.getElementById('blockedIpsTableBody');
  if (!tbody) return;

  if (blocks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No IP addresses are currently blocked.</td></tr>`;
    return;
  }

  const now = Date.now();

  const html = blocks.map(b => {
    const blockedUntilTime = new Date(b.blockedUntil).getTime();
    const remainingSec = Math.max(0, Math.ceil((blockedUntilTime - now) / 1000));
    const isExpired = remainingSec <= 0;

    return `
      <tr>
        <td class="font-mono font-weight-bold text-danger">${b.ip}</td>
        <td><span class="badge bg-warning text-dark">${b.violationCount || 3}</span></td>
        <td class="small text-muted">${b.reason || 'Rate limit threshold exceeded'}</td>
        <td class="small font-mono">${new Date(b.blockedUntil).toLocaleTimeString()} (${isExpired ? 'Expired' : remainingSec + 's left'})</td>
        <td class="text-end">
          <button class="btn btn-sm btn-cyber-danger" onclick="unblockIpAction('${b.ip}')">
            <i class="bi bi-unlock me-1"></i> Unblock
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

/**
 * Load Security Logs table
 */
async function loadLogs() {
  try {
    const params = new URLSearchParams();
    if (currentLogTypeFilter !== 'ALL') params.append('type', currentLogTypeFilter);
    if (logSearchQuery) params.append('search', logSearchQuery);
    params.append('limit', '50');

    const res = await fetchAdmin(`/api/admin/logs?${params.toString()}`);
    if (!res.ok) return;

    const data = await res.json();
    if (!data.success || !data.logs) return;

    renderLogsTable(data.logs);
  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}

/**
 * Render Logs in Table
 */
function renderLogsTable(logs) {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No security logs match the current criteria.</td></tr>`;
    return;
  }

  const html = logs.map(log => {
    let typeBadge = '';
    if (log.type === 'REQUEST') typeBadge = '<span class="badge-status badge-request">REQUEST</span>';
    else if (log.type === 'RATE_LIMIT_VIOLATION') typeBadge = '<span class="badge-status badge-violation"><i class="bi bi-exclamation-triangle"></i> VIOLATION</span>';
    else if (log.type === 'IP_BLOCKED') typeBadge = '<span class="badge-status badge-blocked"><i class="bi bi-shield-x"></i> BLOCKED</span>';
    else if (log.type === 'IP_UNBLOCKED') typeBadge = '<span class="badge-status badge-unblocked"><i class="bi bi-shield-check"></i> UNBLOCKED</span>';
    else typeBadge = `<span class="badge-status badge-request">${log.type}</span>`;

    let statusBadge = '';
    if (log.statusCode === 200) statusBadge = '<span class="badge badge-http-200">200 OK</span>';
    else if (log.statusCode === 429) statusBadge = '<span class="badge badge-http-429">429 TOO MANY</span>';
    else if (log.statusCode === 403) statusBadge = '<span class="badge badge-http-403">403 FORBIDDEN</span>';
    else if (log.statusCode === 404) statusBadge = '<span class="badge badge-http-404">404 NOT FOUND</span>';
    else if (log.statusCode) statusBadge = `<span class="badge bg-secondary">${log.statusCode}</span>`;
    else statusBadge = '<span class="badge bg-dark">-</span>';

    const time = new Date(log.timestamp).toLocaleTimeString();

    return `
      <tr onclick="inspectLogDetail('${log.id}')">
        <td class="font-mono text-muted small">${time}</td>
        <td>${typeBadge}</td>
        <td class="font-mono text-cyan">${log.ip}</td>
        <td><span class="badge bg-dark text-light border border-secondary">${log.method || '-'}</span></td>
        <td class="font-mono small text-truncate" style="max-width: 180px;">${log.path || '-'}</td>
        <td>${statusBadge}</td>
        <td class="small text-muted text-truncate" style="max-width: 220px;">${log.details || (log.responseTime !== undefined ? log.responseTime + 'ms' : '-')}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
  window.cachedLogs = logs;
}

/**
 * Inspect log detail in modal
 */
function inspectLogDetail(logId) {
  if (!window.cachedLogs) return;
  const log = window.cachedLogs.find(l => l.id === logId);
  if (!log) return;

  document.getElementById('modalLogId').textContent = log.id;
  document.getElementById('modalLogType').textContent = log.type;
  document.getElementById('modalLogIp').textContent = log.ip;
  document.getElementById('modalLogTime').textContent = new Date(log.timestamp).toLocaleString();
  document.getElementById('modalLogMethod').textContent = log.method || 'N/A';
  document.getElementById('modalLogPath').textContent = log.path || 'N/A';
  document.getElementById('modalLogStatus').textContent = log.statusCode || 'N/A';
  document.getElementById('modalLogResponseTime').textContent = log.responseTime !== undefined ? log.responseTime + ' ms' : 'N/A';
  document.getElementById('modalLogUserAgent').textContent = log.userAgent || 'N/A';
  document.getElementById('modalLogDetails').textContent = log.details || (log.reason ? `Reason: ${log.reason}` : 'Standard request event');
  document.getElementById('modalRawJson').textContent = JSON.stringify(log, null, 2);

  const modal = new bootstrap.Modal(document.getElementById('logDetailModal'));
  modal.show();
}

/**
 * Copy JSON from modal
 */
function copyModalJson() {
  const jsonText = document.getElementById('modalRawJson').textContent;
  navigator.clipboard.writeText(jsonText).then(() => {
    showToast('Event JSON copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'danger');
  });
}

/**
 * Export Logs as JSON file
 */
function exportLogsJson() {
  if (!window.cachedLogs || window.cachedLogs.length === 0) {
    showToast('No logs available to export', 'info');
    return;
  }

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(window.cachedLogs, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `security_logs_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Security logs exported successfully', 'success');
}

/**
 * Unblock IP Action
 */
async function unblockIpAction(ip) {
  if (!confirm(`Are you sure you want to unblock IP: ${ip}?`)) return;

  try {
    const res = await fetchAdmin('/api/admin/unblock', {
      method: 'POST',
      body: JSON.stringify({ ip, reason: 'Dashboard manual unblock' })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`IP ${ip} was successfully unblocked!`, 'success');
      loadStats();
      loadLogs();
    } else {
      showToast(data.message || 'Failed to unblock IP', 'danger');
    }
  } catch (err) {
    showToast('Network error while unblocking IP', 'danger');
  }
}

/**
 * Filter logs by type
 */
function filterLogsByType(type, btn) {
  currentLogTypeFilter = type;
  document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active', 'btn-cyan'));
  if (btn) btn.classList.add('active');
  loadLogs();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  updateAdminKeyDisplay();
  
  // Set up Admin key input save
  const keyInput = document.getElementById('adminKeyInput');
  if (keyInput) {
    keyInput.addEventListener('change', (e) => {
      setAdminKey(e.target.value.trim());
      showToast('Admin API Key updated for dashboard session', 'success');
      loadStats();
      loadLogs();
    });
  }

  // Set up Banner Admin key input save
  const bannerSaveBtn = document.getElementById('bannerSaveKeyBtn');
  const bannerInput = document.getElementById('bannerAdminKeyInput');
  if (bannerSaveBtn && bannerInput) {
    const handleBannerSave = () => {
      const val = bannerInput.value.trim();
      if (val) {
        setAdminKey(val);
        showToast('Admin API Key connected!', 'success');
        loadStats();
        loadLogs();
      }
    };
    bannerSaveBtn.addEventListener('click', handleBannerSave);
    bannerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleBannerSave();
    });
  }

  // Set up Search input
  const searchInput = document.getElementById('logSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      logSearchQuery = e.target.value.trim();
      loadLogs();
    });
  }

  // Initial load
  loadStats();
  loadLogs();

  // Auto-refresh countdown interval
  setInterval(() => {
    countdownSeconds--;
    const countdownEl = document.getElementById('refreshCountdownText');
    if (countdownEl) {
      countdownEl.textContent = `SYNC (${countdownSeconds}s)`;
    }

    if (countdownSeconds <= 0) {
      countdownSeconds = 5;
      loadStats();
      loadLogs();
    }
  }, 1000);
});

window.inspectLogDetail = inspectLogDetail;
window.copyModalJson = copyModalJson;
window.exportLogsJson = exportLogsJson;
window.unblockIpAction = unblockIpAction;
window.filterLogsByType = filterLogsByType;
window.loadStats = loadStats;
window.loadLogs = loadLogs;
