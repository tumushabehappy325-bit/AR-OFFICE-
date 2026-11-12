/* MUST Registry frontend: plain JavaScript, talks to the Express API at /api */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const nav = document.getElementById('nav');

  // ---------- Session ----------
  const store = {
    get(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set(key, val) { try { sessionStorage.setItem(key, val); } catch (e) { /* ignore */ } },
    del(key) { try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };
  const state = {
    token: store.get('token'),
    user: (() => { try { return JSON.parse(store.get('user') || 'null'); } catch (e) { return null; } })(),
  };

  function setSession(token, user) {
    state.token = token; state.user = user;
    store.set('token', token); store.set('user', JSON.stringify(user));
  }
  function clearSession() {
    state.token = null; state.user = null;
    store.del('token'); store.del('user');
  }

  // ---------- Helpers ----------
  const DOC_LABELS = {
    official_transcript: 'Official transcript',
    certificate_copy: 'Certificate copy',
    verification_letter: 'Verification letter',
  };
  const DELIVERY_LABELS = { pickup: 'Pickup', email: 'Email', courier: 'Courier' };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function badge(status) { return `<span class="badge ${esc(status)}">${esc(status)}</span>`; }

  function errorBox(err) {
    let html = `<div class="msg error" role="alert"><strong>${esc(err.message)}</strong>`;
    if (err.details && err.details.length) {
      html += '<ul>' + err.details.map((d) => `<li>${esc(d.message)}</li>`).join('') + '</ul>';
    }
    return html + '</div>';
  }
  function successBox(text) { return `<div class="msg success" role="status">${esc(text)}</div>`; }

  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && state.token) headers.Authorization = 'Bearer ' + state.token;
    let res;
    try {
      res = await fetch('/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      const netErr = new Error('Cannot reach the server. Check your connection and try again.');
      netErr.status = 0;
      throw netErr;
    }
    let json = {};
    try { json = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((json.error && json.error.message) || 'Request failed');
      err.status = res.status;
      err.code = json.error && json.error.code;
      err.details = json.error && json.error.details;
      err.body = json;
      if (res.status === 401 && auth && state.token) {
        clearSession();
        location.hash = '#/login';
      }
      throw err;
    }
    return json;
  }

  // ---------- Navigation ----------
  function renderNav(route) {
    const link = (href, label, key) =>
      `<a href="${href}" class="${route === key ? 'active' : ''}"${route === key ? ' aria-current="page"' : ''}>${label}</a>`;
    let html = link('#/verify', 'Verify a document', 'verify');
    if (state.user) {
      const dash = state.user.role === 'student' ? '#/student' : '#/staff';
      html += link(dash, state.user.role === 'student' ? 'My requests' : 'Registry desk', state.user.role === 'student' ? 'student' : 'staff');
      html += `<span class="who">${esc(state.user.name)} (${esc(state.user.role)})</span>`;
      html += '<button class="linklike" id="logoutBtn" type="button">Log out</button>';
    } else {
      html += link('#/login', 'Log in', 'login');
    }
    nav.innerHTML = html;
    const logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', () => { clearSession(); location.hash = '#/'; render(); });
  }

  // ---------- Views ----------
  function viewHome() {
    app.innerHTML = `
      <section class="hero">
        <h1>Transcripts and document verification</h1>
        <p>Request your official transcript online and track it from submission to collection. Employers can confirm that a document is genuine in seconds.</p>
        <div class="actions">
          <a class="btn" href="#/login">Log in to request</a>
          <a class="btn secondary" href="#/verify">Verify a document</a>
        </div>
      </section>
      <div class="grid-2">
        <section class="card">
          <h2>For students</h2>
          <p>Submit a request, see whether it is pending, approved, or ready, and get your document's serial number.</p>
        </section>
        <section class="card">
          <h2>For employers and institutions</h2>
          <p>Enter the serial number printed on a transcript or certificate. No account is needed.</p>
          <a class="btn secondary small" href="#/verify">Verify now</a>
        </section>
      </div>`;
  }

  function viewLogin() {
    if (state.user) { location.hash = state.user.role === 'student' ? '#/student' : '#/staff'; return; }
    app.innerHTML = `
      <section class="card narrow">
        <h1>Log in</h1>
        <p class="lead">Students use their registration number. Staff use their university email.</p>
        <form id="loginForm" novalidate>
          <label for="username">Registration number or email</label>
          <input id="username" name="username" autocomplete="username" required>
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required>
          <div class="form-actions"><button class="btn" type="submit">Log in</button></div>
          <div id="loginMsg"></div>
        </form>
      </section>`;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('loginMsg');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; msg.innerHTML = '';
      try {
        const res = await api('/auth/login', {
          method: 'POST', auth: false,
          body: { username: e.target.elements.username.value, password: e.target.elements.password.value },
        });
        setSession(res.data.token, res.data.user);
        location.hash = res.data.user.role === 'student' ? '#/student' : '#/staff';
      } catch (err) {
        msg.innerHTML = errorBox(err);
        btn.disabled = false;
      }
    });
  }

  // ----- Student -----
  async function viewStudent() {
    if (!state.user) { location.hash = '#/login'; return; }
    if (state.user.role !== 'student') { location.hash = '#/staff'; return; }
    app.innerHTML = `
      <h1>My requests</h1>
      <p class="lead">Welcome, ${esc(state.user.name)}. Submit a new request and follow its progress here.</p>
      <div class="grid-2">
        <section class="card">
          <h2>New request</h2>
          <form id="reqForm" novalidate>
            <label for="documentType">Document</label>
            <select id="documentType" name="documentType">
              ${Object.entries(DOC_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
            <label for="copies">Number of copies</label>
            <input id="copies" name="copies" type="number" min="1" max="5" value="1">
            <div class="hint">Between 1 and 5.</div>
            <label for="deliveryMethod">Delivery</label>
            <select id="deliveryMethod" name="deliveryMethod">
              ${Object.entries(DELIVERY_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
            <label for="reason">Reason for the request</label>
            <textarea id="reason" name="reason" maxlength="200" placeholder="For example: needed for a job application"></textarea>
            <div class="form-actions"><button class="btn" type="submit">Submit request</button></div>
            <div id="reqMsg"></div>
          </form>
        </section>
        <section class="card">
          <h2>Request history</h2>
          <div id="reqList"><p class="empty">Loading...</p></div>
        </section>
      </div>`;

    async function loadList() {
      const box = document.getElementById('reqList');
      try {
        const res = await api('/requests/mine');
        if (!res.data.length) { box.innerHTML = '<p class="empty">You have not made any requests yet.</p>'; return; }
        box.innerHTML = `<div class="table-wrap"><table>
          <thead><tr><th>Document</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>${res.data.map((r) => `
            <tr>
              <td>${esc(DOC_LABELS[r.documentType] || r.documentType)}
                <small>${esc(r.copies)} copy(ies), ${esc(DELIVERY_LABELS[r.deliveryMethod] || r.deliveryMethod)}, ${esc(fmtDate(r.createdAt))}</small></td>
              <td>${badge(r.status)}</td>
              <td>${r.status === 'rejected' ? `Reason: ${esc(r.rejectionReason)}`
                : r.status === 'ready' ? `Serial: <a class="serial" href="#/verify/${esc(r.documentSerial)}">${esc(r.documentSerial)}</a>`
                : r.status === 'approved' ? 'Approved. Being prepared by the registry.'
                : 'Waiting for review.'}</td>
            </tr>`).join('')}
          </tbody></table></div>`;
      } catch (err) { box.innerHTML = errorBox(err); }
    }

    document.getElementById('reqForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('reqMsg');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; msg.innerHTML = '';
      try {
        await api('/requests', {
          method: 'POST',
          body: {
            documentType: e.target.elements.documentType.value,
            copies: e.target.elements.copies.value === '' ? undefined : Number(e.target.elements.copies.value),
            deliveryMethod: e.target.elements.deliveryMethod.value,
            reason: e.target.elements.reason.value,
          },
        });
        msg.innerHTML = successBox('Request submitted. You can track it in the history.');
        e.target.elements.reason.value = '';
        await loadList();
      } catch (err) { msg.innerHTML = errorBox(err); }
      btn.disabled = false;
    });

    loadList();
  }

  // ----- Staff -----
  async function viewStaff() {
    if (!state.user) { location.hash = '#/login'; return; }
    if (state.user.role === 'student') { location.hash = '#/student'; return; }
    app.innerHTML = `
      <h1>Registry desk</h1>
      <p class="lead">Review requests, issue documents, and see everything that has been issued.</p>
      <section class="card">
        <div class="bar" style="padding:0;margin-bottom:.5rem">
          <h2 style="margin:0">Requests</h2>
          <div>
            <label for="statusFilter" class="hint" style="display:inline;margin-right:.4rem">Show</label>
            <select id="statusFilter" style="width:auto;display:inline-block">
              <option value="">All</option><option value="pending" selected>Pending</option>
              <option value="approved">Approved</option><option value="ready">Ready</option><option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div id="staffMsg"></div>
        <div id="staffList"><p class="empty">Loading...</p></div>
      </section>
      <section class="card">
        <h2>Issued documents</h2>
        <div id="docList"><p class="empty">Loading...</p></div>
      </section>`;

    const msg = document.getElementById('staffMsg');
    const filter = document.getElementById('statusFilter');

    async function loadRequests() {
      const box = document.getElementById('staffList');
      try {
        const q = filter.value ? '?status=' + encodeURIComponent(filter.value) : '';
        const res = await api('/requests' + q);
        if (!res.data.length) { box.innerHTML = '<p class="empty">No requests match this filter.</p>'; return; }
        box.innerHTML = `<div class="table-wrap"><table>
          <thead><tr><th>Student</th><th>Request</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${res.data.map((r) => `
            <tr>
              <td>${esc(r.studentName)}<small>${esc(r.registrationNumber)}</small></td>
              <td>${esc(DOC_LABELS[r.documentType] || r.documentType)}
                <small>${esc(r.copies)} copy(ies), ${esc(DELIVERY_LABELS[r.deliveryMethod] || r.deliveryMethod)}, ${esc(fmtDate(r.createdAt))}</small></td>
              <td>${esc(r.reason)}</td>
              <td>${badge(r.status)}${r.status === 'rejected' ? `<small>${esc(r.rejectionReason)}</small>` : ''}</td>
              <td>${r.status === 'pending'
                ? `<div class="actions">
                     <button class="btn small" data-act="approve" data-id="${esc(r.id)}">Approve</button>
                     <button class="btn danger small" data-act="reject-open" data-id="${esc(r.id)}">Reject</button>
                   </div>`
                : r.status === 'approved'
                  ? `<button class="btn small" data-act="issue" data-id="${esc(r.id)}">Issue document</button>`
                  : r.status === 'ready' ? `<span class="serial">${esc(r.documentSerial)}</span>` : ''}</td>
            </tr>
            <tr class="reject-box" id="reject-${esc(r.id)}" hidden>
              <td colspan="5">
                <div class="reject-inline">
                  <input type="text" placeholder="Reason for rejection (required)" maxlength="200" aria-label="Reason for rejection">
                  <button class="btn danger small" data-act="reject-confirm" data-id="${esc(r.id)}">Confirm rejection</button>
                  <button class="btn secondary small" data-act="reject-cancel" data-id="${esc(r.id)}">Cancel</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody></table></div>`;
      } catch (err) { box.innerHTML = errorBox(err); }
    }

    async function loadDocuments() {
      const box = document.getElementById('docList');
      try {
        const res = await api('/documents');
        if (!res.data.length) { box.innerHTML = '<p class="empty">No documents have been issued yet.</p>'; return; }
        box.innerHTML = `<div class="table-wrap"><table>
          <thead><tr><th>Serial</th><th>Student</th><th>Document</th><th>Issued</th></tr></thead>
          <tbody>${res.data.map((d) => `
            <tr>
              <td><a class="serial" href="#/verify/${esc(d.serial)}">${esc(d.serial)}</a></td>
              <td>${esc(d.studentName)}<small>${esc(d.registrationNumber)}</small></td>
              <td>${esc(DOC_LABELS[d.documentType] || d.documentType)}</td>
              <td>${esc(fmtDate(d.issuedAt))}<small>by ${esc(d.issuedBy)}</small></td>
            </tr>`).join('')}
          </tbody></table></div>`;
      } catch (err) { box.innerHTML = errorBox(err); }
    }

    async function refresh() { await Promise.all([loadRequests(), loadDocuments()]); }

    // One click handler for every button in the request table
    document.getElementById('staffList').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const box = document.getElementById('reject-' + id);
      msg.innerHTML = '';

      if (act === 'reject-open') { box.hidden = false; box.querySelector('input').focus(); return; }
      if (act === 'reject-cancel') { box.hidden = true; return; }

      btn.disabled = true;
      try {
        if (act === 'approve') {
          await api(`/requests/${id}/status`, { method: 'PATCH', body: { status: 'approved' } });
          msg.innerHTML = successBox('Request approved. You can now issue the document.');
        } else if (act === 'reject-confirm') {
          const reason = box.querySelector('input').value;
          await api(`/requests/${id}/status`, { method: 'PATCH', body: { status: 'rejected', reason } });
          msg.innerHTML = successBox('Request rejected.');
        } else if (act === 'issue') {
          const res = await api('/documents', { method: 'POST', body: { requestId: id } });
          msg.innerHTML = successBox('Document issued. Serial number: ' + res.data.serial);
        }
        await refresh();
      } catch (err) {
        msg.innerHTML = errorBox(err);
        btn.disabled = false;
      }
    });

    filter.addEventListener('change', loadRequests);
    refresh();
  }

  // ----- Public verification -----
  function viewVerify(prefill) {
    app.innerHTML = `
      <h1>Verify a document</h1>
      <p class="lead">Enter the serial number printed on a MUST transcript or certificate. No login is needed.</p>
      <section class="card">
        <form id="verifyForm" class="verify-form" novalidate>
          <input id="serial" name="serial" placeholder="MUST-TR-2026-A7K93Q" aria-label="Serial number" autocomplete="off" value="${esc(prefill || '')}">
          <button class="btn" type="submit">Verify</button>
        </form>
        <div id="verifyResult" aria-live="polite"></div>
      </section>`;

    const out = document.getElementById('verifyResult');

    async function check(serial) {
      out.innerHTML = '<p class="empty">Checking...</p>';
      try {
        const res = await api('/verify/' + encodeURIComponent(serial.trim()), { auth: false });
        const d = res.data;
        out.innerHTML = `
          <div class="result valid">
            <h3>Valid document</h3>
            <dl>
              <dt>Serial</dt><dd class="serial">${esc(d.serial)}</dd>
              <dt>Student</dt><dd>${esc(d.studentName)}</dd>
              <dt>Registration no.</dt><dd>${esc(d.registrationNumber)}</dd>
              <dt>Programme</dt><dd>${esc(d.program)}</dd>
              <dt>Graduation year</dt><dd>${esc(d.graduationYear)}</dd>
              <dt>Document</dt><dd>${esc(DOC_LABELS[d.documentType] || d.documentType)}</dd>
              <dt>Issued</dt><dd>${esc(fmtDate(d.issuedAt))}</dd>
            </dl>
          </div>`;
      } catch (err) {
        if (err.status === 404) {
          out.innerHTML = `<div class="result invalid"><h3>Not found</h3><p style="margin:0">No document matches this serial number. It may be forged. Please contact the Academic Registrar.</p></div>`;
        } else {
          out.innerHTML = errorBox(err);
        }
      }
    }

    document.getElementById('verifyForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const value = e.target.elements.serial.value.trim();
      if (!value) { out.innerHTML = '<div class="msg error" role="alert">Please enter a serial number.</div>'; return; }
      check(value);
    });
    if (prefill) check(prefill);
  }

  // ---------- Router ----------
  function render() {
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\/?/, '').split('/');
    const route = parts[0] || 'home';
    renderNav(route);
    if (route === 'login') viewLogin();
    else if (route === 'student') viewStudent();
    else if (route === 'staff') viewStaff();
    else if (route === 'verify') viewVerify(parts[1] ? decodeURIComponent(parts[1]) : '');
    else viewHome();
  }

  window.addEventListener('hashchange', render);
  render();
})();
