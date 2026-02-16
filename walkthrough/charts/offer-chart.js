import { getChartTheme } from './theme.js';

function renderFallback(canvas, reason, analyticsSeries) {
  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;
  const totalOffers = analyticsSeries.reduce((sum, item) => sum + item.offerCount, 0);
  wrap.innerHTML = `<div class="chart-fallback"><p>${reason}</p><p>Tilbud totalt: ${totalOffers}</p></div>`;
}

export function initOfferChart(analyticsSeries = []) {
  const canvas = document.querySelector('#offerChart');
  if (!canvas) return;
  if (!window.Chart) return renderFallback(canvas, 'Chart.js utilgjengelig', analyticsSeries);
  if (!analyticsSeries.length) return renderFallback(canvas, 'Ingen datagrunnlag funnet.', analyticsSeries);

  const theme = getChartTheme();

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: analyticsSeries.map((d) => d.month),
      datasets: [{ label: 'Tilbud sendt', data: analyticsSeries.map((d) => d.offerCount), borderRadius: 8, backgroundColor: theme.success }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: theme.muted }, grid: { color: theme.border } },
        y: { ticks: { color: theme.muted }, grid: { color: theme.border }, beginAtZero: true }
      }
    }
  });
}
