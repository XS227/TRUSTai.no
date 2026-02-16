import { getChartTheme } from './theme.js';

function renderFallback(canvas, reason) {
  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="chart-fallback">${reason}</div>`;
}

export function initLeadStageChart(leadStageDistribution = []) {
  const canvas = document.querySelector('#leadStageChart');
  if (!canvas) return;
  if (!window.Chart) return renderFallback(canvas, 'Chart.js utilgjengelig');
  if (!leadStageDistribution.length) return renderFallback(canvas, 'Ingen datagrunnlag funnet.');

  const theme = getChartTheme();

  return new Chart(canvas, {
    type: 'polarArea',
    data: {
      labels: leadStageDistribution.map((item) => item.label),
      datasets: [
        {
          data: leadStageDistribution.map((item) => item.value),
          backgroundColor: [theme.primary, theme.info, theme.warning, theme.success]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: theme.text } } },
      scales: {
        r: {
          grid: { color: theme.border },
          angleLines: { color: theme.border },
          ticks: { color: theme.muted, backdropColor: 'transparent' }
        }
      }
    }
  });
}
