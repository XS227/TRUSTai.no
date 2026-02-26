import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

export const LEAD_STATUSES = ['open', 'meeting_booked', 'offer_sent', 'approved', 'rejected'];
export const AMBASSADOR_STATUSES = ['Pending', 'Active', 'Paused'];

export const demoDb = {
  userProfile: {
    id: null,
    fullName: '',
    email: '',
    phone: '',
    provider: '',
    avatarUrl: '',
    company: ''
  },
  ambassadors: [],
  referralClicks: [],
  leads: [],
  payouts: [],
  invoices: [],
  socialShares: []
};

export function subscribeToUsersInStore(db, callback) {
  const usersQuery = query(collection(db, 'users'));
  return onSnapshot(usersQuery, (snapshot) => {
    const users = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data()
    }));
    callback(users);
  });
}

export function normalizeLeadStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'open';
  if (normalized === 'new') return 'open';
  if (normalized === 'meeting' || normalized === 'contacted') return 'meeting_booked';
  if (normalized === 'payout_requested' || normalized === 'paid') return 'approved';
  if (normalized === 'lost') return 'rejected';
  return normalized;
}

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
  const approvedLeads = ambassadorLeads.filter((lead) => ['approved'].includes(normalizeLeadStatus(lead.status)));
  const pipelineLeads = ambassadorLeads.filter((lead) => {
    const status = normalizeLeadStatus(lead.status);
    return !['approved', 'rejected'].includes(status);
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
  const status = normalizeLeadStatus(lead.status);
  const isApproved = ['approved'].includes(status);
  const approvedAmount = Number(lead.approvedAmount ?? lead.offerAmount ?? lead.value ?? lead.dealValue ?? 0);
  const commissionPercent = Number(lead.commissionPercent ?? (Number(lead.commissionRate ?? 0.1) * 100));

  if (!isApproved) {
    return {
      ...lead,
      status,
      value: 0,
      dealValue: 0,
      approvedAmount: 0,
      commissionAmount: 0,
      commission: 0,
      payoutStatus: null,
      payoutDate: null
    };
  }

  const commission = Math.round(approvedAmount * (commissionPercent / 100));

  return {
    ...lead,
    status,
    value: approvedAmount,
    dealValue: approvedAmount,
    approvedAmount,
    commissionPercent,
    commissionRate: commissionPercent / 100,
    commission,
    commissionAmount: commission,
    payoutStatus: lead.payoutStatus || 'available'
  };
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export async function createLeadInStore(db, { name, company, email }) {
  const ambassadorRef = String(localStorage.getItem('ambassadorRef') || getCookie('ambassadorRef') || '').trim();
  let ambassadorId = ambassadorRef || null;
  let ambassadorCommissionRate = 0.1;

  if (ambassadorRef && /^amb[0-9a-z]+$/i.test(ambassadorRef)) {
    const ambassadorByReferralQuery = query(collection(db, 'ambassadors'), where('referralCode', '==', ambassadorRef.toLowerCase()), limit(1));
    const ambassadorByReferralSnapshot = await getDocs(ambassadorByReferralQuery);
    if (!ambassadorByReferralSnapshot.empty) {
      const ambassadorDoc = ambassadorByReferralSnapshot.docs[0];
      ambassadorId = ambassadorDoc.id;
      ambassadorCommissionRate = Number(ambassadorDoc.data()?.commissionRate || ambassadorCommissionRate);
    }
  } else if (ambassadorRef && ambassadorRef !== 'null') {
    const ambassadorDoc = await getDoc(doc(db, 'ambassadors', ambassadorRef));
    if (ambassadorDoc.exists()) {
      ambassadorId = ambassadorDoc.id;
      ambassadorCommissionRate = Number(ambassadorDoc.data()?.commissionRate || ambassadorCommissionRate);
    }
  }

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
    contactName: name,
    companyName: company,
    normalizedCompany,
    email,
    phone: '',
    ambassadorId: ambassadorId || null,
    referralCode: /^amb[0-9a-z]+$/i.test(ambassadorRef) ? ambassadorRef.toLowerCase() : null,
    source: 'direct',
    landingPage: 'training',
    status: 'open',
    offerAmount: 0,
    approvedAmount: 0,
    value: 0,
    dealValue: 0,
    commissionPercent: Math.round(ambassadorCommissionRate * 100),
    commissionRate: ambassadorCommissionRate,
    commissionAmount: 0,
    commission: 0,
    // NOTE: Frontend-beregning er kun MVP. Flytt provisjonsberegning/validering til Cloud Function i produksjon.
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
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

export function subscribeToAmbassadorsInStore(db, callback) {
  const ambassadorsQuery = query(collection(db, 'ambassadors'), orderBy('createdAt', 'desc'));
  return onSnapshot(ambassadorsQuery, (snapshot) => {
    const ambassadors = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data()
    }));
    callback(ambassadors);
  });
}
