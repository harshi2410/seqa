/**
 * API Test & TAE Demo Sandbox Controller with Automated Viva Presentation Mode
 */

let testRequestCounter = 0;
let isRunningBatch = false;
let detectedClientIp = '127.0.0.1';

const DEFAULT_ADMIN_KEY = 'admin-secret-key-2026';

function getAdminKey() {
  return localStorage.getItem('sec_admin_key') || DEFAULT_ADMIN_KEY;
}

function setAdminKey(key) {
  localStorage.setItem('sec_admin_key', key);
  const keyInput = document.getElementById('adminKeyInput');
  if (keyInput) keyInput.value = key;
}

function updateClientIpDisplay(ip) {
  if (ip && typeof ip === 'string') {
    detectedClientIp = ip;
    const btn = document.getElementById('btnUnblockMyIp');
    if (btn) {
      btn.innerHTML = `<i class="bi bi-unlock-fill me-1"></i> Unblock My IP (${ip})`;
    }
  }
}

// Safe Toast helper
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;

  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'danger' ? 'bg-danger' : (type === 'success' ? 'bg-success' : (type === 'warning' ? 'bg-warning text-dark' : 'bg-primary'));
  
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
  try {
    if (window.bootstrap && bootstrap.Toast) {
      const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
      toast.show();
      toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
  } catch (_) {}
}

/**
 * Update active demonstration step in UI
 */
