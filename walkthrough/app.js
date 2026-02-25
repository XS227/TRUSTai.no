import {
  AMBASSADOR_STATUSES,
  LEAD_STATUSES,
  calculateAmbassadorTotals,
  captureLeadCommission,
  createLeadInStore,
  currency,
  demoDb,
  formatDate,
  normalizeLeadStatus,
  subscribeToAmbassadorsInStore,
  subscribeToLeadsInStore,
  updateLeadInStore
} from './data-store.js';
import { initAmbassadorCharts, refreshAmbassadorCharts, setAmbassadorChartData } from './charts/index.js';
import { captureReferral } from './referral.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAuth, getIdTokenResult, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA9ESuWhXXsevI47cY_A0YijhAawC7s0Zs',
  authDomain: 'trustai-4dc55.firebaseapp.com',
  projectId: 'trustai-4dc55',
  storageBucket: 'trustai-4dc55.firebasestorage.app',
  messagingSenderId: '886529188680',
  appId: '1:886529188680:web:f8008930a08db98fba497d',
  measurementId: 'G-CL1RB3P1CC'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const authMessage = document.querySelector('#authMessage');
const REFERRAL_COOKIE_KEY = 'ref';
const DEFAULT_COMMISSION_RATE = 0.1;

const DEMO_ADMIN_USERNAME = 'Super';
const DEMO_ADMIN_PASSWORD = 'Admin';
const DEMO_ADMIN_SESSION_KEY = 'isDemoAdmin';

const DEMO_ADMIN_PROFILE = {
  id: 'demo-superadmin',
  fullName: 'Super',
  email: 'superadmin@demo.trustai',
  phone: '+47 99 99 99 99',
  provider: 'Demo credentials',
  avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=Super',
  company: 'TrustAi Demo'
};

const DEMO_ADMIN_AMBASSADORS = [
  { id: 'amb-nora', name: 'Nora Hansen', email: 'nora@trustai.no', commissionRate: 0.12, referralCode: 'ambnora', status: 'Active', createdAt: '2026-01-04T08:20:00.000Z' },
  { id: 'amb-jonas', name: 'Jonas Berg', email: 'jonas@trustai.no', commissionRate: 0.1, referralCode: 'ambjonas', status: 'Active', createdAt: '2026-01-03T10:05:00.000Z' },
  { id: 'amb-sara', name: 'Sara Eide', email: 'sara@trustai.no', commissionRate: 0.08, referralCode: 'ambsara', status: 'Pending', createdAt: '2026-01-02T07:30:00.000Z' }
];

const DEMO_ADMIN_LEADS = [
  { id: 'lead-2001', company: 'Nordic Dental', name: 'Mina Solberg', email: 'mina@nordicdental.no', ambassadorId: 'amb-nora', status: 'approved', value: 160000, dealValue: 160000, commissionRate: 0.12, payoutStatus: 'available', createdAt: '2026-01-12T09:00:00.000Z' },
  { id: 'lead-2002', company: 'Aurora Clinic', name: 'Lasse Vik', email: 'lasse@aurora.no', ambassadorId: 'amb-jonas', status: 'payout_requested', value: 110000, dealValue: 110000, commissionRate: 0.1, payoutStatus: 'pending', createdAt: '2026-01-13T12:45:00.000Z' },
  { id: 'lead-2003', company: 'Smile Lab', name: 'Ingrid N.', email: 'ingrid@smilelab.no', ambassadorId: 'amb-nora', status: 'paid', value: 98000, dealValue: 98000, commissionRate: 0.12, payoutStatus: 'paid', createdAt: '2026-01-05T11:15:00.000Z', payoutDate: '2026-01-25T00:00:00.000Z' },
  { id: 'lead-2004', company: 'City Physio', name: 'Adrian T.', email: 'adrian@cityphysio.no', ambassadorId: 'amb-sara', status: 'contacted', value: 0, dealValue: 0, commissionRate: 0.08, payoutStatus: null, createdAt: '2026-01-14T14:10:00.000Z' },
  { id: 'lead-2005', company: 'Opti Vision', name: 'Oda M.', email: 'oda@optivision.no', ambassadorId: 'amb-jonas', status: 'new', value: 0, dealValue: 0, commissionRate: 0.1, payoutStatus: null, createdAt: '2026-01-15T08:55:00.000Z' }
];

const DEMO_ADMIN_PAYOUTS = [
  { ambassadorId: 'amb-nora', paidOut: 11760, paidAt: '2026-01-25T00:00:00.000Z' }
];

const TRANSLATIONS = {
  nb: {
    authIn: 'Logg inn',
    authOut: 'Logg ut',
    google: 'Fortsett med Google',
    fb: 'Fortsett med Facebook',
    navLogin: 'Login / Onboarding',
    navAmbassador: 'Ambassador dashboard',
    navAdmin: 'Superadmin panel',
    navProfile: 'My profile',
    navPayout: 'Utbetalinger',
    navFlow: 'System flow'
  },
  en: {
    authIn: 'Log in',
    authOut: 'Log out',
    google: 'Continue with Google',
    fb: 'Continue with Facebook',
    navLogin: 'Login / Onboarding',
    navAmbassador: 'Ambassador dashboard',
    navAdmin: 'Admin panel',
    navProfile: 'My profile',
    navPayout: 'Payouts',
    navFlow: 'System flow'
  }
};

const adminState = {
  leadStatusFilter: 'all',
  ambassadorFilter: 'all',
  ambassadorStatusFilter: 'all',
  leadDateFrom: '',
  leadDateTo: '',
  incomeAmbassadorFilter: 'all',
  incomeStatusFilter: 'all',
  ticketStatusFilter: 'all',
  selectedLeadId: null,
  selectedAmbassadorId: null,
  selectedTicketId: null
};
const ADMIN_LEAD_STATUS_LABELS = {
  open: 'Åpent',
  meeting_booked: 'Møte',
  offer_sent: 'Tilbud sendt',
  approved: 'Godkjent',
  rejected: 'Avslag'
};
const ADMIN_AMBASSADOR_STATUS_LABELS = {
  Pending: 'Søknad',
  Active: 'Aktiv',
  Paused: 'Pauset',
  Terminated: 'Avsluttet'
};
const ADMIN_INCOME_STATUS = {
  draft: 'Ikke fakturert',
  invoice_received: 'Faktura mottatt',
  paid: 'Utbetalt'
};
const ambassadorState = { leadFilter: 'all', selectedSharePlatform: null };
const PROTECTED_PAGES = ['/ambassador.html', '/admin.html', '/profile.html', '/payout-support.html'];
const ADMIN_PAGE = '/admin.html';

const authState = {
  user: null,
  isAdmin: false
};


function isDemoAdminSession() {
  return localStorage.getItem(DEMO_ADMIN_SESSION_KEY) === 'true';
}

function seedDemoAdminContent() {
  demoDb.userProfile = { ...DEMO_ADMIN_PROFILE };
  demoDb.ambassadors = DEMO_ADMIN_AMBASSADORS.map((item) => ({
    ...item,
    companyName: item.name,
    organizationNumber: '',
    address: '',
    postalCode: '',
    city: '',
    contactPerson: item.name,
    invitesEnabled: false,
    secondTierRate: 0.03,
    notes: []
  }));
  demoDb.leads = DEMO_ADMIN_LEADS.map((lead) => captureLeadCommission({
    source: lead.source || 'linkedin',
    followUpAt: '',
    contactPhone: '',
    contactEmail: lead.email || '',
    comments: [],
    auditLog: [],
    ...lead
  }));
  demoDb.payouts = DEMO_ADMIN_PAYOUTS.map((item) => ({ ...item }));
  if (!Array.isArray(demoDb.shareTexts) || demoDb.shareTexts.length === 0) {
    demoDb.shareTexts = [
      { id: 'share-1', source: 'Linkedin post', title: 'Sjekk ut TrustAi', text: 'Jeg anbefaler TrustAi sitt ambassadørprogram.', traffic: 156, conversions: 11 },
      { id: 'share-2', source: 'Epost', title: 'Anbefaler TrustAi', text: 'Hei! Vi bruker TrustAi for å skape flere leads.', traffic: 72, conversions: 7 }
    ];
  }
  if (!Array.isArray(demoDb.tickets) || demoDb.tickets.length === 0) {
    demoDb.tickets = [
      { id: 41, ambassadorId: 'amb-nora', subject: 'Utbetaling', category: 'Utbetaling', status: 'ubesvart', messages: [{ from: 'ambassador', text: 'Når kommer utbetaling?', at: '2026-01-20T09:20:00.000Z' }] },
      { id: 42, ambassadorId: 'amb-jonas', subject: 'Lead-status', category: 'Leads', status: 'besvart', messages: [{ from: 'ambassador', text: 'Kan dere oppdatere lead-2002?', at: '2026-01-19T10:00:00.000Z' }, { from: 'admin', text: 'Ja, oppdatert nå.', at: '2026-01-19T11:10:00.000Z' }] }
    ];
  }
  if (!Array.isArray(demoDb.adminUsers) || demoDb.adminUsers.length === 0) {
    demoDb.adminUsers = [
      { id: 'u-1', name: 'Tor Martin Olsen', role: 'Super admin', email: 'tor@trustai.no', phone: '+47 90 11 22 33' },
      { id: 'u-2', name: 'Marthe Strøm', role: 'Regnskap', email: 'marthe@trustai.no', phone: '+47 90 44 55 66' }
    ];
  }
}

