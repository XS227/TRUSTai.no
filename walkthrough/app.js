import { initAmbassadorCharts } from './charts/index.js';
import { currency, demoDb } from './data-store.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBERElRl3D5EHzKme6to5w2nTZFAFb8ySQ',
  authDomain: 'animer-ambassador-mvp.firebaseapp.com',
  projectId: 'animer-ambassador-mvp',
  storageBucket: 'animer-ambassador-mvp.firebasestorage.app',
  messagingSenderId: '793382601384',
  appId: '1:793382601384:web:539e5516ac484f9dc6789d',
  measurementId: 'G-34RDGR7ET2'
};

const firebaseApp = initializeApp(firebaseConfig);
getAnalytics(firebaseApp);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

window.loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const authMessage = document.querySelector('#authMessage');

  try {
    const result = await signInWithPopup(auth, provider);
    const { user } = result;

    const ambassadorRef = doc(db, 'ambassadors', user.uid);
    const ambassadorSnap = await getDoc(ambassadorRef);

    if (!ambassadorSnap.exists()) {
      await setDoc(ambassadorRef, {
        name: user.displayName,
        email: user.email,
        status: 'pending',
        commission_total: 0,
        created_at: serverTimestamp()
      });
    }

    if (authMessage) {
      authMessage.textContent = `Innlogget som ${user.email}`;
    }
  } catch (error) {
    console.error('Google-innlogging feilet.', error);
    if (authMessage) {
      authMessage.textContent = `Innlogging feilet: ${error.message}`;
    }
  }
};

const loginGoogleBtn = document.querySelector('#loginGoogle');
const registerGoogleBtn = document.querySelector('#registerGoogle');


const toggleRegisterEmailBtn = document.querySelector('#toggleRegisterEmail');
const registerEmailFields = document.querySelector('#registerEmailFields');

if (toggleRegisterEmailBtn && registerEmailFields) {
  toggleRegisterEmailBtn.addEventListener('click', () => {
    registerEmailFields.classList.remove('is-hidden');
    registerEmailFields.setAttribute('aria-hidden', 'false');
    toggleRegisterEmailBtn.classList.add('is-hidden');

    const firstField = registerEmailFields.querySelector('input');
    firstField?.focus();
  });
}

loginGoogleBtn?.addEventListener('click', window.loginWithGoogle);
registerGoogleBtn?.addEventListener('click', window.loginWithGoogle);

function initNavbar() {
  const navToggle = document.querySelector('#navToggle');
  const sidebar = document.querySelector('.sidebar');
  if (!navToggle || !sidebar) return;

  navToggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  sidebar.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function initAmbassadorPage() {
  const leadList = document.querySelector('#leadList');
  if (!leadList) return;

  let leadFilter = 'Alle';
  let selectedLeadId = demoDb.leads[0]?.id;

  const renderKpis = () => {
    const statuses = ['Godkjent', 'Møte booket'];
    document.querySelectorAll('.clickable-kpi').forEach((btn) => {
      const status = btn.dataset.status;
      const count = demoDb.leads.filter((lead) => status === 'Alle' || lead.status === status).length;
      btn.querySelector('.kpi').textContent = count;
      btn.classList.toggle('active', leadFilter === status);
    });

    statuses.forEach((status) => {
      const stat = document.querySelector(`[data-stat="${status}"]`);
      if (stat) stat.textContent = demoDb.leads.filter((lead) => lead.status === status).length;
    });
  };

  const renderLeadList = () => {
    const rows = demoDb.leads.filter((lead) => leadFilter === 'Alle' || lead.status === leadFilter);
    leadList.innerHTML =
      rows
        .map(
          (lead) => `
      <tr>
        <td><button class="btn-ghost open-detail" data-id="${lead.id}">${lead.company}</button></td>
        <td>${lead.status}</td>
        <td>${currency(lead.value)}</td>
        <td>${lead.commission}%</td>
        <td><button class="btn-ghost change-status" data-id="${lead.id}">Endre status</button></td>
      </tr>
    `
        )
        .join('') || '<tr><td colspan="5">Ingen leads i dette filteret.</td></tr>';
  };

  const renderDetail = () => {
    const lead = demoDb.leads.find((item) => item.id === selectedLeadId);
    if (!lead) return;
    document.querySelector('#detailCompany').textContent = lead.company;
    document.querySelector('#detailValue').value = lead.value;
    document.querySelector('#detailStatus').value = lead.status;
    document.querySelector('#detailCommission').textContent = currency((lead.value * lead.commission) / 100);
    document.querySelector('#detailPct').value = lead.commission;
  };

  renderKpis();
  renderLeadList();
  renderDetail();
  initAmbassadorCharts();

  document.querySelectorAll('.clickable-kpi').forEach((btn) => {
    btn.addEventListener('click', () => {
      leadFilter = btn.dataset.status;
      renderKpis();
      renderLeadList();
    });
  });

  document.querySelectorAll('.pipeline-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pipeline-tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      leadFilter = tab.dataset.status;
      renderKpis();
      renderLeadList();
    });
  });

  leadList.addEventListener('click', (event) => {
    const detailBtn = event.target.closest('.open-detail');
    const statusBtn = event.target.closest('.change-status');

    if (detailBtn) {
      selectedLeadId = Number(detailBtn.dataset.id);
      renderDetail();
    }

    if (statusBtn) {
      selectedLeadId = Number(statusBtn.dataset.id);
      renderDetail();
      document.querySelector('#detailStatus').focus();
    }
  });

  document.querySelector('#detailStatus').addEventListener('change', (event) => {
    const lead = demoDb.leads.find((item) => item.id === selectedLeadId);
    lead.status = event.target.value;
    renderKpis();
    renderLeadList();
  });

  const calculateCommission = () => {
    const lead = demoDb.leads.find((item) => item.id === selectedLeadId);
    lead.value = Number(document.querySelector('#detailValue').value || 0);
    lead.commission = Number(document.querySelector('#detailPct').value || 0);
    document.querySelector('#detailCommission').textContent = currency((lead.value * lead.commission) / 100);
    renderLeadList();
  };

  document.querySelector('#detailValue').addEventListener('input', calculateCommission);
  document.querySelector('#detailPct').addEventListener('input', calculateCommission);

  const copyBtn = document.querySelector('#copyLink');
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText('https://animer.no/a/MINA-2026');
    copyBtn.textContent = 'Lenke kopiert ✓';
    setTimeout(() => {
      copyBtn.textContent = 'Kopier lenke';
    }, 1200);
  });

  document.querySelector('#openPayout').addEventListener('click', () => document.querySelector('#payoutPanel').classList.add('open'));
  document.querySelector('#closePayout').addEventListener('click', () => document.querySelector('#payoutPanel').classList.remove('open'));
  document.querySelector('#openInvoice').addEventListener('click', () => document.querySelector('#invoiceModal').classList.add('open'));
  document.querySelector('#closeInvoice').addEventListener('click', () => document.querySelector('#invoiceModal').classList.remove('open'));
}

