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
  apiKey: 'AIzaSyBERElRl3D5EHzKme6to5w2nTZFAFb8ySQ',
  authDomain: 'animer-ambassador-mvp.firebaseapp.com',
  projectId: 'animer-ambassador-mvp',
  storageBucket: 'animer-ambassador-mvp.firebasestorage.app',
  messagingSenderId: '793382601384',
  appId: '1:793382601384:web:539e5516ac484f9dc6789d'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const authMessage = document.querySelector('#authMessage');
const REFERRAL_COOKIE_KEY = 'ref';
const DEFAULT_COMMISSION_RATE = 0.1;

const DEMO_ADMIN_USERNAME = 'SuperAdmin';
const DEMO_ADMIN_PASSWORD = 'Animer';
const DEMO_ADMIN_SESSION_KEY = 'isDemoAdmin';

const DEMO_ADMIN_PROFILE = {
  id: 'demo-superadmin',
  fullName: 'SuperAdmin',
  email: 'superadmin@demo.animer',
  phone: '+47 99 99 99 99',
  provider: 'Demo credentials',
  avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=SuperAdmin',
  company: 'Animer Demo'
};

const DEMO_ADMIN_AMBASSADORS = [
  { id: 'amb-nora', name: 'Nora Hansen', email: 'nora@animer.no', commissionRate: 0.12, referralCode: 'ambnora', status: 'Active', createdAt: '2026-01-04T08:20:00.000Z' },
  { id: 'amb-jonas', name: 'Jonas Berg', email: 'jonas@animer.no', commissionRate: 0.1, referralCode: 'ambjonas', status: 'Active', createdAt: '2026-01-03T10:05:00.000Z' },
  { id: 'amb-sara', name: 'Sara Eide', email: 'sara@animer.no', commissionRate: 0.08, referralCode: 'ambsara', status: 'Pending', createdAt: '2026-01-02T07:30:00.000Z' }
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
    navAmbassador: 'Ambassadørdashboard',
    navAdmin: 'Admin-panel',
    navProfile: 'Min profil',
    navPayout: 'Utbetalinger',
    navFlow: 'Systemflyt'
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

const adminState = { leadStatusFilter: 'all', ambassadorFilter: 'all', pendingStatusLeadId: null };
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
  demoDb.ambassadors = DEMO_ADMIN_AMBASSADORS.map((item) => ({ ...item }));
  demoDb.leads = DEMO_ADMIN_LEADS.map((lead) => captureLeadCommission({ ...lead }));
  demoDb.payouts = DEMO_ADMIN_PAYOUTS.map((item) => ({ ...item }));
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
  return stored === 'en' ? 'en' : 'nb';
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
      setAuthMessage('Innlogget som demo SuperAdmin.');
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
      setAuthMessage(`Innlogget som ${user.email}.`);
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
      setAuthMessage('Demo SuperAdmin er logget ut.');
      window.location.replace('index.html');
      return;
    }

    if (currentlyLoggedIn) {
      signOut(auth).catch(() => {
        localStorage.setItem('isLoggedIn', 'false');
      });
      localStorage.setItem('isAdmin', 'false');
      setAuthMessage('Du er logget ut.');
      if (PROTECTED_PAGES.some((page) => window.location.pathname.endsWith(page))) {
        window.location.replace('index.html');
      }
      return;
    }

    setAuthMessage('Bruk innloggingsknappene for å logge inn.');
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
    setAuthMessage(`Innlogget som ${result.user.email}`);
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
    setAuthMessage(`Innlogget som ${result.user.email}.`);
    syncProfileUi();
    setLang(getCurrentLang());
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

