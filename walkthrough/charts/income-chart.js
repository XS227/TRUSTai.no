import { getChartTheme } from './theme.js';

function renderFallback(canvas, reason, analyticsSeries) {
  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;

  const totalRevenue = analyticsSeries.reduce((sum, item) => sum + item.revenue, 0);
  wrap.innerHTML = `<div class="chart-fallback"><p>${reason}</p><p>Totalt: ${new Intl.NumberFormat('nb-NO').format(totalRevenue)} kr</p></div>`;
}

export function initIncomeChart(analyticsSeries = []) {
  const canvas = document.querySelector('#incomeChart');
  if (!canvas) return;
  if (!window.Chart) return renderFallback(canvas, 'Chart.js utilgjengelig', analyticsSeries);
  if (!analyticsSeries.length) return renderFallback(canvas, 'Ingen datagrunnlag funnet.', analyticsSeries);

  const theme = getChartTheme();

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: analyticsSeries.map((d) => d.month),
      datasets: [{ label: 'Inntekt', data: analyticsSeries.map((d) => d.revenue), borderColor: theme.primary, backgroundColor: `${theme.primary}33`, fill: true, tension: 0.35, pointRadius: 3 }]
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