function initAdminPage() {
  const adminLeadBody = document.querySelector('#adminLeadBody');
  if (!adminLeadBody) return;

  const renderAdminLeads = () => {
    adminLeadBody.innerHTML = demoDb.leads
      .map(
        (lead) => `
      <tr>
        <td>${lead.company}</td>
        <td>${lead.ambassador}</td>
        <td>
          <select class="admin-status" data-id="${lead.id}">
            ${['Åpen', 'Møte booket', 'Tilbud sendt', 'Godkjent', 'Avslag']
              .map((status) => `<option ${lead.status === status ? 'selected' : ''}>${status}</option>`)
              .join('')}
          </select>
        </td>
        <td>${currency((lead.value * lead.commission) / 100)}</td>
      </tr>
    `
      )
      .join('');
  };

  const renderAmbassadors = () => {
    const wrapper = document.querySelector('#ambassadorList');
    wrapper.innerHTML = demoDb.ambassadors
      .map(
        (ambassador) => `
      <div class="list-item">
        <strong>${ambassador.name}</strong>
        <div class="muted">Status: <span>${ambassador.status}</span></div>
        <label>Invitasjonsgrense
          <input class="invite-limit" type="number" min="0" data-id="${ambassador.id}" value="${ambassador.inviteLimit}" />
        </label>
        <div class="row-actions">
          <button class="btn-primary save-invite" data-id="${ambassador.id}">Lagre invitasjonsgrense</button>
          <button class="toggle ${ambassador.status === 'Aktiv' ? 'active' : ''}" data-id="${ambassador.id}" aria-label="Bytt status"></button>
        </div>
      </div>
    `
      )
      .join('');
  };

  const renderLog = () => {
    const log = document.querySelector('#changeLog');
    log.innerHTML = demoDb.commissionLog.map((entry) => `<li>${entry}</li>`).join('') || '<li>Ingen endringer ennå.</li>';
  };

  renderAdminLeads();
  renderAmbassadors();
  renderLog();
  initAmbassadorCharts();

  adminLeadBody.addEventListener('change', (event) => {
    const selected = event.target.closest('.admin-status');
    if (!selected) return;
    const lead = demoDb.leads.find((item) => item.id === Number(selected.dataset.id));
    lead.status = selected.value;
  });

  document.querySelector('#saveCommission').addEventListener('click', () => {
    const leadId = Number(document.querySelector('#commissionLead').value);
    const percent = Number(document.querySelector('#commissionPct').value);
    const comment = document.querySelector('#commissionComment').value.trim();
    const message = document.querySelector('#commissionMsg');

    if (!comment) {
      message.textContent = 'Kommentar er påkrevd.';
      message.style.color = 'var(--danger)';
      return;
    }

    const lead = demoDb.leads.find((item) => item.id === leadId);
    const oldPercent = lead.commission;
    lead.commission = percent;

    demoDb.commissionLog.unshift(
      `${new Date().toLocaleString('nb-NO')}: ${lead.company} provisjon endret ${oldPercent}% → ${percent}%. Kommentar: ${comment}`
    );

    message.textContent = 'Provisjon er oppdatert og loggført.';
    message.style.color = 'var(--success)';
    renderAdminLeads();
    renderLog();
  });

  document.querySelector('#ambassadorList').addEventListener('click', (event) => {
    const toggleBtn = event.target.closest('.toggle');
    const saveInviteBtn = event.target.closest('.save-invite');

    if (toggleBtn) {
      const ambassador = demoDb.ambassadors.find((item) => item.id === Number(toggleBtn.dataset.id));
      ambassador.status = ambassador.status === 'Aktiv' ? 'Pauset' : 'Aktiv';
      renderAmbassadors();
      return;
    }

    if (saveInviteBtn) {
      const ambassador = demoDb.ambassadors.find((item) => item.id === Number(saveInviteBtn.dataset.id));
      const input = document.querySelector(`.invite-limit[data-id="${ambassador.id}"]`);
      ambassador.inviteLimit = Number(input.value || 0);
      demoDb.commissionLog.unshift(
        `${new Date().toLocaleString('nb-NO')}: Invitasjonsgrense oppdatert for ${ambassador.name} til ${ambassador.inviteLimit}.`
      );
      renderAmbassadors();
      renderLog();
    }
  });
}

initNavbar();
initAmbassadorPage();
initAdminPage();

initFirebaseAuth();