function activateDemoAdminSession() {
  localStorage.setItem(DEMO_ADMIN_SESSION_KEY, 'true');
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('isAdmin', 'true');
  seedDemoAdminContent();
  localStorage.setItem('ambassadorRef', demoDb.ambassadors[0]?.id || '');
  authState.user = {
    uid: DEMO_ADMIN_PROFILE.id,
    email: DEMO_ADMIN_PROFILE.email,
    displayName: DEMO_ADMIN_PROFILE.fullName
  };
  authState.isAdmin = true;
  hideProtectedNavigation(true, true);
  syncProfileUi();
  setLang(getCurrentLang());
  renderAdmin();
  renderAmbassadorDashboard();
  renderFlowPage();
}

function clearDemoAdminSession() {
  localStorage.removeItem(DEMO_ADMIN_SESSION_KEY);
}


function getLeadPayoutBucket(lead) {
  const status = normalizeLeadStatus(lead.status);
  const payoutStatus = String(lead.payoutStatus || '').toLowerCase();
  if (status !== 'approved' && status !== 'payout_requested' && status !== 'paid') return 'n/a';
  if (status === 'paid' || payoutStatus === 'paid' || payoutStatus === 'locked') return 'paid';
  if (status === 'payout_requested' || payoutStatus === 'payout_requested' || payoutStatus === 'pending') return 'pending';
  return 'available';
}

function payoutBadgeLabel(bucket) {
  if (bucket === 'available') return '<span class="badge ok">Available</span>';
  if (bucket === 'pending') return '<span class="badge pending">Pending</span>';
  if (bucket === 'paid') return '<span class="badge info">Paid</span>';
  return '<span class="badge">—</span>';
}

function setAuthMessage(message) {
  if (authMessage) authMessage.textContent = message;
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function initTheme() {
  const toggle = document.querySelector('#themeToggle');
  const root = document.body;
  const saved = localStorage.getItem('theme') || 'light';
  root.setAttribute('data-theme', saved);
  if (toggle) toggle.textContent = saved === 'dark' ? '☀️' : '🌙';

  toggle?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    toggle.textContent = next === 'dark' ? '☀️' : '🌙';
    refreshAmbassadorCharts();
  });
}

function getCurrentLang() {
  const fromQuery = new URLSearchParams(window.location.search).get('lang');
  if (fromQuery === 'en' || fromQuery === 'nb') return fromQuery;
  const stored = localStorage.getItem('lang');
  return stored === 'nb' ? 'nb' : 'en';
}

function setLang(lang) {
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  const t = TRANSLATIONS[lang];
  const google = document.querySelector('#loginGoogle');
  const facebook = document.querySelector('#loginFacebook');
  const authAction = document.querySelector('#authAction');
  const languageToggle = document.querySelector('#languageToggle');

  if (google) google.textContent = t.google;
  if (facebook) facebook.textContent = t.fb;
  if (authAction) {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    authAction.textContent = loggedIn ? t.authOut : t.authIn;
  }
  if (languageToggle) languageToggle.textContent = lang === 'en' ? '🇳🇴' : '🇬🇧';

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    const value = TRANSLATIONS[lang][key];
    if (value) node.textContent = value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    const value = TRANSLATIONS[lang][key];
    if (value) node.setAttribute('placeholder', value);
  });
}

function initLanguageToggle() {
  const languageToggle = document.querySelector('#languageToggle');
  if (!languageToggle) return;
  setLang(getCurrentLang());
  languageToggle.addEventListener('click', () => {
    const next = getCurrentLang() === 'nb' ? 'en' : 'nb';
    setLang(next);
  });
}

function hideProtectedNavigation(isLoggedIn, isAdminUser = false) {
  document.querySelectorAll('.auth-only').forEach((element) => {
    element.hidden = !isLoggedIn;
  });
  document.querySelectorAll('[data-i18n="navAdmin"]').forEach((element) => {
    if (element.tagName === 'A') {
      element.hidden = !isLoggedIn || !isAdminUser;
    }
  });
}

function enforcePageAccess(isLoggedIn, isAdminUser = false) {
  const path = window.location.pathname;
  const isProtectedPage = PROTECTED_PAGES.some((page) => path.endsWith(page));
  if (!isProtectedPage) return;
  if (!isLoggedIn) {
    window.location.replace('index.html?blocked=admin');
    return;
  }

  const isAdminPage = path.endsWith(ADMIN_PAGE);
  if (isAdminPage && !isAdminUser) {
    window.location.replace('index.html?blocked=admin-role');
  }
}

function normalizePath(path) {
  return String(path || '').replace(/\/+$/, '');
}

function getBasePath() {
  const fromModule = normalizePath(new URL('.', import.meta.url).pathname);
  if (fromModule) return fromModule;

  const normalizedPath = normalizePath(window.location.pathname);
  const walkthroughPath = normalizedPath.match(/^(.*?\/walkthrough)(?:\/|$)/i)?.[1];
  if (walkthroughPath) return walkthroughPath;

  const currentDirectory = normalizedPath.replace(/\/[^/]+$/, '');
  return currentDirectory || '';
}

function normalizeReferralCode(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalized) return '';
  return normalized.startsWith('amb') ? normalized : `amb${normalized.slice(0, 8)}`;
}

function getShortReferralCode(ambassadorId) {
  const source = String(ambassadorId || '').trim();
  if (!source) return 'amb123';
  const byExisting = normalizeReferralCode(source);
  if (byExisting.startsWith('amb')) return byExisting;
  return `amb${source.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`;
}

function getAmbassadorReferralLink(ambassadorId = 'amb123') {
  const basePath = getBasePath();
  const safeAmbassadorCode = encodeURIComponent(getShortReferralCode(ambassadorId));
  const target = encodeURIComponent(getDefaultReferralTarget());
  return `${window.location.origin}${basePath}/referral.html?ref=${safeAmbassadorCode}&target=${target}`;
}