function initLandingPage() {
  const leadForm = document.querySelector('#leadForm');
  const leadMessage = document.querySelector('#leadMessage');
  const registerForm = document.querySelector('#registerForm');
  const registerMessage = document.querySelector('#registerMessage');
  const demoAdminForm = document.querySelector('#demoAdminLoginForm');
  const demoAdminMessage = document.querySelector('#demoAdminMessage');
  if (!leadForm) return;

  if (new URLSearchParams(window.location.search).get('blocked') === 'admin') {
    setAuthMessage('Logg inn for å få tilgang til admin-sider.');
  } else if (new URLSearchParams(window.location.search).get('blocked') === 'admin-role') {
    setAuthMessage('Kontoen din mangler admin-claim. Sett custom claim (f.eks. isAdmin/admin) og logg inn på nytt.');
  }

  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(leadForm);
    try {
      const lead = await createLead({ name: formData.get('name'), company: formData.get('company'), email: formData.get('email') });
      leadMessage.textContent = lead.duplicate
        ? `Lead finnes allerede for ${lead.company}. Eksisterende ambassadør er beholdt.`
        : `Lead lagret: ${lead.company}`;
      leadForm.reset();
    } catch {
      leadMessage.textContent = 'Kunne ikke lagre lead.';
    }
  });


  demoAdminForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(demoAdminForm);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '').trim();

    if (username !== DEMO_ADMIN_USERNAME || password !== DEMO_ADMIN_PASSWORD) {
      if (demoAdminMessage) demoAdminMessage.textContent = 'Feil brukernavn eller passord.';
      return;
    }

    activateDemoAdminSession();
    if (demoAdminMessage) demoAdminMessage.textContent = 'Demo SuperAdmin er aktivert. Sender deg til admin-panelet...';
    window.location.assign('admin.html');
  });

  registerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    demoDb.userProfile.fullName = String(formData.get('fullName') || '');
    demoDb.userProfile.email = String(formData.get('email') || '');
    demoDb.userProfile.phone = String(formData.get('phone') || '');
    demoDb.userProfile.provider = 'E-post';
    registerMessage.textContent = 'Konto registrert lokalt i MVP.';
    syncProfileUi();
  });
}

function getFilteredLeads() {
  return demoDb.leads.filter((lead) => {
    const statusOk = adminState.leadStatusFilter === 'all' || lead.status === adminState.leadStatusFilter;
    const ambassador = lead.ambassadorId || 'Ingen';
    const ambassadorOk = adminState.ambassadorFilter === 'all' || ambassador === adminState.ambassadorFilter;
    return statusOk && ambassadorOk;
  });
}