function setDemoStepActive(stepNum) {
  document.querySelectorAll('.demo-step').forEach((el, idx) => {
    if (idx + 1 === stepNum) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

/**
 * Disable/enable buttons during batches
 */
function updateControlsState(disabled) {
  const buttons = document.querySelectorAll('.test-action-btn');
  buttons.forEach(b => {
    b.disabled = disabled;
  });
}

/**
 * 1-Click Automated TAE Viva Demonstration Runner
 */
async function runAutomatedVivaDemo() {
  if (isRunningBatch) return;
  isRunningBatch = true;
  updateControlsState(true);

  try {
    showToast('🎓 Starting Automated TAE Viva Demonstration Presentation...', 'info');

    // Step 1: Normal Request (200 OK)
    setDemoStepActive(1);
    showToast('Step 1: Sending single normal request (200 OK)...', 'info');
    await executeRequest();
    await new Promise(r => setTimeout(r, 1000));

    // Step 2: Quota Exhaustion Burst
    setDemoStepActive(2);
    showToast('Step 2: Sending rapid request burst to deplete quota...', 'info');
    for (let i = 0; i < 6; i++) {
      await executeRequest();
      await new Promise(r => setTimeout(r, 80));
    }
    await new Promise(r => setTimeout(r, 800));

    // Step 3: Trigger 429 Rate Limit Exceeded
    setDemoStepActive(3);
    showToast('Step 3: Exceeding rate limit -> Generating 429 Too Many Requests...', 'warning');
    await executeRequest();
    await new Promise(r => setTimeout(r, 1000));

    // Step 4: Trigger Repeated Violations until 403 IP Quarantine
    setDemoStepActive(4);
    showToast('Step 4: Repeated violations triggering automatic IP Quarantine (403 Forbidden)...', 'danger');
    for (let i = 0; i < 25; i++) {
      const res = await executeRequest();
      await new Promise(r => setTimeout(r, 60));
      if (res && res.status === 403) {
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1000));

    // Step 5: Unblock & Restore Access
    setDemoStepActive(5);
    showToast('Step 5: Invoking Administrator Unblock to restore access...', 'success');
    await quickUnblockMyIp();
    await new Promise(r => setTimeout(r, 1000));

    // Verify access restored
    await executeRequest();
    showToast('🎉 TAE DEMO COMPLETE: Full security cycle demonstrated successfully!', 'success');
  } catch (err) {
    console.error('Demo error:', err);
    showToast('Demo encountered error: ' + err.message, 'danger');
  } finally {
    isRunningBatch = false;
    updateControlsState(false);
  }
}

/**
 * Execute a single test request against the selected endpoint
 */
async function sendSingleRequest() {
  if (isRunningBatch) return;
  setDemoStepActive(1);
  await executeRequest();
}

/**
 * Execute a batch of N requests in rapid succession
 */
async function sendBatchRequests(count = 10) {
  if (isRunningBatch) return;
  isRunningBatch = true;
  updateControlsState(true);
  setDemoStepActive(2);

  try {
    showToast(`Initiating rapid batch of ${count} requests...`, 'info');

    for (let i = 0; i < count; i++) {
      const result = await executeRequest();
      await new Promise(r => setTimeout(r, 60));
      
      if (result && result.status === 403) {
        setDemoStepActive(4);
        showToast(`IP blocked on request #${testRequestCounter}!`, 'danger');
        break;
      } else if (result && result.status === 429) {
        setDemoStepActive(3);
      }
    }
  } catch (err) {
    console.error('Batch error:', err);
  } finally {
    isRunningBatch = false;
    updateControlsState(false);
  }
}

/**
 * Simulate attack: flood until rate limit exceeded and blocked
 */
async function simulateAttack() {
  if (isRunningBatch) return;
  isRunningBatch = true;
  updateControlsState(true);
  setDemoStepActive(3);

  try {
    showToast('Starting attack simulation to trigger 429 and 403 IP block...', 'warning');

    for (let i = 0; i < 60; i++) {
      const result = await executeRequest();
      await new Promise(r => setTimeout(r, 40));

      if (result && result.status === 403) {
        setDemoStepActive(4);
        showToast(`🎯 DEMO OBJECTIVE ACHIEVED: IP BLOCKED (403 Forbidden)`, 'danger');
        break;
      }
    }
  } catch (err) {
    console.error('Simulate attack error:', err);
  } finally {
    isRunningBatch = false;
    updateControlsState(false);
  }
}

/**
 * Core request executor
 */
async function executeRequest() {
  testRequestCounter++;
  const endpointSelect = document.getElementById('endpointSelect');
  const endpoint = endpointSelect ? endpointSelect.value : '/api/test';

  const startTime = performance.now();
  let status = 0;
  let remaining = '-';
  let limit = '-';
  let resetTime = '-';
  let retryAfter = '-';
  let responseData = null;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const elapsed = Math.round(performance.now() - startTime);
    status = res.status;

    limit = res.headers.get('x-ratelimit-limit') || '-';
    remaining = res.headers.get('x-ratelimit-remaining') || '-';
    resetTime = res.headers.get('x-ratelimit-reset') || '-';
    retryAfter = res.headers.get('retry-after') || '-';

    try {
      responseData = await res.json();
    } catch (_) {
      responseData = { raw: await res.text() };
    }

    // Extract detected client IP from response if present
    if (responseData && (responseData.clientIp || responseData.ip)) {
      updateClientIpDisplay(responseData.clientIp || responseData.ip);
    }

    // Update Live Quota Display & AI Diagnostics
    updateQuotaDisplay(limit, remaining, resetTime, status, retryAfter, elapsed);

    // Append to results table
    appendResultRow({
      reqNum: testRequestCounter,
      endpoint,
      status,
      elapsed,
      limit,
      remaining,
      retryAfter,
      data: responseData
    });

    return { status, responseData };
  } catch (err) {
    const elapsed = Math.round(performance.now() - startTime);
    appendResultRow({
      reqNum: testRequestCounter,
      endpoint,
      status: 0,
      elapsed,
      limit: '-',
      remaining: '-',
      retryAfter: '-',
      data: { error: err.message }
    });
    return { status: 0 };
  }
}

/**
 * Update the Rate Limit Gauge and AI Diagnostics on the page
 */
function updateQuotaDisplay(limit, remaining, resetTime, status, retryAfter, elapsed) {
  const quotaLimitEl = document.getElementById('quotaLimit');
  const quotaRemainingEl = document.getElementById('quotaRemaining');
  const quotaProgressBar = document.getElementById('quotaProgressBar');
  const quotaStatusBadge = document.getElementById('quotaStatusBadge');
  const diagText = document.getElementById('aiDiagnosticText');

  if (quotaLimitEl && limit !== '-') quotaLimitEl.textContent = limit;
  if (quotaRemainingEl && remaining !== '-') quotaRemainingEl.textContent = remaining;

  if (limit !== '-' && remaining !== '-') {
    const l = Number(limit);
    const r = Number(remaining);
    const percent = Math.max(0, Math.min(100, Math.round((r / l) * 100)));
    
    if (quotaProgressBar) {
      quotaProgressBar.style.width = `${percent}%`;
      if (percent > 50) {
        quotaProgressBar.style.background = 'linear-gradient(90deg, #10b981, #38bdf8)';
      } else if (percent > 20) {
        quotaProgressBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
      } else {
        quotaProgressBar.style.background = 'linear-gradient(90deg, #ef4444, #f43f5e)';
      }
    }
  }

  if (quotaStatusBadge) {
    if (status === 200) {
      quotaStatusBadge.innerHTML = '<span class="badge badge-status badge-unblocked"><i class="bi bi-check-circle"></i> ALLOWED (200 OK)</span>';
    } else if (status === 429) {
      quotaStatusBadge.innerHTML = '<span class="badge badge-status badge-violation"><i class="bi bi-exclamation-triangle"></i> RATE LIMITED (429)</span>';
    } else if (status === 403) {
      quotaStatusBadge.innerHTML = '<span class="badge badge-status badge-blocked"><i class="bi bi-shield-x"></i> IP QUARANTINED (403)</span>';
    } else {
      quotaStatusBadge.innerHTML = `<span class="badge bg-secondary">${status || 'ERR'}</span>`;
    }
  }

  if (diagText) {
    if (status === 200) {
      diagText.innerHTML = `🟢 <strong>200 OK</strong> | Client permitted. Remaining Quota: <strong>${remaining}/${limit}</strong> | Latency: <strong>${elapsed}ms</strong>.`;
    } else if (status === 429) {
      diagText.innerHTML = `🟡 <strong>429 TOO MANY REQUESTS</strong> | Window exhausted. Server sent <code>Retry-After: ${retryAfter}s</code>. Security violation registered.`;
    } else if (status === 403) {
      diagText.innerHTML = `🔴 <strong>403 IP BLOCKED</strong> | Repeated rate-limit violations breached the threshold. IP quarantined from protected routes.`;
    } else if (status === 0) {
      diagText.innerHTML = `⚠️ <strong>Network Error</strong> | Failed to reach server. Check internet or server status.`;
    } else {
      diagText.innerHTML = `Status ${status} recorded in ${elapsed}ms.`;
    }
  }
}

/**
 * Append row to results table
 */
function appendResultRow(result) {
  const tbody = document.getElementById('testResultsTableBody');
  if (!tbody) return;

  const placeholder = tbody.querySelector('.placeholder-row');
  if (placeholder) {
    placeholder.remove();
  }

  let statusBadge = '';
  if (result.status === 200) {
    statusBadge = '<span class="badge badge-http-200">200 OK</span>';
  } else if (result.status === 429) {
    statusBadge = '<span class="badge badge-http-429">429 TOO MANY</span>';
  } else if (result.status === 403) {
    statusBadge = '<span class="badge badge-http-403">403 BLOCKED</span>';
  } else {
    statusBadge = `<span class="badge bg-secondary">${result.status || 'ERR'}</span>`;
  }

  const row = document.createElement('tr');
  row.className = result.status === 403 ? 'table-danger' : (result.status === 429 ? 'table-warning' : '');

  row.innerHTML = `
    <td class="font-mono text-muted">#${result.reqNum}</td>
    <td class="font-mono small text-cyan">${result.endpoint}</td>
    <td>${statusBadge}</td>
    <td class="font-mono font-weight-bold ${result.remaining === '0' ? 'text-danger' : 'text-light'}">${result.remaining}</td>
    <td class="font-mono small text-muted">${result.elapsed} ms</td>
    <td class="small font-mono text-truncate" style="max-width: 260px;">
      <code>${JSON.stringify(result.data)}</code>
    </td>
  `;

  tbody.prepend(row);
}

/**
 * Clear test history
 */
function clearTestHistory() {
  testRequestCounter = 0;
  const tbody = document.getElementById('testResultsTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr class="placeholder-row"><td colspan="6" class="text-center text-muted py-4">No requests sent yet. Click any action above to test.</td></tr>';
  }
  updateQuotaDisplay('-', '-', '-', 200, 0, 0);
  setDemoStepActive(1);
}

/**
 * Quick Unblock self helper
 */
async function quickUnblockMyIp() {
  const adminKey = getAdminKey();
  const targetIp = detectedClientIp || '127.0.0.1';
  
  try {
    const res = await fetch('/api/admin/unblock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey
      },
      body: JSON.stringify({ ip: targetIp, reason: 'TAE sandbox quick unblock' })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`IP ${targetIp} unblocked successfully! Access restored.`, 'success');
      updateQuotaDisplay('100', '100', '-', 200, 0, 5);
      setDemoStepActive(5);
    } else {
      showToast(data.message || 'Failed to unblock IP (Check your Admin Key)', 'danger');
    }
  } catch (err) {
    showToast('Failed to contact admin unblock endpoint', 'danger');
  }
}

