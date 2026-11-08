export const mockCashflowSeries = {
  data: {
    currency: 'BRL',
    granularity: 'day',
    points: [
      { date: '2026-10-01', income: '8200.00', expenses: '1450.00', net: '6750.00', cumulative_net: '6750.00' },
      { date: '2026-10-02', income: '0.00', expenses: '212.40', net: '-212.40', cumulative_net: '6537.60' },
      { date: '2026-10-05', income: '500.00', expenses: '340.00', net: '160.00', cumulative_net: '6697.60' },
      { date: '2026-10-10', income: '0.00', expenses: '890.15', net: '-890.15', cumulative_net: '5807.45' },
      { date: '2026-10-15', income: '1200.00', expenses: '450.00', net: '750.00', cumulative_net: '6557.45' },
      { date: '2026-10-20', income: '0.00', expenses: '320.00', net: '-320.00', cumulative_net: '6237.45' },
      { date: '2026-10-25', income: '0.00', expenses: '280.00', net: '-280.00', cumulative_net: '5957.45' },
    ],
    totals: {
      income: '9900.00',
      expenses: '3942.55',
      net: '5957.45',
    },
  },
  meta: {
    as_of: '2026-10-25T22:00:00-03:00',
    is_stale: false,
    availability: 'AVAILABLE',
    partial: false,
    warnings: [],
    method: 'same_interval_3m_avg',
  },
  insight: 'Você gastou 12% menos que no mesmo período do mês passado.',
};
