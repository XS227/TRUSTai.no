import { payoutTrendSeries } from '../data-store.js';
import { getChartTheme } from './theme.js';

function renderFallback(canvas, reason) {
  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="chart-fallback">${reason}</div>`;
}

export function initPayoutChart() {
  const canvas = document.querySelector('#payoutChart');
  if (!canvas) return;
  if (!window.Chart) return renderFallback(canvas, 'Chart.js utilgjengelig');
  if (!payoutTrendSeries.length) return renderFallback(canvas, 'Ingen datagrunnlag funnet.');

  const theme = getChartTheme();

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: payoutTrendSeries.map((item) => item.month),
      datasets: [
        { label: 'Available', data: payoutTrendSeries.map((item) => item.available), backgroundColor: `${theme.warning}AA`, borderRadius: 8 },
        { label: 'Paid', data: payoutTrendSeries.map((item) => item.paid), backgroundColor: `${theme.success}CC`, borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: theme.text } } },
      scales: {
        x: { ticks: { color: theme.muted }, grid: { color: theme.border } },
        y: { ticks: { color: theme.muted }, grid: { color: theme.border }, beginAtZero: true }
      }
    }
  });
}
