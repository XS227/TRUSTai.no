export const LEAD_STATUSES = ['Open', 'Meeting', 'Offer Sent', 'Won', 'Lost'];
export const AMBASSADOR_STATUSES = ['Pending', 'Active', 'Paused'];

export const demoDb = {
  ambassadors: [
    {
      id: 'AMB123',
      name: 'Mina N.',
      email: 'mina@eksempel.no',
      status: 'Active',
      commissionRate: 0.1,
      createdAt: '2026-01-02T10:00:00.000Z'
    },
    {
      id: 'AMB987',
      name: 'Lars B.',
      email: 'lars@eksempel.no',
      status: 'Pending',
      commissionRate: 0.1,
      createdAt: '2026-01-18T12:00:00.000Z'
    }
  ],
  referralClicks: [],
  leads: [
    {
      id: 'lead-001',
      name: 'Kari Hansen',
      company: 'Elkjøp',
      email: 'kari@elkjop.no',
      ambassadorId: 'AMB123',
      status: 'Open',
      dealValue: 0,
      commissionAmount: 0,
      createdAt: '2026-02-01T09:00:00.000Z'
    },
    {
      id: 'lead-002',
      name: 'Nils Pedersen',
      company: 'Power Norge',
      email: 'nils@power.no',
      ambassadorId: null,
      status: 'Meeting',
      dealValue: 0,
      commissionAmount: 0,
      createdAt: '2026-02-03T09:00:00.000Z'
    },
    {
      id: 'lead-003',
      name: 'Sara Olsen',
      company: 'XXL Sport',
      email: 'sara@xxl.no',
      ambassadorId: 'AMB123',
      status: 'Won',
      dealValue: 120000,
      commissionAmount: 12000,
      createdAt: '2026-02-06T09:00:00.000Z'
    }
  ],
  payouts: [
    { ambassadorId: 'AMB123', paidOut: 5000 }
  ]
};

export function currency(value) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function calculateAmbassadorTotals(ambassadorId) {
  const ambassadorLeads = demoDb.leads.filter((lead) => lead.ambassadorId === ambassadorId);
  const wonLeads = ambassadorLeads.filter((lead) => lead.status === 'Won');
  const revenue = wonLeads.reduce((sum, lead) => sum + Number(lead.dealValue || 0), 0);
  const earned = wonLeads.reduce((sum, lead) => sum + Number(lead.commissionAmount || 0), 0);
  const paidOut = demoDb.payouts
    .filter((payout) => payout.ambassadorId === ambassadorId)
    .reduce((sum, payout) => sum + Number(payout.paidOut || 0), 0);

  return {
    leads: ambassadorLeads.length,
    won: wonLeads.length,
    revenue,
    earned,
    paidOut,
    available: earned - paidOut
  };
}
