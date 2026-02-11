const fakeDb = {
  leads: [
    { id: 1, company: 'Elkjøp', status: 'Tilbud sendt', value: 120000, commission: 10, ambassador: 'Mina N.', owner: 'Anne', priority: 'Høy' },
    { id: 2, company: 'Power Norge', status: 'Møte booket', value: 89000, commission: 10, ambassador: 'Mina N.', owner: 'Sander', priority: 'Middels' },
    { id: 3, company: 'XXL Sport', status: 'Godkjent', value: 150000, commission: 12, ambassador: 'Lars B.', owner: 'Anne', priority: 'Høy' },
    { id: 4, company: 'Bohus', status: 'Åpen', value: 74000, commission: 8, ambassador: 'Lars B.', owner: 'Espen', priority: 'Lav' }
  ],
  ambassadors: [
    { id: 1, name: 'Mina N.', status: 'Aktiv' },
    { id: 2, name: 'Lars B.', status: 'Paused' },
    { id: 3, name: 'Hedda R.', status: 'Aktiv' }
  ],
  commissionLog: []
};

const currency = (v) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(v);

function initAmbassadorPage() {
  const leadList = document.querySelector('#leadList');
  if (!leadList) return;
  let leadFilter = 'Alle';
  let selectedLeadId = fakeDb.leads[0]?.id;

  const renderKpis = () => {
    const statuses = ['Godkjent', 'Møte booket'];
    document.querySelectorAll('.clickable-kpi').forEach((btn) => {
      const status = btn.dataset.status;
      const count = fakeDb.leads.filter((l) => status === 'Alle' || l.status === status).length;
      btn.querySelector('.kpi').textContent = count;
      btn.classList.toggle('active', leadFilter === status);
    });
    statuses.forEach((status) => {
      const el = document.querySelector(`[data-stat="${status}"]`);
      if (el) el.textContent = fakeDb.leads.filter((l) => l.status === status).length;
    });
  };

  const renderLeadList = () => {
    const rows = fakeDb.leads.filter((lead) => leadFilter === 'Alle' || lead.status === leadFilter);
    leadList.innerHTML = rows.map((lead) => `
      <tr>
        <td><button class="btn-ghost open-detail" data-id="${lead.id}">${lead.company}</button></td>
        <td>${lead.status}</td>
        <td>${currency(lead.value)}</td>
        <td>${lead.commission}%</td>
        <td><button class="btn-ghost change-status" data-id="${lead.id}">Endre status</button></td>
      </tr>
    `).join('') || '<tr><td colspan="5">Ingen leads i dette filteret.</td></tr>';
  };

  const renderDetail = () => {
    const lead = fakeDb.leads.find((l) => l.id === selectedLeadId);
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

  document.querySelectorAll('.clickable-kpi').forEach((btn) => {
    btn.addEventListener('click', () => {
      leadFilter = btn.dataset.status;
      renderKpis();
      renderLeadList();
    });
  });

  document.querySelectorAll('.pipeline-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pipeline-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      leadFilter = tab.dataset.status;
      renderKpis();
      renderLeadList();
    });
  });

  leadList.addEventListener('click', (e) => {
    const detailBtn = e.target.closest('.open-detail');
    const statusBtn = e.target.closest('.change-status');
    if (detailBtn) {
      selectedLeadId = Number(detailBtn.dataset.id);
      renderDetail();
    }
    if (statusBtn) {
      selectedLeadId = Number(statusBtn.dataset.id);
      renderDetail();
      const next = document.querySelector('#detailStatus');
      next.focus();
    }
  });

  document.querySelector('#detailStatus').addEventListener('change', (e) => {
    const lead = fakeDb.leads.find((l) => l.id === selectedLeadId);
    lead.status = e.target.value;
    renderKpis();
    renderLeadList();
  });

  const calculateCommission = () => {
    const lead = fakeDb.leads.find((l) => l.id === selectedLeadId);
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
    copyBtn.textContent = 'Kopiert ✓';
    setTimeout(() => (copyBtn.textContent = 'Kopier lenke'), 1200);
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
    adminLeadBody.innerHTML = fakeDb.leads.map((lead) => `
      <tr>
        <td>${lead.company}</td>
        <td>${lead.ambassador}</td>
        <td>
          <select class="admin-status" data-id="${lead.id}">
            ${['Åpen', 'Møte booket', 'Tilbud sendt', 'Godkjent', 'Avslag'].map((s) => `<option ${lead.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>${currency((lead.value * lead.commission) / 100)}</td>
      </tr>
    `).join('');
  };

  const renderAmbassadors = () => {
    const wrapper = document.querySelector('#ambassadorList');
    wrapper.innerHTML = fakeDb.ambassadors.map((amb) => `
      <div class="list-item">
        <strong>${amb.name}</strong>
        <div class="muted">Status: <span>${amb.status}</span></div>
        <button class="toggle ${amb.status === 'Aktiv' ? 'active' : ''}" data-id="${amb.id}"></button>
      </div>
    `).join('');
  };

  const renderLog = () => {
    const log = document.querySelector('#changeLog');
    log.innerHTML = fakeDb.commissionLog.map((entry) => `<li>${entry}</li>`).join('') || '<li>Ingen endringer enda.</li>';
  };

  renderAdminLeads();
  renderAmbassadors();
  renderLog();

  adminLeadBody.addEventListener('change', (e) => {
    const sel = e.target.closest('.admin-status');
    if (!sel) return;
    const lead = fakeDb.leads.find((l) => l.id === Number(sel.dataset.id));
    lead.status = sel.value;
  });

  document.querySelector('#saveCommission').addEventListener('click', () => {
    const leadId = Number(document.querySelector('#commissionLead').value);
    const pct = Number(document.querySelector('#commissionPct').value);
    const comment = document.querySelector('#commissionComment').value.trim();
    const msg = document.querySelector('#commissionMsg');
    if (!comment) {
      msg.textContent = 'Kommentar er påkrevd.';
      msg.style.color = 'var(--danger)';
      return;
    }
    const lead = fakeDb.leads.find((l) => l.id === leadId);
    const oldPct = lead.commission;
    lead.commission = pct;
    const logEntry = `${new Date().toLocaleString('nb-NO')}: ${lead.company} provisjon endret ${oldPct}% → ${pct}%. Kommentar: ${comment}`;
    fakeDb.commissionLog.unshift(logEntry);
    msg.textContent = 'Provisjon oppdatert og loggført.';
    msg.style.color = 'var(--success)';
    renderAdminLeads();
    renderLog();
  });

  document.querySelector('#ambassadorList').addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle');
    if (!btn) return;
    const amb = fakeDb.ambassadors.find((a) => a.id === Number(btn.dataset.id));
    amb.status = amb.status === 'Aktiv' ? 'Paused' : 'Aktiv';
    renderAmbassadors();
  });
}

initAmbassadorPage();
initAdminPage();