function getDefaultReferralTarget() {
  return `${getBasePath()}/ambassador.html`.replace(/\/\//g, '/');
}

function redirectToAmbassadorDashboard() {
  if (!window.location.pathname.endsWith('/index.html') && !window.location.pathname.endsWith('/walkthrough/') && !window.location.pathname.endsWith('/walkthrough')) return;
  window.location.replace('ambassador.html');
}

function resolveCurrentAmbassadorId() {
  if (authState.user?.uid) return authState.user.uid;
  const ref = localStorage.getItem('ambassadorRef') || demoDb.ambassadors[0]?.id || '';
  return String(ref).trim();
}

async function isAdmin(user) {
  if (!user) return false;
  const token = await getIdTokenResult(user);
  const roles = Array.isArray(token.claims.roles) ? token.claims.roles : [];
  return Boolean(token.claims.admin || token.claims.isAdmin || roles.includes('admin'));
}

function hydrateUserFromAuth(user) {
  if (!user) return;
  demoDb.userProfile.fullName = user.displayName || demoDb.userProfile.fullName;
  demoDb.userProfile.email = user.email || demoDb.userProfile.email;
  demoDb.userProfile.avatarUrl = user.photoURL || demoDb.userProfile.avatarUrl;
  demoDb.userProfile.provider = 'Google';
}

function initAuthStateSync() {
  onAuthStateChanged(auth, async (user) => {
    if (isDemoAdminSession() && !user) {
      activateDemoAdminSession();
      setAuthMessage('Signed in as demo Superadmin.');
      return;
    }

    if (user) clearDemoAdminSession();

    const isLoggedIn = Boolean(user);
    const isAdminUser = isLoggedIn ? await isAdmin(user) : false;
    authState.user = user;
    authState.isAdmin = isAdminUser;
    localStorage.setItem('isLoggedIn', String(isLoggedIn));
    localStorage.setItem('isAdmin', String(isAdminUser));
    if (isLoggedIn) hydrateUserFromAuth(user);
    hideProtectedNavigation(isLoggedIn, isAdminUser);
    enforcePageAccess(isLoggedIn, isAdminUser);
    syncProfileUi();
    setLang(getCurrentLang());
    if (user?.email) {
      setAuthMessage(`Signed in as ${user.email}.`);
      redirectToAmbassadorDashboard();
    }
  });
}

function initAuthAction() {
  const authAction = document.querySelector('#authAction');
  const avatar = document.querySelector('#topbarAvatar');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const isAdminUser = localStorage.getItem('isAdmin') === 'true';
  const lang = getCurrentLang();
  const t = TRANSLATIONS[lang];

  if (avatar) avatar.src = demoDb.userProfile.avatarUrl;
  if (authAction) authAction.textContent = isLoggedIn ? t.authOut : t.authIn;
  hideProtectedNavigation(isLoggedIn, isAdminUser);
  enforcePageAccess(isLoggedIn, isAdminUser);

  authAction?.addEventListener('click', () => {
    const currentlyLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (currentlyLoggedIn && isDemoAdminSession()) {
      clearDemoAdminSession();
      localStorage.setItem('isLoggedIn', 'false');
      localStorage.setItem('isAdmin', 'false');
      authState.user = null;
      authState.isAdmin = false;
      setAuthMessage('Demo Superadmin is signed out.');
      window.location.replace('index.html');
      return;
    }

    if (currentlyLoggedIn) {
      signOut(auth).catch(() => {
        localStorage.setItem('isLoggedIn', 'false');
      });
      localStorage.setItem('isAdmin', 'false');
      setAuthMessage('You are signed out.');
      if (PROTECTED_PAGES.some((page) => window.location.pathname.endsWith(page))) {
        window.location.replace('index.html');
      }
      return;
    }

    if (window.location.pathname.endsWith('/index.html') || window.location.pathname.endsWith('/walkthrough/') || window.location.pathname.endsWith('/walkthrough')) {
      window.loginWithGoogle();
      return;
    }
    window.location.assign('index.html');
  });
}

function initNavbar() {
  const navToggle = document.querySelector('#navToggle');
  const sidebar = document.querySelector('.sidebar');
  if (!navToggle || !sidebar) return;
  navToggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}


function setBrandLogo() {
  document.querySelectorAll('.brand').forEach((brand) => {
    brand.innerHTML = '<img src="https://lirp.cdn-website.com/9ac63216/dms3rep/multi/opt/TrustAiLogo.webp-140w.png" alt="TrustAi logo" class="brand-logo" />';
  });
}

function getReferralFromPath(pathname) {
  const path = String(pathname || '');
  const legacy = path.match(/\/a\/([^/?#]+)/i);
  if (legacy?.[1]) return normalizeReferralCode(decodeURIComponent(legacy[1]));

  const shortCode = path.match(/\/(amb[0-9a-z]+)(?:\/|$|\?|#)/i);
  if (shortCode?.[1]) return normalizeReferralCode(decodeURIComponent(shortCode[1]));
  return null;
}

function trackReferralFromUrl() {
  const url = new URL(window.location.href);
  const ref = normalizeReferralCode(url.searchParams.get('ref') || getReferralFromPath(url.pathname) || '');
  const target = url.searchParams.get('target') || getDefaultReferralTarget();
  if (!ref) return;

  const existingRef = normalizeReferralCode(localStorage.getItem('ambassadorRef') || getCookie(REFERRAL_COOKIE_KEY) || '');
  const attributedRef = existingRef || ref;

  demoDb.referralClicks.push({ ambassadorId: ref, timestamp: new Date().toISOString(), userAgent: navigator.userAgent });
  if (!existingRef) {
    localStorage.setItem('ambassadorRef', attributedRef);
    setCookie(REFERRAL_COOKIE_KEY, attributedRef, 90);
  }
  window.location.replace(target);
}

async function ensureAmbassadorProfile(user) {
  const ambassadorRef = doc(db, 'ambassadors', user.uid);
  const ambassadorSnap = await getDoc(ambassadorRef);
  if (!ambassadorSnap.exists()) {
    await setDoc(ambassadorRef, {
      id: user.uid,
      name: user.displayName,
      email: user.email,
      status: 'pending',
      commissionRate: 0.1,
      referralCode: getShortReferralCode(user.uid),
      createdAt: serverTimestamp()
    });
  }
}

async function handleRedirectLoginResult() {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return;
    await ensureAmbassadorProfile(result.user);
    demoDb.userProfile.fullName = result.user.displayName || demoDb.userProfile.fullName;
    demoDb.userProfile.email = result.user.email || demoDb.userProfile.email;
    demoDb.userProfile.avatarUrl = result.user.photoURL || demoDb.userProfile.avatarUrl;
    setAuthMessage(`Signed in as ${result.user.email}`);
  } catch {
    // ignore on pages without auth flow
  }
}

window.loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await ensureAmbassadorProfile(result.user);
    demoDb.userProfile.fullName = result.user.displayName || demoDb.userProfile.fullName;
    demoDb.userProfile.email = result.user.email || demoDb.userProfile.email;
    demoDb.userProfile.provider = 'Google';
    demoDb.userProfile.avatarUrl = result.user.photoURL || demoDb.userProfile.avatarUrl;
    localStorage.setItem('isLoggedIn', 'true');
    hideProtectedNavigation(true);
    setAuthMessage(`Signed in as ${result.user.email}.`);
    syncProfileUi();
    setLang(getCurrentLang());
    window.location.assign('ambassador.html');
  } catch (error) {
    if (error?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return;
    }
    setAuthMessage('Innlogging feilet.');
  }
};

function loginWithFacebookDemo() {
  setAuthMessage('Facebook-innlogging er ikke aktivert i produksjon. Bruk Google.');
}

async function createLead({ name, company, email }) {
  const ambassadorId = localStorage.getItem('ambassadorRef') || getCookie(REFERRAL_COOKIE_KEY) || null;

  if (isDemoAdminSession()) {
    const localLead = captureLeadCommission({
      id: `lead-demo-${Date.now()}`,
      name,
      company,
      email,
      ambassadorId: ambassadorId || demoDb.ambassadors[0]?.id || null,
      status: 'new',
      value: 0,
      dealValue: 0,
      commissionRate: DEFAULT_COMMISSION_RATE,
      createdAt: new Date().toISOString()
    });
    demoDb.leads.unshift(localLead);
    renderAdmin();
    renderAmbassadorDashboard();
    return localLead;
  }
  if (ambassadorId) localStorage.setItem('ambassadorRef', ambassadorId);

  const lead = await createLeadInStore(db, { name, company, email });
  const localLead = captureLeadCommission({
    ...lead,
    ambassadorId: lead.ambassadorId || ambassadorId,
    commissionRate: lead.commissionRate ?? DEFAULT_COMMISSION_RATE,
    createdAt: new Date().toISOString()
  });

  if (!lead.duplicate) {
    demoDb.leads.unshift(localLead);
  }

  return localLead;
}

function autoRedirectAfterSubmit({ messageNode, target, delayMs = 1400, message }) {
  if (messageNode) {
    messageNode.textContent = message;
    messageNode.classList.add('form-success');
  }

  window.setTimeout(() => {
    window.location.assign(target);
  }, delayMs);
}


function initLandingPage() {
  const leadForm = document.querySelector('#leadForm');
  const leadMessage = document.querySelector('#leadMessage');
  const registerForm = document.querySelector('#registerForm');
  const registerMessage = document.querySelector('#registerMessage');
  const demoAdminForm = document.querySelector('#demoAdminLoginForm');
  const demoAdminMessage = document.querySelector('#demoAdminMessage');
  const demoAdminModal = document.querySelector('#demoAdminModal');
  const openDemoAdminModal = document.querySelector('#openDemoAdminModal');
  const closeDemoAdminModal = document.querySelector('#closeDemoAdminModal');

  if (new URLSearchParams(window.location.search).get('blocked') === 'admin') {
    setAuthMessage('Log in to access admin pages.');
  } else if (new URLSearchParams(window.location.search).get('blocked') === 'admin-role') {
    setAuthMessage('Your account is missing an admin claim. Set a custom claim (e.g. isAdmin/admin) and sign in again.');
  }

  openDemoAdminModal?.addEventListener('click', () => demoAdminModal?.classList.add('open'));
  closeDemoAdminModal?.addEventListener('click', () => demoAdminModal?.classList.remove('open'));
  demoAdminModal?.addEventListener('click', (event) => {
    if (event.target === demoAdminModal) demoAdminModal.classList.remove('open');
  });

  leadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(leadForm);
    try {
      const lead = await createLead({ name: formData.get('name'), company: formData.get('company'), email: formData.get('email') });
      if (leadMessage) {
        leadMessage.textContent = lead.duplicate
          ? `Lead already exists for ${lead.company}. Existing ambassador is kept.`
          : `Lead saved: ${lead.company}`;
      }
      leadForm.reset();

      if (!lead.duplicate) {
        autoRedirectAfterSubmit({
          messageNode: leadMessage,
          target: authState.isAdmin ? 'admin.html' : 'ambassador.html',
          message: `Lead saved: ${lead.company}. Redirecting you to the dashboard...`
        });
      }
    } catch {
      if (leadMessage) leadMessage.textContent = 'Could not save lead.';
    }
  });

  demoAdminForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(demoAdminForm);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '').trim();

    if (username !== DEMO_ADMIN_USERNAME || password !== DEMO_ADMIN_PASSWORD) {
      if (demoAdminMessage) demoAdminMessage.textContent = 'Invalid username or password.';
      return;
    }

    activateDemoAdminSession();
    if (demoAdminMessage) demoAdminMessage.textContent = 'Demo Superadmin activated. Redirecting to the admin panel...';
    window.location.assign('admin.html');
  });

  registerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    demoDb.userProfile.fullName = String(formData.get('fullName') || '');
    demoDb.userProfile.email = String(formData.get('email') || '');
    demoDb.userProfile.phone = String(formData.get('phone') || '');
    demoDb.userProfile.provider = 'Email';
    autoRedirectAfterSubmit({
      messageNode: registerMessage,
      target: 'ambassador.html',
      message: 'Account created locally for MVP. Redirecting...' 
    });
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('isAdmin', 'false');
    authState.user = {
      uid: demoDb.userProfile.email || `amb-${Date.now()}`,
      email: demoDb.userProfile.email,
      displayName: demoDb.userProfile.fullName
    };
    authState.isAdmin = false;
    hideProtectedNavigation(true, false);
    syncProfileUi();
    setLang(getCurrentLang());
  });
}

