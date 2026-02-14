export const LEAD_STATUSES = ['open', 'meeting', 'offer_sent', 'approved', 'won', 'lost'];
export const AMBASSADOR_STATUSES = ['Pending', 'Active', 'Paused'];

export const demoDb = {
  userProfile: {
    id: 'user-01',
    fullName: 'Magnus Q',
    email: 'm.quaine@gmail.com',
    phone: '',
    provider: 'Google',
    avatarUrl: 'https://i.pravatar.cc/120?img=12',
    company: 'Animer AS'
  },
  ambassadors: [
    {
      id: 'AMB123',
      name: 'Magnus Q',
      email: 'm.quaine@gmail.com',
      status: 'Active',
      commissionRate: 0.1,
      createdAt: '2026-01-02T10:00:00.000Z'
    },
    {
      id: 'AMB987',
      name: 'Sara L',
      email: 'sara.l@email.no',
      status: 'Pending',
      commissionRate: 0.12,
      createdAt: '2026-01-18T12:00:00.000Z'
    }
  ],
  referralClicks: [],
  leads: [
    {
      id: 'lead-001',
      name: 'Eva Hansen',
      company: 'ABC Solutions',
      email: 'eva@abc.no',
      ambassadorId: 'AMB123',
      status: 'Won',
      dealValue: 35000,
      commissionAmount: 3500,
      createdAt: '2026-02-01T09:00:00.000Z'
    },
    {
      id: 'lead-002',
      name: 'Ola Pedersen',
      company: 'TechNordic',
      email: 'ola@technordic.no',
      ambassadorId: 'AMB123',
      status: 'Offer Sent',
      dealValue: 0,
      value: 0,
      commissionRate: 0.1,
      commissionAmount: 0,
      createdAt: '2026-02-03T09:00:00.000Z'
    },
    {
      id: 'lead-003',
      name: 'Lars Enger',
      company: 'WebFlow AS',
      email: 'lars@webflowas.no',
      ambassadorId: 'AMB987',
      status: 'Meeting',
      dealValue: 0,
      commissionAmount: 0,
      createdAt: '2026-02-06T09:00:00.000Z'
    }
  ],
  payouts: [{ ambassadorId: 'AMB123', paidOut: 5000 }],
  invoices: [],
  socialShares: []
};

export const analyticsSeries = [
  { month: 'Nov', revenue: 12000, offerCount: 4 },
  { month: 'Des', revenue: 18000, offerCount: 6 },
  { month: 'Jan', revenue: 26000, offerCount: 8 },
  { month: 'Feb', revenue: 32000, offerCount: 7 },
  { month: 'Mar', revenue: 28000, offerCount: 5 },
  { month: 'Apr', revenue: 35000, offerCount: 9 }
];

export const revenueByChannel = [
  { label: 'LinkedIn', value: 45 },
  { label: 'Facebook', value: 30 },
  { label: 'X/Twitter', value: 25 }
];

export function currency(value) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('nb-NO').format(new Date(value));
}

export function calculateAmbassadorTotals(ambassadorId) {
  const ambassador = demoDb.ambassadors.find((item) => item.id === ambassadorId);
  const ambassadorLeads = demoDb.leads.filter((lead) => lead.ambassadorId === ambassadorId);
  const wonLeads = ambassadorLeads.filter((lead) => lead.status === 'Won');
  const revenue = wonLeads.reduce((sum, lead) => sum + Number(lead.dealValue || 0), 0);
  const rate = Number(ambassador?.commissionRate || 0);
  const earned = wonLeads.reduce((sum, lead) => sum + Math.round(Number(lead.dealValue || 0) * rate), 0);

  wonLeads.forEach((lead) => {
    lead.commissionAmount = Math.round(Number(lead.dealValue || 0) * rate);
  });

  const paidOut = demoDb.payouts
    .filter((payout) => payout.ambassadorId === ambassadorId)
    .reduce((sum, payout) => sum + Number(payout.paidOut || 0), 0);

  return {
    leads: ambassadorLeads.length,
    won: approvedLeads.length,
    pipeline: pipelineLeads.length,
    revenue,
    earned,
    paidOut,
    available: earned - paidOut
  };
}
