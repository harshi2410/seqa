/**
 * API Test & TAE Demo Sandbox Controller with Automated Viva Presentation Mode
 */

let testRequestCounter = 0;
let isRunningBatch = false;

// Toast helper
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
  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
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
 * 1-Click Automated TAE Viva Demonstration Runner
 */
async function runAutomatedVivaDemo() {
  if (isRunningBatch) return;
  isRunningBatch = true;
  updateControlsState(true);

  showToast('🎓 Starting Automated TAE Viva Demonstration Presentation...', 'info');

  // Step 1: Normal Request (200 OK)
  setDemoStepActive(1);
  showToast('Step 1: Sending single normal request (200 OK)...', 'info');
  await executeRequest();
  await new Promise(r => setTimeout(r, 1200));

  // Step 2: Quota Exhaustion Burst
  setDemoStepActive(2);
  showToast('Step 2: Sending rapid request burst to deplete quota...', 'info');
  for (let i = 0; i < 6; i++) {
    await executeRequest();
    await new Promise(r => setTimeout(r, 80));
  }
  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Trigger 429 Rate Limit Exceeded
  setDemoStepActive(3);
  showToast('Step 3: Exceeding rate limit -> Generating 429 Too Many Requests...', 'warning');
  await executeRequest();
  await new Promise(r => setTimeout(r, 1200));

  // Step 4: Trigger Repeated Violations until 403 IP Quarantine
  setDemoStepActive(4);
  showToast('Step 4: Repeated violations triggering automatic IP Quarantine (403 Forbidden)...', 'danger');
  for (let i = 0; i < 30; i++) {
    const res = await executeRequest();
    await new Promise(r => setTimeout(r, 60));
    if (res && res.status === 403) {
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  // Step 5: Unblock & Restore Access
  setDemoStepActive(5);
  showToast('Step 5: Invoking Administrator Unblock to restore access...', 'success');
  await quickUnblockMyIp();
  await new Promise(r => setTimeout(r, 1000));

  // Verify access restored
  await executeRequest();
  showToast('🎉 TAE DEMO COMPLETE: Full security cycle demonstrated successfully!', 'success');

  isRunningBatch = false;
  updateControlsState(false);
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

  showToast(`Initiating rapid batch of ${count} requests...`, 'info');

  for (let i = 0; i < count; i++) {
    const result = await executeRequest();
    await new Promise(r => setTimeout(r, 60));
    
    if (result && result.status === 403) {
      setDemoStepActive(4);
      showToast(`IP has been blocked on request #${testRequestCounter}!`, 'danger');
      break;
    } else if (result && result.status === 429) {
      setDemoStepActive(3);
    }
  }

  isRunningBatch = false;
  updateControlsState(false);
}

/**
 * Simulate attack: flood until rate limit exceeded and blocked
 */
async function simulateAttack() {
  if (isRunningBatch) return;
  if (!confirm('This will send rapid bursts of requests to exceed the limit and demonstrate automatic IP blocking. Proceed?')) {
    return;
  }

  isRunningBatch = true;
  updateControlsState(true);
  setDemoStepActive(3);
  showToast('Starting attack simulation to trigger 429 and 403 IP block...', 'warning');

  for (let i = 0; i < 100; i++) {
    const result = await executeRequest();
    await new Promise(r => setTimeout(r, 40));

    if (result && result.status === 403) {
      setDemoStepActive(4);
      showToast(`🎯 DEMO OBJECTIVE ACHIEVED: IP BLOCKED (403 Forbidden)`, 'danger');
      break;
    }
  }

  isRunningBatch = false;
  updateControlsState(false);
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

  if (quotaLimitEl) quotaLimitEl.textContent = limit;
  if (quotaRemainingEl) quotaRemainingEl.textContent = remaining;

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
      quotaStatusBadge.innerHTML = `<span class="badge bg-secondary">${status}</span>`;
    }
  }

  if (diagText) {
    if (status === 200) {
      diagText.innerHTML = `🟢 <strong>200 OK</strong> | Client permitted. Remaining Quota: <strong>${remaining}/${limit}</strong> | Latency: <strong>${elapsed}ms</strong>.`;
    } else if (status === 429) {
      diagText.innerHTML = `🟡 <strong>429 TOO MANY REQUESTS</strong> | Window exhausted. Server sent <code>Retry-After: ${retryAfter}s</code>. Security violation registered.`;
    } else if (status === 403) {
      diagText.innerHTML = `🔴 <strong>403 IP BLOCKED</strong> | Repeated rate-limit violations breached the threshold. IP quarantined from protected routes.`;
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

  if (result.reqNum === 1 && tbody.querySelector('.placeholder-row')) {
    tbody.innerHTML = '';
  }

  let statusBadge = '';
  if (result.status === 200) {
    statusBadge = '<span class="badge badge-http-200">200 OK</span>';
  } else if (result.status === 429) {
    statusBadge = '<span class="badge badge-http-429">429 TOO MANY</span>';
  } else if (result.status === 403) {
    statusBadge = '<span class="badge badge-http-403">403 BLOCKED</span>';
  } else {
    statusBadge = `<span class="badge bg-secondary">${result.status}</span>`;
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
  const adminKey = localStorage.getItem('sec_admin_key') || 'admin-secret-key-2026';
  
  try {
    const res = await fetch('/api/admin/unblock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey
      },
      body: JSON.stringify({ ip: '127.0.0.1', reason: 'TAE sandbox quick unblock' })
    });

    const data = await res.json();
    if (data.success) {
      showToast('IP 127.0.0.1 unblocked successfully! Access restored.', 'success');
      updateQuotaDisplay('100', '100', '-', 200, 0, 5);
      setDemoStepActive(5);
    } else {
      showToast(data.message || 'Failed to unblock IP', 'danger');
    }
  } catch (err) {
    showToast('Failed to contact admin unblock endpoint', 'danger');
  }
}

/**
 * Disable/enable buttons during batches
 */
function updateControlsState(disabled) {
  const buttons = document.querySelectorAll('.test-action-btn');
  buttons.forEach(b => b.disabled = disabled);
}

window.runAutomatedVivaDemo = runAutomatedVivaDemo;
window.sendSingleRequest = sendSingleRequest;
window.sendBatchRequests = sendBatchRequests;
window.simulateAttack = simulateAttack;
window.clearTestHistory = clearTestHistory;
window.quickUnblockMyIp = quickUnblockMyIp;