// Page Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Sync Admin Key input
  const keyInput = document.getElementById('adminKeyInput');
  if (keyInput) {
    keyInput.value = getAdminKey();
    keyInput.addEventListener('change', (e) => {
      setAdminKey(e.target.value.trim());
      showToast('Admin API Key updated for sandbox session', 'success');
    });
  }

  // Explicit Button Event Listeners
  const btnSingle = document.getElementById('btnSendSingle');
  if (btnSingle) btnSingle.addEventListener('click', () => sendSingleRequest());

  const btnBatch = document.getElementById('btnSendBatch');
  if (btnBatch) btnBatch.addEventListener('click', () => sendBatchRequests(10));

  const btnSimulate = document.getElementById('btnSimulateAttack');
  if (btnSimulate) btnSimulate.addEventListener('click', () => simulateAttack());

  const btnAutoDemo = document.getElementById('btnAutoDemo');
  if (btnAutoDemo) btnAutoDemo.addEventListener('click', () => runAutomatedVivaDemo());

  const btnUnblock = document.getElementById('btnUnblockMyIp');
  if (btnUnblock) btnUnblock.addEventListener('click', () => quickUnblockMyIp());

  const btnClear = document.getElementById('btnClearHistory');
  if (btnClear) btnClear.addEventListener('click', () => clearTestHistory());

  // Pre-fetch health or test endpoint to detect client IP automatically
  fetch('/api/test')
    .then(r => r.json())
    .then(data => {
      if (data && (data.clientIp || data.ip)) {
        updateClientIpDisplay(data.clientIp || data.ip);
      }
    })
    .catch(() => {});
});

// Window Exports
window.runAutomatedVivaDemo = runAutomatedVivaDemo;
window.sendSingleRequest = sendSingleRequest;
window.sendBatchRequests = sendBatchRequests;
window.simulateAttack = simulateAttack;
window.clearTestHistory = clearTestHistory;
window.quickUnblockMyIp = quickUnblockMyIp;
window.sendSingleRequest = sendSingleRequest;
