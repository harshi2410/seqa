/**
 * Chart.js Integration for Security Dashboard
 */

let activityChartInstance = null;
let eventsDistributionChartInstance = null;

/**
 * Initialize or update the 24-hour Request and Violation Activity Chart
 * @param {object} chartData - { labels: string[], requests: number[], violations: number[] }
 */
function renderActivityChart(chartData) {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

  const data = {
    labels: chartData.labels || [],
    datasets: [
      {
        label: 'Requests',
        data: chartData.requests || [],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6
      },
      {
        label: 'Violations',
        data: chartData.violations || [],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.25)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7
      }
    ]
  };

  if (activityChartInstance) {
    activityChartInstance.data = data;
    activityChartInstance.update();
    return;
  }

  activityChartInstance = new Chart(ctx, {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', maxTicksLimit: 12 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', precision: 0 },
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Initialize or update the Security Events Breakdown Doughnut Chart
 * @param {object} eventTypes - { requests: number, violations: number, blocks: number }
 */
function renderEventsDistributionChart(eventTypes) {
  const ctx = document.getElementById('eventsChart');
  if (!ctx) return;

  const data = {
    labels: ['Requests', 'Violations', 'Blocks'],
    datasets: [{
      data: [
        eventTypes.requests || 0,
        eventTypes.violations || 0,
        eventTypes.blocks || 0
      ],
      backgroundColor: [
        '#38bdf8', // Requests (cyan/blue)
        '#f59e0b', // Violations (amber)
        '#ef4444'  // Blocks (red)
      ],
      borderWidth: 0,
      hoverOffset: 6
    }]
  };

  if (eventsDistributionChartInstance) {
    eventsDistributionChartInstance.data = data;
    eventsDistributionChartInstance.update();
    return;
  }

  eventsDistributionChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 12 },
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10
        }
      }
    }
  });
}

window.renderActivityChart = renderActivityChart;
window.renderEventsDistributionChart = renderEventsDistributionChart;
