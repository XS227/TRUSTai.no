import { AMBASSADOR_STATUSES, LEAD_STATUSES, calculateAmbassadorTotals, currency, demoDb, formatDate } from './data-store.js';
import { initAmbassadorCharts, refreshAmbassadorCharts } from './charts/index.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAuth, getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

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

const adminState = { leadStatusFilter: 'all', ambassadorFilter: 'all', pendingStatusLeadId: null };
const ambassadorState = { leadFilter: 'all', selectedSharePlatform: null };

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

function initAuthAction() {
  const authAction = document.querySelector('#authAction');
  const avatar = document.querySelector('#topbarAvatar');
  const isLoggedIn = localStorage.getItem('isLoggedIn') !== 'false';

  if (avatar) avatar.src = demoDb.userProfile.avatarUrl;
  if (authAction) authAction.textContent = isLoggedIn ? 'Logg ut' : 'Logg inn';

  authAction?.addEventListener('click', () => {
    const next = authAction.textContent === 'Logg ut' ? 'Logg inn' : 'Logg ut';
    authAction.textContent = next;
    localStorage.setItem('isLoggedIn', String(next === 'Logg ut'));
    setAuthMessage(next === 'Logg ut' ? 'Du er logget inn.' : 'Du er logget ut.');
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

function getReferralData() {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ref || !parsed?.capturedAt) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function isAttributionActive(referralData) {
  if (!referralData?.capturedAt) return false;
  const capturedAt = new Date(referralData.capturedAt).getTime();
  if (!capturedAt) return false;
  const ageMs = Date.now() - capturedAt;
  return ageMs <= ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function getAmbassadorReferrer() {
  const localRef = getReferralData();
  if (isAttributionActive(localRef)) return localRef.ref;
  const cookieRef = getCookie(REFERRAL_COOKIE_KEY);
  return cookieRef || null;
}

function persistReferral(ref) {
  const referralData = {
    ref,
    capturedAt: new Date().toISOString(),
    attribution: 'first-click',
    expiresInDays: ATTRIBUTION_WINDOW_DAYS
  };

  localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralData));
  localStorage.setItem(REFERRAL_COOKIE_KEY, ref);
  setCookie(REFERRAL_COOKIE_KEY, ref, ATTRIBUTION_WINDOW_DAYS);
}

function getReferralFromPath(pathname) {
  const match = String(pathname || '').match(/\/a\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]).trim().toUpperCase() : null;
}

function trackReferralFromUrl() {
  const url = new URL(window.location.href);
  const ref = (url.searchParams.get('ref') || getReferralFromPath(url.pathname) || '').trim().toUpperCase();
  const target = url.searchParams.get('target') || 'ambassador.html';
  if (!ref) return;

  demoDb.referralClicks.push({ ambassadorId: ref, timestamp: new Date().toISOString(), userAgent: navigator.userAgent });
  setCookie('ref', ref, 90);
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
    setAuthMessage(`Innlogget som ${result.user.email}.`);
    syncProfileUi();
  } catch (error) {
    if (error?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return;
    }
    setAuthMessage('Innlogging feilet.');
  }
};

function loginWithFacebookDemo() {
  demoDb.userProfile.provider = 'Facebook';
  demoDb.userProfile.avatarUrl = 'https://i.pravatar.cc/120?img=32';
  localStorage.setItem('isLoggedIn', 'true');
  setAuthMessage('Facebook demo-login aktivert for MVP.');
  syncProfileUi();
}

function createLead({ name, company, email }) {
  const ambassadorId = getCookie('ref') || 'AMB123';
  const newLead = {
    id: `lead-${Date.now()}`,
    name,
    company,
    email,
    ambassadorId,
    status: 'open',
    dealValue: 0,
    commissionAmount: 0,
    value: 0,
    commissionRate: DEFAULT_COMMISSION_RATE,
    createdAt: new Date().toISOString()
  };
  demoDb.leads.unshift(newLead);
  return newLead;
}

function initLandingPage() {
  const leadForm = document.querySelector('#leadForm');
  const leadMessage = document.querySelector('#leadMessage');
  const registerForm = document.querySelector('#registerForm');
  const registerMessage = document.querySelector('#registerMessage');
  if (!leadForm) return;

  leadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(leadForm);
    const lead = createLead({ name: formData.get('name'), company: formData.get('company'), email: formData.get('email') });
    leadMessage.textContent = `Lead lagret: ${lead.company}`;
    leadForm.reset();
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
  leadBody.innerHTML = filteredLeads.map((lead) => `
    <tr>
      <td>${lead.company}</td>
      <td>${lead.name}</td>
      <td>${lead.ambassadorId || 'Ingen'}</td>
      <td><span class="badge info">${lead.status}</span></td>
      <td><input type="number" class="deal-input" data-id="${lead.id}" min="0" value="${lead.dealValue || 0}" ${lead.status === 'Won' ? '' : 'disabled'} /></td>
      <td>${currency(lead.commissionAmount || 0)}</td>
      <td><button class="btn-secondary open-status-modal" data-id="${lead.id}">Endre</button></td>
    </tr>`).join('');

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
    return `<tr><td>${ambassador.name}</td><td>${currency(totals.earned)}</td><td>${currency(totals.paidOut)}</td><td>${currency(totals.available)}</td><td><button class="btn-secondary mark-paid" data-id="${ambassador.id}">Marker utbetalt</button></td></tr>`;
  }).join('');
}

