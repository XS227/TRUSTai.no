export const demoDb = {
  leads: [
    { id: 1, company: 'Elkjøp', status: 'Tilbud sendt', value: 120000, commission: 10, ambassador: 'Mina N.', owner: 'Anne', priority: 'Høy' },
    { id: 2, company: 'Power Norge', status: 'Møte booket', value: 89000, commission: 10, ambassador: 'Mina N.', owner: 'Sander', priority: 'Middels' },
    { id: 3, company: 'XXL Sport', status: 'Godkjent', value: 150000, commission: 12, ambassador: 'Lars B.', owner: 'Anne', priority: 'Høy' },
    { id: 4, company: 'Bohus', status: 'Åpen', value: 74000, commission: 8, ambassador: 'Lars B.', owner: 'Espen', priority: 'Lav' }
  ],
  ambassadors: [
    { id: 1, name: 'Mina N.', status: 'Aktiv', inviteLimit: 30 },
    { id: 2, name: 'Lars B.', status: 'Pauset', inviteLimit: 12 },
    { id: 3, name: 'Hedda R.', status: 'Aktiv', inviteLimit: 20 }
  ],
  commissionLog: []
};

export const analyticsSeries = [
  { month: 'Jan', offerCount: 45, revenue: 12000, dealsWon: 6 },
  { month: 'Feb', offerCount: 60, revenue: 18000, dealsWon: 8 },
  { month: 'Mar', offerCount: 54, revenue: 16000, dealsWon: 7 },
  { month: 'Apr', offerCount: 71, revenue: 24000, dealsWon: 11 },
  { month: 'Mai', offerCount: 78, revenue: 28000, dealsWon: 14 },
  { month: 'Jun', offerCount: 82, revenue: 30000, dealsWon: 15 }
];

export const revenueByChannel = [
  { label: 'LinkedIn', value: 38 },
  { label: 'Direkte introduksjoner', value: 34 },
  { label: 'Ambassadørkampanjer', value: 28 }
];

export const currency = (value) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value);
