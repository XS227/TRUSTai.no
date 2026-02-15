import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

export const LEAD_STATUSES = ['open', 'meeting', 'offer_sent', 'approved', 'payout_requested', 'paid', 'lost'];
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
      status: 'approved',
      dealValue: 35000,
      value: 35000,
      commissionRate: 0.1,
      commissionAmount: 3500,
      commission: 3500,
      payoutStatus: 'paid',
      payoutDate: '2026-02-15T11:30:00.000Z',
      createdAt: '2026-02-01T09:00:00.000Z'
    },
    {
      id: 'lead-002',
      name: 'Ola Pedersen',
      company: 'TechNordic',
      email: 'ola@technordic.no',
      ambassadorId: 'AMB123',
      status: 'approved',
      dealValue: 0,
      value: 0,
      commissionRate: 0.1,
      commissionAmount: 0,
      commission: 0,
      payoutStatus: 'payout_requested',
      createdAt: '2026-02-03T09:00:00.000Z'
    },
    {
      id: 'lead-003',
      name: 'Lars Enger',
      company: 'WebFlow AS',
      email: 'lars@webflowas.no',
      ambassadorId: 'AMB987',
      status: 'meeting',
      dealValue: 0,
      commissionAmount: 0,
      createdAt: '2026-02-06T09:00:00.000Z'
    }
  ],
  payouts: [{ ambassadorId: 'AMB123', paidOut: 3500, paidAt: '2026-02-15T11:30:00.000Z' }],
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


export const payoutTrendSeries = [
  { month: 'Nov', available: 4200, paid: 1800 },
  { month: 'Des', available: 5100, paid: 2600 },
  { month: 'Jan', available: 6100, paid: 3500 },
  { month: 'Feb', available: 7300, paid: 4200 },
  { month: 'Mar', available: 6800, paid: 5100 },
  { month: 'Apr', available: 8200, paid: 6400 }
];

export const leadStageDistribution = [
  { label: 'Open', value: 12 },
  { label: 'Meeting', value: 7 },
  { label: 'Offer sent', value: 5 },
  { label: 'Approved', value: 4 }
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
  const approvedLeads = ambassadorLeads.filter((lead) => ['approved', 'payout_requested', 'paid'].includes(String(lead.status || '').toLowerCase()));
  const pipelineLeads = ambassadorLeads.filter((lead) => {
    const status = String(lead.status || '').toLowerCase();
    return !['approved', 'payout_requested', 'paid', 'lost'].includes(status);
  });
  const revenue = approvedLeads.reduce((sum, lead) => sum + Number(lead.dealValue || 0), 0);
  const rate = Number(ambassador?.commissionRate || 0);
  const earned = approvedLeads.reduce((sum, lead) => sum + Math.round(Number(lead.dealValue || 0) * rate), 0);

  approvedLeads.forEach((lead) => {
    lead.commissionAmount = Math.round(Number(lead.dealValue || 0) * rate);
  });

  const payoutBuckets = approvedLeads.reduce(
    (totals, lead) => {
      const commission = Number(lead.commissionAmount ?? lead.commission ?? 0);
      const payoutStatus = String(lead.payoutStatus || 'available').toLowerCase();
      if (payoutStatus === 'paid' || payoutStatus === 'locked') {
        totals.paid += commission;
      } else if (payoutStatus === 'payout_requested' || payoutStatus === 'pending') {
        totals.pending += commission;
      } else {
        totals.available += commission;
      }
      return totals;
    },
    { available: 0, pending: 0, paid: 0 }
  );

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
    available: payoutBuckets.available,
    pending: payoutBuckets.pending,
    paid: payoutBuckets.paid,
    unpaid: payoutBuckets.available + payoutBuckets.pending
  };
}

export function captureLeadCommission(lead) {
  const status = String(lead.status || '').toLowerCase();
  const isApproved = ['approved', 'payout_requested', 'paid'].includes(status);
  const value = Number(lead.value ?? lead.dealValue ?? 0);
  const commissionRate = Number(lead.commissionRate ?? 0.1);

  if (!isApproved) {
    return {
      ...lead,
      value: 0,
      dealValue: 0,
      commissionAmount: 0,
      commission: 0,
      payoutStatus: null,
      payoutDate: null
    };
  }

  const commission = Math.round(value * commissionRate);
  const payoutStatusMap = {
    approved: 'available',
    payout_requested: 'pending',
    paid: 'locked'
  };
  const leadPayoutStatus = String(lead.payoutStatus || '').toLowerCase();
  const payoutStatus = payoutStatusMap[leadPayoutStatus] || payoutStatusMap[status] || leadPayoutStatus || 'available';

  return {
    ...lead,
    value,
    dealValue: value,
    commissionRate,
    commission,
    commissionAmount: commission,
    payoutStatus
  };
}

export async function createLeadInStore(db, { name, company, email }) {
  const ambassadorId = localStorage.getItem('ambassadorRef');
  const normalizedCompany = String(company || '').trim().toLowerCase();

  if (normalizedCompany) {
    const duplicateQuery = query(collection(db, 'leads'), where('normalizedCompany', '==', normalizedCompany), limit(1));
    const duplicateSnapshot = await getDocs(duplicateQuery);
    if (!duplicateSnapshot.empty) {
      const existingLead = duplicateSnapshot.docs[0];
      return {
        id: existingLead.id,
        ...existingLead.data(),
        duplicate: true
      };
    }
  }

  const leadPayload = {
    name,
    company,
    normalizedCompany,
    email,
    ambassadorId: ambassadorId || null,
    status: 'open',
    value: 0,
    dealValue: 0,
    commissionRate: 0.1,
    commissionAmount: 0,
    commission: 0,
    // NOTE: Frontend-beregning er kun MVP. Flytt provisjonsberegning/validering til Cloud Function i produksjon.
    createdAt: serverTimestamp()
  };

  const leadRef = await addDoc(collection(db, 'leads'), leadPayload);
  return { id: leadRef.id, ...leadPayload, duplicate: false };
}

export async function updateLeadInStore(db, leadId, updates) {
  const computedLead = captureLeadCommission(updates);
  await updateDoc(doc(db, 'leads', leadId), computedLead);
  return computedLead;
}

export function subscribeToLeadsInStore(db, callback) {
  const leadsQuery = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
  return onSnapshot(leadsQuery, (snapshot) => {
    const leads = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data()
    }));
    callback(leads);
  });
}
