import { analyticsSeries } from '../data-store.js';

export function initIncomeChart() {
  const canvas = document.querySelector('#incomeChart');
  if (!canvas || !window.Chart) return;

  const months = analyticsSeries.map((d) => d.month);
  const revenues = analyticsSeries.map((d) => d.revenue);

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Inntekt',
          data: revenues,
          borderColor: '#2956f2',
          backgroundColor: 'rgba(41, 86, 242, 0.16)',
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}