function getFilteredLeads() {
  return demoDb.leads.filter((lead) => {
    const statusOk = adminState.leadStatusFilter === 'all' || normalizeLeadStatus(lead.status) === adminState.leadStatusFilter;
    const ambassador = lead.ambassadorId || 'Unassigned';
    const ambassadorOk = adminState.ambassadorFilter === 'all' || ambassador === adminState.ambassadorFilter;
    const createdAt = lead.createdAt ? new Date(lead.createdAt).getTime() : 0;
    const fromOk = !adminState.leadDateFrom || createdAt >= new Date(adminState.leadDateFrom).getTime();
    const toOk = !adminState.leadDateTo || createdAt <= new Date(adminState.leadDateTo).getTime();
    return statusOk && ambassadorOk && fromOk && toOk;
  });
}

function getAdminStatusLabel(status) {
  return ADMIN_LEAD_STATUS_LABELS[normalizeLeadStatus(status)] || status;
}

function getAdminAmbassadorStatusLabel(status) {
  return ADMIN_AMBASSADOR_STATUS_LABELS[status] || status;
}

function getIncomeStatusLabel(status) {
  return ADMIN_INCOME_STATUS[status] || status;
}

function ensureLeadMeta(lead) {
  if (!Array.isArray(lead.comments)) lead.comments = [];
  if (!Array.isArray(lead.auditLog)) lead.auditLog = [];
  if (!lead.offerValue) lead.offerValue = Number(lead.offerAmount || lead.dealValue || 0);
}

function renderDashboardCards() {
  const totals = demoDb.leads.reduce((acc, lead) => {
    const status = normalizeLeadStatus(lead.status);
    const value = Number(lead.dealValue || lead.offerValue || 0);
    const commission = Number(lead.commissionAmount || 0);
    acc.total += 1;
    if (status === 'meeting_booked') acc.meetings += 1;
    if (status === 'offer_sent') acc.offers += 1;
    if (status === 'approved') {
      acc.revenue += value;
      const payout = String(lead.payoutStatus || 'available').toLowerCase();
      if (payout !== 'paid') acc.outstanding += commission;
    }
    return acc;
  }, { total: 0, meetings: 0, offers: 0, revenue: 0, outstanding: 0 });

  document.querySelector('#kpiTotalLeads')?.replaceChildren(document.createTextNode(String(totals.total)));
  document.querySelector('#kpiMeeting')?.replaceChildren(document.createTextNode(String(totals.meetings)));
  document.querySelector('#kpiOfferSent')?.replaceChildren(document.createTextNode(String(totals.offers)));
  document.querySelector('#kpiRevenue')?.replaceChildren(document.createTextNode(currency(totals.revenue)));
  document.querySelector('#kpiOutstanding')?.replaceChildren(document.createTextNode(currency(totals.outstanding)));
  document.querySelector('#kpiActiveAmbassadors')?.replaceChildren(document.createTextNode(String(demoDb.ambassadors.filter((a) => a.status === 'Active').length)));

  const buckets = ['open', 'meeting_booked', 'offer_sent', 'approved', 'rejected'].map((status) => {
    const leads = demoDb.leads.filter((lead) => normalizeLeadStatus(lead.status) === status);
    return { status, count: leads.length, value: leads.reduce((sum, lead) => sum + Number(lead.dealValue || lead.offerValue || 0), 0) };
  });

  const pipelineCards = document.querySelector('#pipelineCards');
  if (pipelineCards) {
    pipelineCards.innerHTML = buckets.map((bucket) => `
      <button class="pipeline-card" data-status="${bucket.status}">
        <span class="muted">${getAdminStatusLabel(bucket.status)}</span>
        <strong>${bucket.count}</strong>
        <span>${currency(bucket.value)}</span>
      </button>`).join('');
  }

  document.querySelector('#recentLeadsList').innerHTML = demoDb.leads.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,10)
    .map((lead)=>`<li><strong>${lead.company}</strong> · ${getAdminStatusLabel(lead.status)}</li>`).join('') || '<li class="muted">Ingen leads ennå.</li>';
  document.querySelector('#ambassadorApplicationsList').innerHTML = demoDb.ambassadors.filter((a)=>a.status==='Pending')
    .map((a)=>`<li><strong>${a.name}</strong> · ${a.email}</li>`).join('') || '<li class="muted">Ingen nye søknader.</li>';
  document.querySelector('#adminActivityList').innerHTML = `
    <li>Nye tickets: ${demoDb.tickets?.filter((t) => t.status === 'ubesvart').length || 0}</li>
    <li>Fakturaer til godkjenning: ${demoDb.payouts.filter((p) => p.status !== 'paid').length}</li>
    <li>Nye ambassadør-søknader: ${demoDb.ambassadors.filter((a) => a.status === 'Pending').length}</li>`;
}

function renderLeadDetailPanel() {
  const panel = document.querySelector('#leadDetailPanel');
  if (!panel) return;
  const lead = demoDb.leads.find((item) => item.id === adminState.selectedLeadId);
  if (!lead) {
    panel.innerHTML = '<h3>Lead-detalj</h3><p class="muted">Klikk på et lead for å se detaljer.</p>';
    return;
  }
  ensureLeadMeta(lead);
  const ambassador = demoDb.ambassadors.find((item) => item.id === lead.ambassadorId);
  panel.innerHTML = `
    <h3>${lead.company}</h3>
    <div class="form-grid two-columns">
      <label>Firmanavn<input id="leadCompany" value="${lead.company || ''}" /></label>
      <label>Kontaktperson<input id="leadContact" value="${lead.name || ''}" /></label>
      <label>Epost<input id="leadEmail" value="${lead.contactEmail || lead.email || ''}" /></label>
      <label>Telefon<input id="leadPhone" value="${lead.contactPhone || ''}" /></label>
      <label>Oppfølgingsdato<input id="leadFollowUp" type="datetime-local" value="${lead.followUpAt || ''}" /></label>
      <label>Status
        <select id="leadStatusSelect">${LEAD_STATUSES.map((statusItem) => `<option value="${statusItem}" ${statusItem === normalizeLeadStatus(lead.status) ? 'selected' : ''}>${getAdminStatusLabel(statusItem)}</option>`).join('')}</select>
      </label>
      <label>Pipeline-status
        <select id="leadPipelineSelect">${LEAD_STATUSES.map((statusItem) => `<option value="${statusItem}" ${statusItem === normalizeLeadStatus(lead.status) ? 'selected' : ''}>${getAdminStatusLabel(statusItem)}</option>`).join('')}</select>
      </label>
      <label>Tilbudssum<input type="number" min="0" id="leadDetailOffer" value="${Number(lead.offerValue || lead.dealValue || 0)}" /></label>
      <label>Provisjon %<input type="number" min="1" max="100" id="leadDetailCommission" value="${Math.round(Number(lead.commissionRate || DEFAULT_COMMISSION_RATE) * 100)}" /></label>
      <label>Provisjonsbeløp<input readonly value="${currency(lead.commissionAmount || 0)}" /></label>
      <label>Kilde<input readonly value="${lead.source || 'ukjent'}" /></label>
      <label>Lead-ID<input readonly value="${lead.id}" /></label>
      <label>Ambassadør<input readonly value="${ambassador?.name || lead.ambassadorId || 'Uten ambassadør'}" /></label>
    </div>
    <label>Intern notat / kommentar
      <textarea id="leadDetailComment" rows="3" placeholder="Kommentar ved endring (obligatorisk ved pipeline-endring)"></textarea>
    </label>
    <label><input type="checkbox" id="leadCommentVisible" /> Synlig for ambassadør</label>
    <div class="row-actions"><button class="btn-secondary" id="saveLeadDetail">Lagre detaljer</button><button class="btn-secondary" id="addLeadComment">Legg til kommentar</button></div>
    <h4>Intern historikk / endringslogg</h4>
    <ul class="simple-list">${lead.auditLog.map((item) => `<li>${formatDate(item.createdAt)} · ${item.text}</li>`).join('') || '<li class="muted">Ingen endringer logget.</li>'}</ul>`;
}

