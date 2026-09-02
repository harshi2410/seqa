/**
 * Rate Limiting & Security Settings Controller with AI Policy Presets
 */

function getAdminKey() {
  return localStorage.getItem('sec_admin_key') || 'admin-secret-key-2026';
}

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
 * Load current configuration from backend
 */
async function loadConfig() {
  try {
    const res = await fetch('/api/admin/config', {
      headers: {
        'X-Admin-Key': getAdminKey()
      }
    });

    if (res.status === 401) {
      showToast('Admin Authentication required to view configuration.', 'danger');
      return;
    }

    const data = await res.json();
    if (!data.success || !data.config) return;

    const { windowMs, maxRequests, violationThreshold, blockDurationMs, trustProxy } = data.config;

    document.getElementById('windowMsInput').value = windowMs;
    document.getElementById('maxRequestsInput').value = maxRequests;
    document.getElementById('violationThresholdInput').value = violationThreshold;
    document.getElementById('blockDurationMsInput').value = blockDurationMs;
    document.getElementById('trustProxySelect').value = String(trustProxy);

    // Update helper labels
    document.getElementById('windowSecondsDisplay').textContent = `${windowMs / 1000}s`;
    document.getElementById('blockMinutesDisplay').textContent = `${blockDurationMs / 60000} min (${blockDurationMs / 1000}s)`;

  } catch (err) {
    showToast('Failed to load settings: ' + err.message, 'danger');
  }
}

/**
 * Apply AI Security Preset
 */
async function applyPreset(presetType) {
  let presetConfig = {};

  if (presetType === 'demo') {
    presetConfig = {
      windowMs: 30000,
      maxRequests: 5,
      violationThreshold: 2,
      blockDurationMs: 60000,
      trustProxy: false
    };
    showToast('Applied "Demo Presentation Profile" (5 req / 30s, 2 violations -> 60s block)', 'info');
  } else if (presetType === 'strict') {
    presetConfig = {
      windowMs: 60000,
      maxRequests: 20,
      violationThreshold: 2,
      blockDurationMs: 600000,
      trustProxy: false
    };
    showToast('Applied "Strict Defense Profile" (20 req / 60s, 10 min block)', 'info');
  } else if (presetType === 'standard') {
    presetConfig = {
      windowMs: 60000,
      maxRequests: 100,
      violationThreshold: 3,
      blockDurationMs: 300000,
      trustProxy: false
    };
    showToast('Applied "Standard Web API Profile" (100 req / 60s, 5 min block)', 'info');
  }

  document.getElementById('windowMsInput').value = presetConfig.windowMs;
  document.getElementById('maxRequestsInput').value = presetConfig.maxRequests;
  document.getElementById('violationThresholdInput').value = presetConfig.violationThreshold;
  document.getElementById('blockDurationMsInput').value = presetConfig.blockDurationMs;
  document.getElementById('trustProxySelect').value = String(presetConfig.trustProxy);

  document.getElementById('windowSecondsDisplay').textContent = `${presetConfig.windowMs / 1000}s`;
  document.getElementById('blockMinutesDisplay').textContent = `${presetConfig.blockDurationMs / 60000} min (${presetConfig.blockDurationMs / 1000}s)`;

  // Automatically save
  await saveConfig();
}

/**
 * Save updated configuration
 */
async function saveConfig(e) {
  if (e) e.preventDefault();

  const windowMs = parseInt(document.getElementById('windowMsInput').value, 10);
  const maxRequests = parseInt(document.getElementById('maxRequestsInput').value, 10);
  const violationThreshold = parseInt(document.getElementById('violationThresholdInput').value, 10);
  const blockDurationMs = parseInt(document.getElementById('blockDurationMsInput').value, 10);
  const trustProxy = document.getElementById('trustProxySelect').value === 'true';

  try {
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': getAdminKey()
      },
      body: JSON.stringify({
        windowMs,
        maxRequests,
        violationThreshold,
        blockDurationMs,
        trustProxy
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast('Configuration updated and saved to data/config.json!', 'success');
      loadConfig();
    } else {
      const errorMsg = data.errors ? data.errors.join(', ') : (data.message || 'Validation error');
      showToast(errorMsg, 'danger');
    }
  } catch (err) {
    showToast('Error saving configuration: ' + err.message, 'danger');
  }
}

/**
 * Reset configuration to default settings
 */
async function resetToDefaults() {
  if (!confirm('Are you sure you want to reset all rate-limit and security parameters to system defaults?')) {
    return;
  }

  try {
    const res = await fetch('/api/admin/reset-config', {
      method: 'POST',
      headers: {
        'X-Admin-Key': getAdminKey()
      }
    });

    const data = await res.json();
    if (data.success) {
      showToast('Configuration reset to defaults successfully!', 'success');
      loadConfig();
    } else {
      showToast(data.message || 'Reset failed', 'danger');
    }
  } catch (err) {
    showToast('Error resetting configuration', 'danger');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('adminKeyInput');
  if (keyInput) {
    keyInput.value = getAdminKey();
    keyInput.addEventListener('change', (e) => {
      localStorage.setItem('sec_admin_key', e.target.value.trim());
      showToast('Admin API Key updated', 'success');
      loadConfig();
    });
  }

  loadConfig();

  const form = document.getElementById('settingsForm');
  if (form) {
    form.addEventListener('submit', saveConfig);
  }

  document.getElementById('windowMsInput').addEventListener('input', (e) => {
    const val = Number(e.target.value);
    document.getElementById('windowSecondsDisplay').textContent = isNaN(val) ? '' : `${val / 1000}s`;
  });

  document.getElementById('blockDurationMsInput').addEventListener('input', (e) => {
    const val = Number(e.target.value);
    document.getElementById('blockMinutesDisplay').textContent = isNaN(val) ? '' : `${val / 60000} min (${val / 1000}s)`;
  });
});

window.saveConfig = saveConfig;
window.applyPreset = applyPreset;
window.resetToDefaults = resetToDefaults;