function renderAdmin() {
  const leadBody = document.querySelector('#adminLeadBody');
  const ambassadorBody = document.querySelector('#adminAmbassadorBody');
  const payoutBody = document.querySelector('#adminPayoutBody');
  const leadEmptyState = document.querySelector('#leadEmptyState');
  if (!leadBody || !ambassadorBody || !payoutBody) return;

  const filteredLeads = getFilteredLeads();
  leadBody.innerHTML = filteredLeads.map((lead) => {
    const payoutBucket = getLeadPayoutBucket(lead);
    return `
    <tr>
      <td>${lead.company}</td>
      <td>${lead.name}</td>
      <td>${lead.ambassadorId || 'Ingen'}</td>
      <td><span class="badge info">${lead.status}</span></td>
      <td>${payoutBadgeLabel(payoutBucket)}</td>
      <td><input type="number" class="deal-input" data-id="${lead.id}" min="0" value="${lead.dealValue || 0}" ${['approved', 'payout_requested', 'paid'].includes(normalizeLeadStatus(lead.status)) ? '' : 'disabled'} /></td>
      <td>${currency(lead.commissionAmount || 0)}</td>
      <td><button class="btn-secondary open-status-modal" data-id="${lead.id}">Endre</button></td>
    </tr>`;
  }).join('');

  if (leadEmptyState) leadEmptyState.hidden = filteredLeads.length > 0;

  ambassadorBody.innerHTML = demoDb.ambassadors.map((ambassador) => {
    const totals = calculateAmbassadorTotals(ambassador.id);
    const statusBadge = ambassador.status === 'Active' ? 'ok' : ambassador.status === 'Pending' ? 'pending' : 'info';
    return `
      <tr>
        <td>${ambassador.name}<br/><span class="muted">${ambassador.email}</span></td>
        <td><span class="badge ${statusBadge}">${ambassador.status}</span></td>
        <td>${totals.leads}</td>
        <td>${currency(totals.revenue)}</td>
        <td><input class="commission-input" data-id="${ambassador.id}" type="number" min="1" max="100" value="${Math.round(ambassador.commissionRate * 100)}" />%</td>
        <td>${currency(totals.earned)}</td>
        <td>${currency(totals.unpaid)}</td>
        <td>
          <select class="ambassador-status" data-id="${ambassador.id}">
            ${AMBASSADOR_STATUSES.map((status) => `<option value="${status}" ${status === ambassador.status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <span class="badge ${statusBadge}">${ambassador.status}</span>
        </td>
      </tr>`;
  }).join('');

  payoutBody.innerHTML = demoDb.ambassadors.map((ambassador) => {
    const totals = calculateAmbassadorTotals(ambassador.id);
    const nextPayDate = new Date().toISOString().slice(0, 10);
    const latestPayout = demoDb.payouts
      .filter((payout) => payout.ambassadorId === ambassador.id)
      .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0))[0];
    return `<tr>
      <td>${ambassador.name}</td>
      <td>${currency(totals.earned)}</td>
      <td>${currency(totals.available)}</td>
      <td>${currency(totals.pending)}</td>
      <td>${currency(totals.paid)}</td>
      <td>${currency(totals.unpaid)}</td>
      <td>${latestPayout?.paidAt ? formatDate(latestPayout.paidAt) : '—'}</td>
      <td>
        <input class="payout-date-input" type="date" data-id="${ambassador.id}" value="${nextPayDate}" />
        <button class="btn-secondary mark-paid" data-id="${ambassador.id}">Marker paid</button>
      </td>
    </tr>`;
  }).join('');

  renderFlowPage();
}

function recalculateLeadCommission(lead) {
  const recalculated = captureLeadCommission({
    ...lead,
    commissionRate: Number(lead.commissionRate ?? DEFAULT_COMMISSION_RATE)
  });

  Object.assign(lead, recalculated);
}

function openStatusModal(leadId) {
  const backdrop = document.querySelector('#statusModalBackdrop');
  const select = document.querySelector('#statusModalSelect');
  const message = document.querySelector('#statusModalMessage');
  const lead = demoDb.leads.find((item) => item.id === leadId);
  if (!backdrop || !select || !lead) return;

  adminState.pendingStatusLeadId = leadId;
  select.innerHTML = LEAD_STATUSES.map((status) => `<option value="${status}" ${status === lead.status ? 'selected' : ''}>${status}</option>`).join('');
  if (message) message.textContent = `Endre status for ${lead.company}.`;
  backdrop.classList.add('open');
}

function closeStatusModal() {
  const backdrop = document.querySelector('#statusModalBackdrop');
  adminState.pendingStatusLeadId = null;
  backdrop?.classList.remove('open');
}

function initAdminPage() {
  const leadBody = document.querySelector('#adminLeadBody');
  const ambassadorBody = document.querySelector('#adminAmbassadorBody');
  const payoutBody = document.querySelector('#adminPayoutBody');
  const leadStatusFilter = document.querySelector('#leadStatusFilter');
  const leadAmbassadorFilter = document.querySelector('#leadAmbassadorFilter');
  const modalSelect = document.querySelector('#statusModalSelect');
  const modalBackdrop = document.querySelector('#statusModalBackdrop');
  if (!leadBody || !ambassadorBody || !payoutBody) return;

  if (leadStatusFilter) {
    leadStatusFilter.innerHTML = `<option value="all">Status</option>${LEAD_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join('')}`;
  }
  if (leadAmbassadorFilter) {
    const options = ['all', ...new Set(demoDb.leads.map((lead) => lead.ambassadorId || 'Ingen'))];
    leadAmbassadorFilter.innerHTML = options.map((value) => `<option value="${value}">${value === 'all' ? 'Ambassadør' : value}</option>`).join('');
  }

  renderAdmin();

  leadStatusFilter?.addEventListener('change', (event) => {
    adminState.leadStatusFilter = event.target.value;
    renderAdmin();
  });
  leadAmbassadorFilter?.addEventListener('change', (event) => {
    adminState.ambassadorFilter = event.target.value;
    renderAdmin();
  });

  leadBody.addEventListener('click', (event) => {
    const button = event.target.closest('.open-status-modal');
    if (!button || !modalSelect || !modalBackdrop) return;
    const lead = demoDb.leads.find((item) => item.id === button.dataset.id);
    if (!lead) return;
    adminState.pendingStatusLeadId = lead.id;
    modalSelect.innerHTML = LEAD_STATUSES.map((status) => `<option value="${status}" ${status === lead.status ? 'selected' : ''}>${status}</option>`).join('');
    modalBackdrop.classList.add('open');
  });

  leadBody.addEventListener('change', async (event) => {
    const dealInput = event.target.closest('.deal-input');
    if (!dealInput) return;
    const lead = demoDb.leads.find((item) => item.id === dealInput.dataset.id);
    if (!lead) return;
    lead.value = Number(dealInput.value || 0);
    lead.dealValue = lead.value;
    recalculateLeadCommission(lead);
    try {
      await updateLeadInStore(db, lead.id, {
        status: lead.status,
        value: lead.value,
        dealValue: lead.dealValue,
        commissionRate: Number(lead.commissionRate ?? DEFAULT_COMMISSION_RATE)
      });
    } catch {
      // ignore in local preview
    }
    renderAdmin();
  });

  ambassadorBody.addEventListener('change', async (event) => {
    const statusSelect = event.target.closest('.ambassador-status');
    const commissionInput = event.target.closest('.commission-input');

    if (statusSelect) {
      const ambassador = demoDb.ambassadors.find((item) => item.id === statusSelect.dataset.id);
      if (!ambassador) return;
      ambassador.status = statusSelect.value;
      try {
        await updateDoc(doc(db, 'ambassadors', ambassador.id), { status: ambassador.status });
      } catch {
        // ignore in local preview
      }
      renderAdmin();
      return;
    }

    if (commissionInput) {
      const ambassador = demoDb.ambassadors.find((item) => item.id === commissionInput.dataset.id);
      if (!ambassador) return;
      ambassador.commissionRate = Math.max(0.01, Math.min(1, Number(commissionInput.value || 10) / 100));
      try {
        await updateDoc(doc(db, 'ambassadors', ambassador.id), { commissionRate: ambassador.commissionRate });
      } catch {
        // ignore in local preview
      }
      renderAdmin();
    }
  });

  payoutBody.addEventListener('click', (event) => {
    const paidButton = event.target.closest('.mark-paid');
    if (!paidButton) return;
    const ambassadorId = paidButton.dataset.id;
    const payoutDateInput = payoutBody.querySelector(`.payout-date-input[data-id="${ambassadorId}"]`);
    const payoutDate = payoutDateInput?.value || new Date().toISOString().slice(0, 10);
    const payableLeads = demoDb.leads.filter((lead) => lead.ambassadorId === ambassadorId && getLeadPayoutBucket(lead) === 'available');
    const paidOut = payableLeads.reduce((sum, lead) => sum + Number(lead.commissionAmount || lead.commission || 0), 0);
    if (paidOut <= 0) return;

    payableLeads.forEach((lead) => {
      lead.status = 'paid';
      lead.payoutStatus = 'paid';
      lead.payoutDate = `${payoutDate}T00:00:00.000Z`;
    });

    demoDb.payouts.push({ ambassadorId, paidOut, paidAt: `${payoutDate}T00:00:00.000Z` });
    renderAdmin();
    renderAmbassadorDashboard();
    renderFlowPage();
  });

  document.querySelector('#closeStatusModal')?.addEventListener('click', closeStatusModal);
  document.querySelector('#saveStatusModal')?.addEventListener('click', async () => {
    if (!modalSelect || !adminState.pendingStatusLeadId) return;
    const lead = demoDb.leads.find((item) => item.id === adminState.pendingStatusLeadId);
    if (!lead) return;
    lead.status = modalSelect.value;
    recalculateLeadCommission(lead);
    try {
      await updateLeadInStore(db, lead.id, {
        status: lead.status,
        value: Number(lead.value ?? lead.dealValue ?? 0),
        dealValue: Number(lead.dealValue ?? lead.value ?? 0),
        commissionRate: Number(lead.commissionRate ?? DEFAULT_COMMISSION_RATE)
      });
    } catch {
      // ignore in local preview
    }
    closeStatusModal();
    renderAdmin();
  });

  modalBackdrop?.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) closeStatusModal();
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
    const text = encodeURIComponent(String(textInput?.value || 'Sjekk Animer!'));
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

  if (topAvatar) topAvatar.src = demoDb.userProfile.avatarUrl;
  if (avatar) avatar.src = demoDb.userProfile.avatarUrl;
  if (name) name.textContent = demoDb.userProfile.fullName;
  if (provider) provider.textContent = `Innlogget via ${demoDb.userProfile.provider}`;
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
    document.querySelector('#profileMessage').textContent = 'Profil oppdatert.';
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
      fileName: file?.name || 'uten filnavn',
      createdAt: new Date().toISOString()
    });
    render();
    message.textContent = 'Faktura lastet opp (lokalt i MVP).';
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
      <li><strong>${today}</strong> · Auth user opprettet (${authState.user?.uid ? 'uid satt' : 'ikke innlogget enda'})</li>
      <li><strong>${today}</strong> · Ambassador-profil ${ambassador ? `funnet (${ambassador.status})` : 'mangler'}</li>
      <li><strong>${today}</strong> · Referral-kode aktiv: ${referralCode || 'ingen'}</li>
      <li><strong>${today}</strong> · Leads totalt: ${totals.leads}</li>
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