function renderTicketDetailPanel() {
  const panel = document.querySelector('#ticketDetailPanel');
  if (!panel) return;
  const ticket = (demoDb.tickets || []).find((item) => String(item.id) === String(adminState.selectedTicketId));
  if (!ticket) {
    panel.innerHTML = '<h3>Ticket-detalj</h3><p class="muted">Velg en ticket.</p>';
    return;
  }
  const ambassador = demoDb.ambassadors.find((item) => item.id === ticket.ambassadorId);
  panel.innerHTML = `<h3>Ticket #${ticket.id}</h3>
    <p class="muted">Ambassadør: ${ambassador?.name || ticket.ambassadorId}</p>
    <p class="muted">Kategori: ${ticket.category}</p>
    <p class="muted">Emne: ${ticket.subject}</p>
    <ul class="simple-list">${ticket.messages.map((m) => `<li><strong>${m.from === 'admin' ? 'Admin' : 'Ambassadør'}:</strong> ${m.text}</li>`).join('')}</ul>
    <textarea id="ticketReply" rows="3" placeholder="Svarmelding"></textarea>
    <div class="row-actions"><input id="ticketAttachment" placeholder="Vedlegg URL" /><button id="sendTicketReply" class="btn-secondary">Send</button></div>`;
}

function renderAdmin() {
  const leadBody = document.querySelector('#adminLeadBody');
  const ambassadorBody = document.querySelector('#adminAmbassadorBody');
  const payoutBody = document.querySelector('#adminPayoutBody');
  if (!leadBody || !ambassadorBody || !payoutBody) return;
  renderDashboardCards();

  const filteredLeads = getFilteredLeads();
  leadBody.innerHTML = filteredLeads.map((lead) => {
    ensureLeadMeta(lead);
    const ambassador = demoDb.ambassadors.find((item) => item.id === lead.ambassadorId);
    return `<tr><td><button class="link-btn open-lead-detail" data-id="${lead.id}">${lead.company}</button></td><td>${ambassador?.name || 'Uten ambassadør'}</td>
      <td><select class="lead-status-select" data-id="${lead.id}">${LEAD_STATUSES.map((statusItem) => `<option value="${statusItem}" ${statusItem === normalizeLeadStatus(lead.status) ? 'selected' : ''}>${getAdminStatusLabel(statusItem)}</option>`).join('')}</select></td>
      <td>${currency(lead.dealValue || lead.offerValue || 0)}</td><td>${currency(lead.commissionAmount || 0)}</td><td>${payoutBadgeLabel(getLeadPayoutBucket(lead))}</td><td><button class="btn-secondary open-lead-detail" data-id="${lead.id}">Velg</button></td></tr>`;
  }).join('');
  document.querySelector('#leadEmptyState').hidden = filteredLeads.length > 0;

  ambassadorBody.innerHTML = demoDb.ambassadors
    .filter((amb) => adminState.ambassadorStatusFilter === 'all' || amb.status === adminState.ambassadorStatusFilter)
    .map((ambassador) => {
      const totals = calculateAmbassadorTotals(ambassador.id);
      return `<tr><td>${ambassador.name}</td><td><select class="ambassador-status" data-id="${ambassador.id}">${['Pending','Active','Paused','Terminated'].map((s)=>`<option value="${s}" ${s===ambassador.status?'selected':''}>${getAdminAmbassadorStatusLabel(s)}</option>`).join('')}</select></td>
        <td>${totals.leads}</td><td>${currency(totals.revenue)}</td><td>${Math.round((ambassador.commissionRate || DEFAULT_COMMISSION_RATE) * 100)}%</td><td>${currency(totals.earned)}</td><td>${currency(totals.unpaid)}</td><td><button class="btn-secondary open-ambassador-detail" data-id="${ambassador.id}">Mer</button></td></tr>`;
    }).join('');

  const incomeRows = demoDb.leads
    .filter((lead) => normalizeLeadStatus(lead.status) === 'approved')
    .filter((lead) => adminState.incomeAmbassadorFilter === 'all' || lead.ambassadorId === adminState.incomeAmbassadorFilter)
    .filter((lead) => adminState.incomeStatusFilter === 'all' || String(lead.incomeStatus || 'draft') === adminState.incomeStatusFilter);
  document.querySelector('#adminIncomeBody').innerHTML = incomeRows.map((lead) => {
    const ambassador = demoDb.ambassadors.find((item) => item.id === lead.ambassadorId);
    const status = lead.incomeStatus || 'draft';
    return `<tr><td>${lead.company}</td><td>${ambassador?.name || lead.ambassadorId}</td><td>${currency(lead.dealValue)}</td><td>${currency(lead.commissionAmount)}</td><td><select class="income-status-select" data-id="${lead.id}">${Object.keys(ADMIN_INCOME_STATUS).map((item)=>`<option value="${item}" ${item===status?'selected':''}>${getIncomeStatusLabel(item)}</option>`).join('')}</select></td><td>${formatDate(lead.createdAt || new Date())}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="muted">Ingen inntekter for valgt filter.</td></tr>';

  payoutBody.innerHTML = demoDb.ambassadors.map((ambassador) => {
    const totals = calculateAmbassadorTotals(ambassador.id);
    const pendingPayout = demoDb.payouts.find((item) => item.ambassadorId === ambassador.id && item.status !== 'paid');
    return `<tr><td>${ambassador.name}</td><td>${currency(totals.available)}</td><td><input class="invoice-input" data-id="${ambassador.id}" placeholder="Lenke/PDF" value="${pendingPayout?.invoiceUrl || ''}" /></td>
      <td>${pendingPayout?.createdAt ? formatDate(pendingPayout.createdAt) : '—'}</td><td><button class="btn-secondary approve-payout" data-id="${ambassador.id}">Avvis</button><button class="btn-secondary mark-paid" data-id="${ambassador.id}">Utbetalt</button></td>
      <td>${pendingPayout?.paidAt ? formatDate(pendingPayout.paidAt) : '—'}</td><td>${pendingPayout?.status || 'Ingen'}</td></tr>`;
  }).join('');

  document.querySelector('#shareTextBody').innerHTML = (demoDb.shareTexts || []).map((item) => `<tr><td>${item.source}</td><td>${item.title}</td><td><button class="btn-secondary read-share" data-id="${item.id}">Les</button></td><td><button class="btn-secondary edit-share" data-id="${item.id}">Rediger</button></td><td>${item.traffic || 0}</td><td>${item.conversions || 0}</td></tr>`).join('');
  document.querySelector('#ticketBody').innerHTML = (demoDb.tickets || [])
    .filter((ticket) => adminState.ticketStatusFilter === 'all' || ticket.status === adminState.ticketStatusFilter)
    .map((ticket) => {
      const ambassador = demoDb.ambassadors.find((item) => item.id === ticket.ambassadorId);
      return `<tr><td>${ticket.id}</td><td>${ambassador?.name || ticket.ambassadorId}</td><td>${ticket.subject}</td><td>${ticket.status}</td><td><button class="btn-secondary open-ticket-detail" data-id="${ticket.id}">Mer</button></td></tr>`;
    }).join('');
  document.querySelector('#adminUsersBody').innerHTML = (demoDb.adminUsers || []).map((user) => `<tr><td>${user.name}<br/><span class="muted">${user.email}</span></td><td>${user.role}</td><td><button class="btn-secondary">Endre</button></td></tr>`).join('');

  renderLeadDetailPanel();
  renderTicketDetailPanel();
  renderFlowPage();
}

function recalculateLeadCommission(lead) {
  const recalculated = captureLeadCommission({ ...lead, commissionRate: Number(lead.commissionRate ?? DEFAULT_COMMISSION_RATE) });
  Object.assign(lead, recalculated);
}

function initAdminPage() {
  const leadBody = document.querySelector('#adminLeadBody');
  const ambassadorBody = document.querySelector('#adminAmbassadorBody');
  const payoutBody = document.querySelector('#adminPayoutBody');
  const pipelineCards = document.querySelector('#pipelineCards');
  const detailPanel = document.querySelector('#leadDetailPanel');
  if (!leadBody || !ambassadorBody || !payoutBody) return;

  const leadStatusFilter = document.querySelector('#leadStatusFilter');
  const leadAmbassadorFilter = document.querySelector('#leadAmbassadorFilter');
  const leadDateFrom = document.querySelector('#leadDateFrom');
  const leadDateTo = document.querySelector('#leadDateTo');
  const ambassadorStatusFilter = document.querySelector('#ambassadorStatusFilter');
  const incomeAmbassadorFilter = document.querySelector('#incomeAmbassadorFilter');
  const incomeStatusFilter = document.querySelector('#incomeStatusFilter');
  const ticketStatusFilter = document.querySelector('#ticketStatusFilter');

  if (leadStatusFilter) leadStatusFilter.innerHTML = `<option value="all">Status</option>${LEAD_STATUSES.map((status) => `<option value="${status}">${getAdminStatusLabel(status)}</option>`).join('')}`;
  if (leadAmbassadorFilter) {
    const options = ['all', ...new Set(demoDb.leads.map((lead) => lead.ambassadorId || 'Unassigned'))];
    leadAmbassadorFilter.innerHTML = options.map((value) => `<option value="${value}">${value === 'all' ? 'Ambassadør' : value}</option>`).join('');
  }
  if (ambassadorStatusFilter) ambassadorStatusFilter.innerHTML = `<option value="all">Alle statuser</option>${['Pending', 'Active', 'Paused', 'Terminated'].map((status) => `<option value="${status}">${getAdminAmbassadorStatusLabel(status)}</option>`).join('')}`;
  if (incomeAmbassadorFilter) incomeAmbassadorFilter.innerHTML = `<option value="all">Ambassadør</option>${demoDb.ambassadors.map((item) => `<option value="${item.id}">${item.name}</option>`).join('')}`;
  if (incomeStatusFilter) incomeStatusFilter.innerHTML = `<option value="all">Status</option>${Object.keys(ADMIN_INCOME_STATUS).map((status) => `<option value="${status}">${getIncomeStatusLabel(status)}</option>`).join('')}`;
  if (ticketStatusFilter) ticketStatusFilter.innerHTML = `<option value="all">Alle</option><option value="ubesvart">Ubesvarte</option><option value="besvart">Besvarte</option><option value="avsluttet">Avsluttede</option>`;

  renderAdmin();

  document.querySelector('#adminKpiCards')?.addEventListener('click', (event) => {
    const card = event.target.closest('.kpi-filter-card');
    if (!card) return;
    adminState.leadStatusFilter = card.dataset.filter;
    if (leadStatusFilter) leadStatusFilter.value = card.dataset.filter;
    renderAdmin();
  });
  leadStatusFilter?.addEventListener('change', (event) => { adminState.leadStatusFilter = event.target.value; renderAdmin(); });
  leadAmbassadorFilter?.addEventListener('change', (event) => { adminState.ambassadorFilter = event.target.value; renderAdmin(); });
  leadDateFrom?.addEventListener('change', (event) => { adminState.leadDateFrom = event.target.value; renderAdmin(); });
  leadDateTo?.addEventListener('change', (event) => { adminState.leadDateTo = event.target.value; renderAdmin(); });
  ambassadorStatusFilter?.addEventListener('change', (event) => { adminState.ambassadorStatusFilter = event.target.value; renderAdmin(); });
  incomeAmbassadorFilter?.addEventListener('change', (event) => { adminState.incomeAmbassadorFilter = event.target.value; renderAdmin(); });
  incomeStatusFilter?.addEventListener('change', (event) => { adminState.incomeStatusFilter = event.target.value; renderAdmin(); });
  ticketStatusFilter?.addEventListener('change', (event) => { adminState.ticketStatusFilter = event.target.value; renderAdmin(); });

  leadBody.addEventListener('click', (event) => {
    const button = event.target.closest('.open-lead-detail');
    if (!button) return;
    adminState.selectedLeadId = button.dataset.id;
    renderLeadDetailPanel();
  });
  leadBody.addEventListener('change', (event) => {
    const statusSelect = event.target.closest('.lead-status-select');
    if (!statusSelect) return;
    const lead = demoDb.leads.find((item) => item.id === statusSelect.dataset.id);
    if (!lead) return;
    lead.status = statusSelect.value;
    recalculateLeadCommission(lead);
    renderAdmin();
  });

  ambassadorBody.addEventListener('change', (event) => {
    const statusSelect = event.target.closest('.ambassador-status');
    if (!statusSelect) return;
    const ambassador = demoDb.ambassadors.find((item) => item.id === statusSelect.dataset.id);
    if (!ambassador) return;
    ambassador.status = statusSelect.value;
    renderAdmin();
  });
  ambassadorBody.addEventListener('click', (event) => {
    const button = event.target.closest('.open-ambassador-detail');
    if (!button || !detailPanel) return;
    adminState.selectedAmbassadorId = button.dataset.id;
    const ambassador = demoDb.ambassadors.find((item) => item.id === button.dataset.id);
    if (!ambassador) return;
    const totals = calculateAmbassadorTotals(ambassador.id);
    detailPanel.innerHTML = `<h3>${ambassador.name}</h3><p class="muted">Ambassadør-ID: ${ambassador.id}</p><p class="muted">Dato registrert: ${formatDate(ambassador.createdAt || new Date())}</p>
      <div class="form-grid two-columns"><label>Epost<input value="${ambassador.email || ''}" /></label><label>Telefon<input value="${ambassador.phone || ''}" /></label><label>Firmanavn<input value="${ambassador.companyName || ''}" /></label><label>Org.nr<input value="${ambassador.organizationNumber || ''}" /></label><label>Adresse<input value="${ambassador.address || ''}" /></label><label>Postnr<input value="${ambassador.postalCode || ''}" /></label></div>
      <p class="muted">Leads generert: ${totals.leads} · Møte booket: ${demoDb.leads.filter((lead) => lead.ambassadorId === ambassador.id && normalizeLeadStatus(lead.status) === 'meeting_booked').length}</p>
      <p class="muted">Antall tilbud sendt: ${demoDb.leads.filter((lead) => lead.ambassadorId === ambassador.id && normalizeLeadStatus(lead.status) === 'offer_sent').length} · Total omsetning: ${currency(totals.revenue)}</p>
      <label>Second-tier provisjon %<input id="ambassadorSecondTier" type="number" value="${Math.round(Number(ambassador.secondTierRate || 0.03) * 100)}" /></label>
      <label>Notat (kun superadmin)<textarea id="ambassadorPrivateNote" rows="2"></textarea></label><button class="btn-secondary" id="saveAmbassadorCommission">Lagre ambassadør</button>`;
  });

  payoutBody.addEventListener('click', (event) => {
    const approveButton = event.target.closest('.approve-payout');
    const paidButton = event.target.closest('.mark-paid');
    if (approveButton) {
      const ambassadorId = approveButton.dataset.id;
      const invoiceInput = payoutBody.querySelector(`.invoice-input[data-id="${ambassadorId}"]`);
      demoDb.payouts.push({ id: `payout-${Date.now()}`, ambassadorId, amount: calculateAmbassadorTotals(ambassadorId).available, invoiceUrl: invoiceInput?.value || '', status: 'avvist', createdAt: new Date().toISOString() });
      renderAdmin();
    }
    if (paidButton) {
      const ambassadorId = paidButton.dataset.id;
      demoDb.payouts.push({ id: `payout-paid-${Date.now()}`, ambassadorId, amount: calculateAmbassadorTotals(ambassadorId).available, status: 'paid', createdAt: new Date().toISOString(), paidAt: new Date().toISOString() });
      demoDb.leads.filter((lead) => lead.ambassadorId === ambassadorId).forEach((lead) => { if (normalizeLeadStatus(lead.status) === 'approved') lead.payoutStatus = 'paid'; });
      renderAdmin();
    }
  });

  document.querySelector('#adminIncomeBody')?.addEventListener('change', (event) => {
    const select = event.target.closest('.income-status-select');
    if (!select) return;
    const lead = demoDb.leads.find((item) => item.id === select.dataset.id);
    if (!lead) return;
    lead.incomeStatus = select.value;
    renderAdmin();
  });
  document.querySelector('#ticketBody')?.addEventListener('click', (event) => {
    const button = event.target.closest('.open-ticket-detail');
    if (!button) return;
    adminState.selectedTicketId = button.dataset.id;
    renderTicketDetailPanel();
  });
  document.querySelector('#ticketDetailPanel')?.addEventListener('click', (event) => {
    const send = event.target.closest('#sendTicketReply');
    if (!send) return;
    const ticket = (demoDb.tickets || []).find((item) => String(item.id) === String(adminState.selectedTicketId));
    const text = String(document.querySelector('#ticketReply')?.value || '').trim();
    if (!ticket || !text) return;
    ticket.messages.push({ from: 'admin', text, at: new Date().toISOString() });
    ticket.status = 'besvart';
    renderAdmin();
  });
  document.querySelector('#newShareTextBtn')?.addEventListener('click', () => {
    const title = prompt('Tittel for delingstekst');
    if (!title) return;
    demoDb.shareTexts.push({ id: `share-${Date.now()}`, source: 'Annet', title, text: 'Ny tekst', traffic: 0, conversions: 0 });
    renderAdmin();
  });

  detailPanel?.addEventListener('click', (event) => {
    const saveLeadDetailButton = event.target.closest('#saveLeadDetail');
    const addCommentButton = event.target.closest('#addLeadComment');
    if (saveLeadDetailButton) {
      const lead = demoDb.leads.find((item) => item.id === adminState.selectedLeadId);
      if (!lead) return;
      const previousStatus = normalizeLeadStatus(lead.status);
      lead.company = String(detailPanel.querySelector('#leadCompany')?.value || lead.company);
      lead.name = String(detailPanel.querySelector('#leadContact')?.value || lead.name);
      lead.contactEmail = String(detailPanel.querySelector('#leadEmail')?.value || lead.contactEmail || '');
      lead.contactPhone = String(detailPanel.querySelector('#leadPhone')?.value || lead.contactPhone || '');
      lead.followUpAt = String(detailPanel.querySelector('#leadFollowUp')?.value || '');
      lead.status = String(detailPanel.querySelector('#leadStatusSelect')?.value || lead.status);
      lead.offerValue = Number(detailPanel.querySelector('#leadDetailOffer')?.value || 0);
      lead.commissionRate = Math.max(0.01, Math.min(1, Number(detailPanel.querySelector('#leadDetailCommission')?.value || 10) / 100));
      recalculateLeadCommission(lead);
      if (previousStatus !== normalizeLeadStatus(lead.status)) {
        lead.auditLog.unshift({ createdAt: new Date().toISOString(), text: `Pipeline endret fra ${getAdminStatusLabel(previousStatus)} til ${getAdminStatusLabel(lead.status)}` });
      }
      renderAdmin();
    }
    if (addCommentButton) {
      const lead = demoDb.leads.find((item) => item.id === adminState.selectedLeadId);
      const text = String(detailPanel.querySelector('#leadDetailComment')?.value || '').trim();
      const visible = Boolean(detailPanel.querySelector('#leadCommentVisible')?.checked);
      if (!lead || !text) return;
      ensureLeadMeta(lead);
      lead.comments.unshift({ text, createdAt: new Date().toISOString(), visibleForAmbassador: visible });
      lead.auditLog.unshift({ createdAt: new Date().toISOString(), text: `${visible ? '[Synlig]' : '[Intern]'} ${text}` });
      renderLeadDetailPanel();
    }
  });

  pipelineCards?.addEventListener('click', (event) => {
    const card = event.target.closest('.pipeline-card');
    if (!card) return;
    adminState.leadStatusFilter = card.dataset.status;
    if (leadStatusFilter) leadStatusFilter.value = card.dataset.status;
    renderAdmin();
  });
}

function getAmbassadorLeads(ambassadorId) {
  const leads = demoDb.leads.filter((lead) => lead.ambassadorId === ambassadorId);
  if (ambassadorState.leadFilter === 'all') return leads;
  return leads.filter((lead) => lead.status === ambassadorState.leadFilter);
}

function renderAmbassadorDashboard() {
  const ambassadorId = resolveCurrentAmbassadorId();
  const leads = getAmbassadorLeads(ambassadorId);
  const totals = calculateAmbassadorTotals(ambassadorId);

  const leadList = document.querySelector('#leadList');
  if (!leadList) return;

  document.querySelector('#welcomeName')?.replaceChildren(document.createTextNode(demoDb.userProfile.fullName));
  document.querySelector('#metricLeads')?.replaceChildren(document.createTextNode(String(totals.leads)));
  document.querySelector('#metricWon')?.replaceChildren(document.createTextNode(String(totals.won)));
  document.querySelector('#metricCommission')?.replaceChildren(document.createTextNode(currency(totals.earned)));
  document.querySelector('#metricAvailable')?.replaceChildren(document.createTextNode(currency(totals.available)));

  leadList.innerHTML = leads.map((lead) => `<tr><td>${lead.company}</td><td>${lead.name}</td><td>${lead.status}</td><td>${currency(lead.dealValue)}</td><td>${currency(lead.commissionAmount)}</td></tr>`).join('');
  const emptyState = document.querySelector('#ambassadorEmptyState');
  if (emptyState) emptyState.hidden = leads.length > 0;
  renderFlowPage();
}

function initAmbassadorTabs() {
  const tabs = document.querySelector('#ambassadorLeadTabs');
  if (!tabs) return;
  tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab-btn');
    if (!tab) return;
    ambassadorState.leadFilter = tab.dataset.filter;
    tabs.querySelectorAll('.tab-btn').forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    renderAmbassadorDashboard();
    renderFlowPage();
  });
}

function initShareFlow() {
  const iconContainer = document.querySelector('.social-icons');
  const modal = document.querySelector('#shareModalBackdrop');
  const platformLabel = document.querySelector('#sharePlatformLabel');
  const textInput = document.querySelector('#shareText');
  const message = document.querySelector('#shareMessage');
  if (!iconContainer || !modal) return;

  iconContainer.addEventListener('click', (event) => {
    const button = event.target.closest('.social-icon');
    if (!button) return;
    ambassadorState.selectedSharePlatform = button.dataset.platform;
    if (platformLabel) platformLabel.textContent = `Plattform: ${ambassadorState.selectedSharePlatform}`;
    modal.classList.add('open');
  });

  document.querySelector('#closeShareModal')?.addEventListener('click', () => modal.classList.remove('open'));
  document.querySelector('#saveShareModal')?.addEventListener('click', () => {
    const platform = ambassadorState.selectedSharePlatform;
    if (!platform) return;
    const text = encodeURIComponent(String(textInput?.value || 'Sjekk TrustAi!'));
    const target = encodeURIComponent(getAmbassadorReferralLink(resolveCurrentAmbassadorId()));
    const map = {
      LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${target}`,
      Facebook: `https://www.facebook.com/sharer/sharer.php?u=${target}`,
      X: `https://twitter.com/intent/tweet?text=${text}&url=${target}`
    };
    const url = map[platform];
    demoDb.socialShares.push({ platform, text: String(textInput?.value || ''), url, createdAt: new Date().toISOString() });
    window.open(url, '_blank', 'noopener');
    if (message) message.textContent = `Delingslenke opprettet for ${platform}.`;
    if (textInput) textInput.value = '';
    modal.classList.remove('open');
  });

  document.querySelector('#copyLink')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(getAmbassadorReferralLink(resolveCurrentAmbassadorId()));
    if (message) message.textContent = 'Lenke kopiert.';
  });
}

