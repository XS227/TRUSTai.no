import { revenueByChannel } from '../data-store.js';

export function initChannelChart() {
  const canvas = document.querySelector('#channelChart');
  if (!canvas || !window.Chart) return;

  return new Chart(canvas, {
    type: 'pie',
    data: {
      labels: revenueByChannel.map((d) => d.label),
      datasets: [
        {
          label: 'Kanalandel',
          data: revenueByChannel.map((d) => d.value),
          backgroundColor: ['#2956f2', '#16a34a', '#f59e0b']
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}