function recalculateLeadCommission(lead) {
  const normalizedStatus = String(lead.status || '').toLowerCase();
  const approved = normalizedStatus === 'approved' || normalizedStatus === 'won';
  const value = Number(lead.dealValue ?? lead.value ?? 0);
  const commissionRate = Number(lead.commissionRate ?? DEFAULT_COMMISSION_RATE);

  if (!approved) {
    lead.dealValue = 0;
    lead.value = 0;
    lead.commissionAmount = 0;
    return;
  }

  lead.dealValue = value;
  lead.value = value;
  lead.commissionRate = commissionRate;
  lead.commissionAmount = Math.round(value * commissionRate);
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

  leadBody.addEventListener('change', (event) => {
    const dealInput = event.target.closest('.deal-input');
    if (!dealInput) return;
    const lead = demoDb.leads.find((item) => item.id === dealInput.dataset.id);
    if (!lead) return;
    lead.dealValue = Number(dealInput.value || 0);
    const ambassador = demoDb.ambassadors.find((item) => item.id === lead.ambassadorId);
    lead.commissionAmount = Math.round(lead.dealValue * Number(ambassador?.commissionRate || 0));
    renderAdmin();
  });

  ambassadorBody.addEventListener('change', (event) => {
    const statusSelect = event.target.closest('.ambassador-status');
    const commissionInput = event.target.closest('.commission-input');

    if (statusSelect) {
      const ambassador = demoDb.ambassadors.find((item) => item.id === statusSelect.dataset.id);
      if (!ambassador) return;
      ambassador.status = statusSelect.value;
      renderAdmin();
      return;
    }

    if (commissionInput) {
      const ambassador = demoDb.ambassadors.find((item) => item.id === commissionInput.dataset.id);
      if (!ambassador) return;
      ambassador.commissionRate = Math.max(0.01, Math.min(1, Number(commissionInput.value || 10) / 100));
      renderAdmin();
    }
  });

  payoutBody.addEventListener('click', (event) => {
    const paidButton = event.target.closest('.mark-paid');
    if (!paidButton) return;
    const totals = calculateAmbassadorTotals(paidButton.dataset.id);
    if (totals.available <= 0) return;
    demoDb.payouts.push({ ambassadorId: paidButton.dataset.id, paidOut: totals.available });
    renderAdmin();
  });

  document.querySelector('#closeStatusModal')?.addEventListener('click', () => modalBackdrop?.classList.remove('open'));
  document.querySelector('#saveStatusModal')?.addEventListener('click', () => {
    if (!modalSelect || !adminState.pendingStatusLeadId) return;
    const lead = demoDb.leads.find((item) => item.id === adminState.pendingStatusLeadId);
    if (!lead) return;
    lead.status = modalSelect.value;
    if (lead.status !== 'Won') {
      lead.dealValue = 0;
      lead.commissionAmount = 0;
    }
    modalBackdrop?.classList.remove('open');
    renderAdmin();
  });

  closeModalButton?.addEventListener('click', closeStatusModal);
  modalBackdrop?.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) closeStatusModal();
  });

  saveModalButton?.addEventListener('click', () => {
    if (!adminState.pendingStatusLeadId || !modalSelect) return;
    const lead = demoDb.leads.find((item) => item.id === adminState.pendingStatusLeadId);
    lead.status = modalSelect.value;
    recalculateLeadCommission(lead);
    closeStatusModal();
    renderAdmin();
  });
}

function getAmbassadorLeads(ambassadorId) {
  const leads = demoDb.leads.filter((lead) => lead.ambassadorId === ambassadorId);
  if (ambassadorState.leadFilter === 'all') return leads;
  return leads.filter((lead) => lead.status === ambassadorState.leadFilter);
}

function getAmbassadorLeads(ambassadorId) {
  const leads = demoDb.leads.filter((lead) => lead.ambassadorId === ambassadorId);
  if (ambassadorState.leadFilter === 'all') return leads;
  return leads.filter((lead) => lead.status === ambassadorState.leadFilter);
}

function renderAmbassadorDashboard() {
  const ambassadorId = 'AMB123';
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
    const target = encodeURIComponent('https://animer.no/a/AMB123');
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
    await navigator.clipboard.writeText('https://animer.no/a/AMB123');
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


function subscribeToAmbassadorLeads() {
  if (!window.location.pathname.includes('ambassador')) return;

  onAuthStateChanged(auth, (user) => {
    if (!user) return;

    const leadsQuery = query(collection(db, 'leads'), where('ambassadorId', '==', user.uid));
    onSnapshot(leadsQuery, (snapshot) => {
      const firestoreLeads = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));

      if (!firestoreLeads.length) return;
      demoDb.leads = firestoreLeads;
      renderAmbassadorDashboard();
    });
  });
}

trackReferralFromUrl();
handleRedirectLoginResult();
initTheme();
initAuthAction();
initNavbar();
initLandingPage();
initAdminPage();
initAmbassadorTabs();
initShareFlow();
renderAmbassadorDashboard();
initProfilePage();
initInvoicePage();
syncProfileUi();
initAmbassadorCharts();

document.querySelector('#loginGoogle')?.addEventListener('click', window.loginWithGoogle);
document.querySelector('#loginFacebook')?.addEventListener('click', loginWithFacebookDemo);