function syncProfileUi() {
  const avatar = document.querySelector('#profileAvatar');
  const name = document.querySelector('#profileName');
  const provider = document.querySelector('#profileProvider');
  const fullName = document.querySelector('#profileFullName');
  const email = document.querySelector('#profileEmail');
  const phone = document.querySelector('#profilePhone');
  const company = document.querySelector('#profileCompany');
  const topAvatar = document.querySelector('#topbarAvatar');

  if (topAvatar) {
    topAvatar.src = demoDb.userProfile.avatarUrl;
    topAvatar.style.cursor = 'pointer';
    topAvatar.title = 'Open my profile';
    topAvatar.onclick = () => window.location.assign('profile.html');
  }
  if (avatar) avatar.src = demoDb.userProfile.avatarUrl;
  if (name) name.textContent = demoDb.userProfile.fullName;
  if (provider) provider.textContent = `Signed in with ${demoDb.userProfile.provider}`;
  if (fullName) fullName.value = demoDb.userProfile.fullName;
  if (email) email.value = demoDb.userProfile.email;
  if (phone) phone.value = demoDb.userProfile.phone;
  if (company) company.value = demoDb.userProfile.company;
}

function initProfilePage() {
  const form = document.querySelector('#profileForm');
  if (!form) return;

  syncProfileUi();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    demoDb.userProfile.fullName = String(document.querySelector('#profileFullName')?.value || '');
    demoDb.userProfile.email = String(document.querySelector('#profileEmail')?.value || '');
    demoDb.userProfile.phone = String(document.querySelector('#profilePhone')?.value || '');
    demoDb.userProfile.company = String(document.querySelector('#profileCompany')?.value || '');
    document.querySelector('#profileMessage').textContent = 'Profile updated.';
    syncProfileUi();
  });
}

