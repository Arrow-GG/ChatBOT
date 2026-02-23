// Defer DOM access until DOMContentLoaded to avoid timing issues and ensure elements exist
let messagesEl, inputEl, sendBtn, runChatBtn, chatModal, closeChatBtn, floatChatBtn

document.addEventListener('DOMContentLoaded', ()=>{
  try{
  messagesEl = document.getElementById('messages')
  inputEl = document.getElementById('input')
  sendBtn = document.getElementById('send')
  runChatBtn = document.getElementById('runChat')
  chatModal = document.getElementById('chatModal')
  closeChatBtn = document.getElementById('closeChat')
  floatChatBtn = document.getElementById('floatChatBtn')

  // ensure floating button opens modal
  if(floatChatBtn){
    floatChatBtn.addEventListener('click', ()=>{
      if(chatModal) chatModal.setAttribute('aria-hidden','false')
      // focus input when modal opens
      setTimeout(()=>{ if(document.getElementById('input')) document.getElementById('input').focus() }, 150)
    })
  }

  // also ensure hero CTA opens modal
  if(runChatBtn){
    const openChatHandler = (e)=>{
      if(e && e.preventDefault) e.preventDefault()
      console.log('runChat clicked')
      if(chatModal) chatModal.setAttribute('aria-hidden','false')
      else window.location.href = '/chatbot'
      setTimeout(()=>{ if(document.getElementById('input')) document.getElementById('input').focus() }, 150)
    }
    runChatBtn.addEventListener('click', openChatHandler)
    // also assign onclick as fallback
    runChatBtn.onclick = openChatHandler
  }

  // if messages container doesn't exist on the page, skip chat initialization
  if(!messagesEl) return
  }catch(err){console.error('chat init error',err);}


function avatarEl(type, text){
  const a = document.createElement('div')
  a.className = 'avatar ' + (type==='user'? 'user':'assistant')
  a.textContent = type==='user'? 'You':'AD'
  return a
}

function bubbleEl(text, cls){
  const b = document.createElement('div')
  b.className = 'bubble'
  b.textContent = text
  return b
}

// If there's no messages container on this page, only wire the CTA to navigate to the chatbot page
if(!messagesEl){
  if(runChatBtn){
    runChatBtn.addEventListener('click', ()=>{ window.location.href = '/chatbot' })
  }
} else {
  function addMessage(text, from='assistant', opts={}){
    const wrap = document.createElement('div')
    wrap.className = 'msg ' + (from==='user'? 'user':'assistant')
    const avatar = avatarEl(from, text)
    const bubble = bubbleEl(text)
    if(from === 'user'){
      wrap.appendChild(bubble)
      wrap.appendChild(avatar)
    } else {
      wrap.appendChild(avatar)
      wrap.appendChild(bubble)
    }
    messagesEl.appendChild(wrap)
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function showTyping(){
    const wrap = document.createElement('div')
    wrap.className = 'msg assistant typing-row'
    const avatar = avatarEl('assistant')
    const typing = document.createElement('div')
    typing.className = 'bubble'
    const dots = document.createElement('div')
    dots.className = 'typing'
    typing.appendChild(dots)
    wrap.appendChild(avatar)
    wrap.appendChild(typing)
    messagesEl.appendChild(wrap)
    messagesEl.scrollTop = messagesEl.scrollHeight
    return wrap
  }

  async function sendMessage(text){
    if(!text) return
    addMessage(text, 'user')
    inputEl.value = ''
    const typingEl = showTyping()
    try{
      const res = await fetch('/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message:text})})
      const j = await res.json()
      typingEl.remove()
      addMessage(j.reply, 'assistant')
      // If server returned lead payload on confirmation, persist it server-side and optionally let client push to Firebase
      if(j.lead){
        // save to server-side CSV
        fetch('/save_lead', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(j.lead)}).catch(e=>console.warn('save_lead failed',e))
        // if firebase configured, push to Firestore
        if(window.firebaseConfig && window.firebase){
          try{
            if(!firebase.apps.length) firebase.initializeApp(window.firebaseConfig)
            const db = firebase.firestore()
            db.collection('leads').add(j.lead).catch(e=>console.warn('firestore add failed',e))
          }catch(e){console.warn('firebase error',e)}
        }
      }
    }catch(e){
      typingEl.remove()
      addMessage('Sorry, something went wrong. Please try again later.', 'assistant')
    }
  }

  sendBtn.addEventListener('click', ()=> sendMessage(inputEl.value))
  inputEl.addEventListener('keydown', (e)=> { if(e.key==='Enter') sendMessage(inputEl.value) })

    // Start conversation once DOM is ready and messagesEl exists
    ;(async ()=>{
      addMessage('Initializing chat…', 'assistant')
      const res = await fetch('/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message:'__start__'})})
      const j = await res.json()
      // replace initialization message
      messagesEl.innerHTML = ''
      addMessage(j.reply, 'assistant')
    })();

  // Open chat modal from hero CTA
  if(runChatBtn){
    runChatBtn.addEventListener('click', ()=>{
      if(chatModal){
        chatModal.setAttribute('aria-hidden','false')
        // ensure messages container resets if empty
        messagesEl.scrollTop = messagesEl.scrollHeight
      }
    })
  }

  if(closeChatBtn){
    closeChatBtn.addEventListener('click', ()=>{
      if(chatModal) chatModal.setAttribute('aria-hidden','true')
    })
  }

  // Close on ESC
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ if(chatModal) chatModal.setAttribute('aria-hidden','true') } })

  // Auto-open chat modal when visiting /chatbot or using ?chat=1
  try{
    const params = new URLSearchParams(window.location.search)
    if(params.get('chat')==='1' || window.location.pathname === '/chatbot'){
      if(chatModal) chatModal.setAttribute('aria-hidden','false')
      setTimeout(()=>{ if(document.getElementById('input')) document.getElementById('input').focus() }, 150)
    }
  }catch(e){console.warn(e)}
}

// Auto-open chat modal when visiting /chatbot or using ?chat=1
try{
  const params = new URLSearchParams(window.location.search)
  if(params.get('chat')==='1' || window.location.pathname === '/chatbot'){
    if(chatModal) chatModal.setAttribute('aria-hidden','false')
  }
}catch(e){console.warn(e)}
