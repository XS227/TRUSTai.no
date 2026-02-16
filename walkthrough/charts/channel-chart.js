import { getChartTheme } from './theme.js';

function renderFallback(canvas, reason) {
  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="chart-fallback">${reason}</div>`;
}

export function initChannelChart(revenueByChannel = []) {
  const canvas = document.querySelector('#channelChart');
  if (!canvas) return;
  if (!window.Chart) return renderFallback(canvas, 'Chart.js utilgjengelig');
  if (!revenueByChannel.length) return renderFallback(canvas, 'Ingen datagrunnlag funnet.');

  const theme = getChartTheme();

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: revenueByChannel.map((d) => d.label),
      datasets: [{ data: revenueByChannel.map((d) => d.value), backgroundColor: [theme.primary, theme.success, theme.warning, theme.info] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: theme.text } } }
    }
  });
}
