async function renderLeadsFromCSV(){
  const el = document.getElementById('leadsArea')
  try{
    const res = await fetch('/leads')
    const data = await res.json()
    if(!data || data.length===0){ el.innerHTML = '<div class="meta">No leads yet.</div>'; return }
    const table = document.createElement('table')
    table.style.width='100%'
    table.style.borderCollapse='collapse'
    const thead = document.createElement('thead')
    thead.innerHTML = '<tr><th style="text-align:left;padding:8px">Timestamp</th><th style="text-align:left;padding:8px">Name</th><th style="text-align:left;padding:8px">Email</th><th style="text-align:left;padding:8px">Phone</th><th style="text-align:left;padding:8px">Service</th><th style="text-align:left;padding:8px">Requirement</th></tr>'
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    data.forEach(r=>{
      const tr = document.createElement('tr')
      tr.innerHTML = `<td style="padding:8px;border-top:1px solid #f1f5f9">${r.timestamp||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.name||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.email||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.phone||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.service||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.requirement||''}</td>`
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    el.innerHTML=''
    el.appendChild(table)
  }catch(e){ el.innerHTML = '<div class="meta">Failed to load leads.</div>' }
}

async function renderLeadsFromFirestore(){
  const el = document.getElementById('leadsArea')
  if(!window.firebaseConfig){
    // fallback
    return renderLeadsFromCSV()
  }
  try{
    firebase.initializeApp(window.firebaseConfig)
    const db = firebase.firestore()
    const snapshot = await db.collection('leads').orderBy('timestamp','desc').get()
    const rows = []
    snapshot.forEach(d=> rows.push(d.data()))
    if(rows.length===0){ el.innerHTML = '<div class="meta">No leads in Firestore.</div>'; return }
    const table = document.createElement('table')
    table.style.width='100%'
    table.style.borderCollapse='collapse'
    const thead = document.createElement('thead')
    thead.innerHTML = '<tr><th style="text-align:left;padding:8px">Timestamp</th><th style="text-align:left;padding:8px">Name</th><th style="text-align:left;padding:8px">Email</th><th style="text-align:left;padding:8px">Phone</th><th style="text-align:left;padding:8px">Service</th><th style="text-align:left;padding:8px">Requirement</th></tr>'
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    rows.forEach(r=>{
      const tr = document.createElement('tr')
      tr.innerHTML = `<td style="padding:8px;border-top:1px solid #f1f5f9">${r.timestamp||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.name||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.email||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.phone||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.service||''}</td><td style="padding:8px;border-top:1px solid #f1f5f9">${r.requirement||''}</td>`
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    el.innerHTML=''
    el.appendChild(table)
  }catch(e){ console.warn(e); return renderLeadsFromCSV() }
}

// Try Firestore first, fallback to CSV
window.addEventListener('load', ()=>{
  if(window.firebaseConfig){
    renderLeadsFromFirestore()
  } else {
    renderLeadsFromCSV()
  }
})