function initInvoicePage() {
  const form = document.querySelector('#invoiceForm');
  const body = document.querySelector('#invoiceTableBody');
  const empty = document.querySelector('#invoiceEmptyState');
  const message = document.querySelector('#invoiceMessage');
  if (!form || !body || !empty) return;

  const render = () => {
    body.innerHTML = demoDb.invoices.map((invoice) => `<tr><td>${invoice.number}</td><td>${currency(invoice.amount)}</td><td>${invoice.fileName}</td><td>${formatDate(invoice.createdAt)}</td></tr>`).join('');
    empty.hidden = demoDb.invoices.length > 0;
  };

  render();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const file = data.get('invoiceFile');
    demoDb.invoices.unshift({
      number: String(data.get('invoiceNumber') || ''),
      amount: Number(data.get('amount') || 0),
      fileName: file?.name || 'no-file-name',
      createdAt: new Date().toISOString()
    });
    render();
    message.textContent = 'Invoice uploaded (local MVP demo).';
    form.reset();
  });
}


function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildChartData(leads = []) {
  const monthFormatter = new Intl.DateTimeFormat('nb-NO', { month: 'short' });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      month: monthFormatter.format(date).replace('.', ''),
      revenue: 0,
      offerCount: 0,
      available: 0,
      paid: 0
    };
  });
  const monthMap = new Map(months.map((item) => [item.key, item]));

  const stageCounters = { New: 0, Contacted: 0, Approved: 0, Rejected: 0 };
  const channelCounters = new Map();

  leads.forEach((lead) => {
    const createdAt = toDate(lead.createdAt) || new Date();
    const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    const monthBucket = monthMap.get(monthKey);
    const status = normalizeLeadStatus(lead.status);
    const value = Number(lead.dealValue ?? lead.value ?? 0);
    const commission = Number(lead.commissionAmount ?? lead.commission ?? Math.round(value * Number(lead.commissionRate || DEFAULT_COMMISSION_RATE)));

    if (monthBucket && ['approved', 'payout_requested', 'paid'].includes(status)) {
      monthBucket.revenue += value;
    }
    if (monthBucket && ['contacted', 'approved', 'payout_requested', 'paid'].includes(status)) {
      monthBucket.offerCount += 1;
    }

    if (status === 'new') stageCounters.New += 1;
    else if (status === 'contacted') stageCounters.Contacted += 1;
    else if (['approved', 'payout_requested', 'paid'].includes(status)) stageCounters.Approved += 1;
    else if (status === 'rejected') stageCounters.Rejected += 1;

    const channelLabel = String(lead.channel || lead.source || 'Ukjent').trim() || 'Ukjent';
    channelCounters.set(channelLabel, (channelCounters.get(channelLabel) || 0) + 1);

    if (monthBucket) {
      const payoutStatus = String(lead.payoutStatus || '').toLowerCase();
      if (status === 'paid' || payoutStatus === 'paid' || payoutStatus === 'locked') monthBucket.paid += commission;
      if (status === 'approved' || payoutStatus === 'available') monthBucket.available += commission;
    }
  });

  const analyticsSeries = months.map(({ month, revenue, offerCount }) => ({ month, revenue, offerCount }));
  const payoutTrendSeries = months.map(({ month, available, paid }) => ({ month, available, paid }));
  const leadStageDistribution = Object.entries(stageCounters).map(([label, value]) => ({ label, value })).filter((item) => item.value > 0);
  const revenueByChannel = [...channelCounters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, value]) => ({ label, value }));

  return { analyticsSeries, payoutTrendSeries, leadStageDistribution, revenueByChannel };
}


