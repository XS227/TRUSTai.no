import { initIncomeChart } from './income-chart.js';
import { initOfferChart } from './offer-chart.js';
import { initChannelChart } from './channel-chart.js';
import { initPayoutChart } from './payout-chart.js';
import { initLeadStageChart } from './lead-stage-chart.js';

let chartInstances = [];
let chartData = {
  analyticsSeries: [],
  revenueByChannel: [],
  payoutTrendSeries: [],
  leadStageDistribution: []
};

export function setAmbassadorChartData(nextData = {}) {
  chartData = {
    ...chartData,
    ...nextData
  };
}

export function initAmbassadorCharts() {
  chartInstances = [
    initIncomeChart(chartData.analyticsSeries),
    initOfferChart(chartData.analyticsSeries),
    initChannelChart(chartData.revenueByChannel),
    initPayoutChart(chartData.payoutTrendSeries),
    initLeadStageChart(chartData.leadStageDistribution)
  ].filter(Boolean);
  return chartInstances;
}

export function refreshAmbassadorCharts() {
  chartInstances.forEach((chart) => {
    if (typeof chart?.destroy === 'function') chart.destroy();
  });
  chartInstances = [];
  return initAmbassadorCharts();
}
