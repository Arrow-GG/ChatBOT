function escapeHtml(text) {
  return (text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTable(rows) {
  const body = rows
    .map((r) => {
      return `<tr>
        <td>${escapeHtml(r.timestamp)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.phone)}</td>
        <td>${escapeHtml(r.service)}</td>
        <td>${escapeHtml(r.source)}</td>
        <td>${escapeHtml(r.requirement)}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Service</th>
            <th>Source</th>
            <th>Requirement</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function formatDate(isoDate) {
  if (!isoDate) return 'No records';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleString();
}

function ensureAuthorized(res) {
  if (res.status === 401) {
    window.location.href = '/admin/login';
    return false;
  }
  return true;
}

function renderMetrics(metrics) {
  const el = document.getElementById('metricsArea');
  if (!el) return;
  const sources = Array.isArray(metrics.lead_sources)
    ? metrics.lead_sources
        .map((s) => `<span>${escapeHtml(s.source)}: ${s.total}</span>`)
        .join('')
    : '';

  el.innerHTML = `
    <article class="metric-card"><h3>${metrics.lead_total ?? 0}</h3><p>Total Leads</p></article>
    <article class="metric-card"><h3>${metrics.chat_event_total ?? 0}</h3><p>Chat Events</p></article>
    <article class="metric-card"><h3>${metrics.chat_sessions ?? 0}</h3><p>Chat Sessions</p></article>
    <article class="metric-card"><h3>${escapeHtml(formatDate(metrics.latest_lead_at))}</h3><p>Latest Lead</p></article>
    <article class="metric-card metric-wide"><h3>Lead Sources</h3><div class="metric-tags">${sources || '<span>No source data yet</span>'}</div></article>
  `;
}

async function loadMetrics() {
  try {
    const res = await fetch('/metrics');
    if (!ensureAuthorized(res)) return;
    if (!res.ok) {
      throw new Error(`Failed with status ${res.status}`);
    }
    const metrics = await res.json();
    renderMetrics(metrics);
  } catch (err) {
    const el = document.getElementById('metricsArea');
    if (el) {
      el.innerHTML = '<div class="helper">Failed to load metrics.</div>';
    }
  }
}

async function loadLeads() {
  const el = document.getElementById('leadsArea');
  if (!el) return;

  try {
    const res = await fetch('/leads');
    if (!ensureAuthorized(res)) return;
    if (!res.ok) {
      throw new Error(`Failed with status ${res.status}`);
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      el.innerHTML = '<div class="helper">No leads captured yet.</div>';
      return;
    }
    el.innerHTML = renderTable(rows);
  } catch (err) {
    el.innerHTML = '<div class="helper">Failed to load lead records.</div>';
  }
}

window.addEventListener('load', () => {
  loadMetrics();
  loadLeads();
});