function renderFlowPage() {
  const uidNode = document.querySelector('#flowAuthUid');
  const ambassadorNode = document.querySelector('#flowAmbassadorStatus');
  const referralNode = document.querySelector('#flowReferralCode');
  const leadNode = document.querySelector('#flowLeadCount');
  const approvedNode = document.querySelector('#flowApprovedCount');
  const pendingNode = document.querySelector('#flowPendingPayout');
  const paidNode = document.querySelector('#flowPaidTotal');
  const timelineNode = document.querySelector('#flowTimeline');
  if (!uidNode && !ambassadorNode && !referralNode && !leadNode && !approvedNode && !pendingNode && !paidNode && !timelineNode) return;

  const ambassadorId = resolveCurrentAmbassadorId();
  const ambassador = demoDb.ambassadors.find((item) => item.id === ambassadorId);
  const totals = calculateAmbassadorTotals(ambassadorId);
  const referralCode = localStorage.getItem('ambassadorRef') || ambassador?.referralCode || getShortReferralCode(ambassadorId);

  if (uidNode) uidNode.textContent = authState.user?.uid || 'Ikke innlogget';
  if (ambassadorNode) ambassadorNode.textContent = ambassador?.status || 'Pending';
  if (referralNode) referralNode.textContent = referralCode || '—';
  if (leadNode) leadNode.textContent = String(totals.leads || 0);
  if (approvedNode) approvedNode.textContent = String(totals.won || 0);
  if (pendingNode) pendingNode.textContent = currency(totals.pending || 0);
  if (paidNode) paidNode.textContent = currency(totals.paid || 0);

  if (timelineNode) {
    const today = new Date().toISOString().slice(0, 10);
    timelineNode.innerHTML = `
      <li><strong>${today}</strong> · Auth user created (${authState.user?.uid ? 'UID assigned' : 'not signed in yet'})</li>
      <li><strong>${today}</strong> · Ambassador profile ${ambassador ? `found (${ambassador.status})` : 'missing'}</li>
      <li><strong>${today}</strong> · Referral code active: ${referralCode || 'none'}</li>
      <li><strong>${today}</strong> · Total leads: ${totals.leads}</li>
      <li><strong>${today}</strong> · Approved leads: ${totals.won}</li>
      <li><strong>${today}</strong> · Payout pending/paid: ${currency(totals.pending)} / ${currency(totals.paid)}</li>
    `;
  }
}


function subscribeToFirestoreLeads() {
  subscribeToLeadsInStore(db, (firestoreLeads) => {
    demoDb.leads = firestoreLeads.map((lead) => captureLeadCommission(lead));
    setAmbassadorChartData(buildChartData(demoDb.leads));
    refreshAmbassadorCharts();
    renderAdmin();
    renderAmbassadorDashboard();
    renderFlowPage();
  });
}

function normalizeAmbassadorStatus(status) {
  const lower = String(status || '').toLowerCase();
  if (lower === 'approved' || lower === 'active') return 'Active';
  if (lower === 'paused') return 'Paused';
  return 'Pending';
}

function subscribeToFirestoreAmbassadors() {
  subscribeToAmbassadorsInStore(db, (ambassadors) => {
    demoDb.ambassadors = ambassadors.map((ambassador) => ({
      id: ambassador.id,
      name: ambassador.name || ambassador.email || ambassador.id,
      email: ambassador.email || '',
      commissionRate: Number(ambassador.commissionRate ?? DEFAULT_COMMISSION_RATE),
      referralCode: ambassador.referralCode || getShortReferralCode(ambassador.id),
      status: normalizeAmbassadorStatus(ambassador.status),
      createdAt: ambassador.createdAt || null
    }));
    renderAdmin();
    renderAmbassadorDashboard();
    renderFlowPage();
  });
}

captureReferral();
trackReferralFromUrl();
handleRedirectLoginResult();
initAuthStateSync();
initTheme();
initAuthAction();
initLanguageToggle();
initNavbar();
setBrandLogo();
if (isDemoAdminSession()) activateDemoAdminSession();
initLandingPage();
initAdminPage();
initAmbassadorTabs();
initShareFlow();
renderAmbassadorDashboard();
initProfilePage();
initInvoicePage();
syncProfileUi();
renderFlowPage();
setAmbassadorChartData(buildChartData(demoDb.leads));
initAmbassadorCharts();
if (!isDemoAdminSession()) {
  subscribeToFirestoreLeads();
  subscribeToFirestoreAmbassadors();
}

document.querySelector('#loginGoogle')?.addEventListener('click', window.loginWithGoogle);
document.querySelector('#loginFacebook')?.addEventListener('click', loginWithFacebookDemo);
