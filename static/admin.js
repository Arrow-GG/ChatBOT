function escapeHtml(value){
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderRows(el, rows){
  if(!rows || rows.length === 0){
    el.innerHTML = '<div class="meta">No leads yet.</div>'
    return
  }

  const table = document.createElement('table')
  table.className = 'data-table'
  table.innerHTML = `
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Name</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Service</th>
        <th>Requirement</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${escapeHtml(r.timestamp)}</td>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.email)}</td>
          <td>${escapeHtml(r.phone)}</td>
          <td>${escapeHtml(r.service)}</td>
          <td>${escapeHtml(r.requirement)}</td>
        </tr>
      `).join('')}
    </tbody>
  `

  el.innerHTML = ''
  el.appendChild(table)
}

async function renderLeadsFromCSV(){
  const el = document.getElementById('leadsArea')
  try{
    const res = await fetch('/leads')
    const data = await res.json()
    renderRows(el, data)
  }catch(e){
    el.innerHTML = '<div class="meta">Failed to load leads from CSV.</div>'
  }
}

async function renderLeadsFromFirestore(){
  const el = document.getElementById('leadsArea')
  if(!window.firebaseConfig){
    return renderLeadsFromCSV()
  }

  try{
    if(!firebase.apps.length) firebase.initializeApp(window.firebaseConfig)
    const db = firebase.firestore()
    const snapshot = await db.collection('leads').orderBy('timestamp', 'desc').get()
    const rows = []
    snapshot.forEach(doc => rows.push(doc.data()))
    renderRows(el, rows)
  }catch(e){
    console.warn(e)
    return renderLeadsFromCSV()
  }
}

window.addEventListener('load', () => {
  if(window.firebaseConfig){
    renderLeadsFromFirestore()
  }else{
    renderLeadsFromCSV()
  }
})
