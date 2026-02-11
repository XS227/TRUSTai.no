import { analyticsSeries } from '../data-store.js';

export function initOfferChart() {
  const canvas = document.querySelector('#offerChart');
  if (!canvas || !window.Chart) return;

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: analyticsSeries.map((d) => d.month),
      datasets: [
        {
          label: 'Tilbud sendt',
          data: analyticsSeries.map((d) => d.offerCount),
          borderRadius: 8,
          backgroundColor: '#4f46e5'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}
