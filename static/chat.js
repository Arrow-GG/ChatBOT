let messagesEl, inputEl, sendBtn, runChatBtn, chatModal, closeChatBtn, floatChatBtn, quickActionsEl

function avatarEl(type){
  const a = document.createElement('div')
  a.className = 'avatar ' + (type === 'user' ? 'user' : 'assistant')
  a.textContent = type === 'user' ? 'You' : 'AD'
  return a
}

function bubbleEl(text){
  const b = document.createElement('div')
  b.className = 'bubble'
  b.textContent = text
  return b
}

function addMessage(text, from = 'assistant'){
  if(!messagesEl) return
  const wrap = document.createElement('div')
  wrap.className = 'msg ' + (from === 'user' ? 'user' : 'assistant')
  const avatar = avatarEl(from)
  const bubble = bubbleEl(text)
  if(from === 'user'){
    wrap.appendChild(bubble)
    wrap.appendChild(avatar)
  }else{
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
  const bubble = document.createElement('div')
  bubble.className = 'bubble'
  const dots = document.createElement('div')
  dots.className = 'typing'
  bubble.appendChild(dots)
  wrap.appendChild(avatar)
  wrap.appendChild(bubble)
  messagesEl.appendChild(wrap)
  messagesEl.scrollTop = messagesEl.scrollHeight
  return wrap
}

async function sendMessage(text){
  const content = (text || '').trim()
  if(!content) return
  addMessage(content, 'user')
  inputEl.value = ''
  const typingEl = showTyping()
  try{
    const res = await fetch('/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: content})
    })
    const data = await res.json()
    typingEl.remove()
    addMessage(data.reply, 'assistant')
    if(data.lead){
      fetch('/save_lead', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data.lead)
      }).catch(e => console.warn('save_lead failed', e))

      if(window.firebaseConfig && window.firebase){
        try{
          if(!firebase.apps.length) firebase.initializeApp(window.firebaseConfig)
          const db = firebase.firestore()
          db.collection('leads').add(data.lead).catch(e => console.warn('firestore add failed', e))
        }catch(e){
          console.warn('firebase error', e)
        }
      }
    }
  }catch(e){
    typingEl.remove()
    addMessage('Sorry, something went wrong. Please try again later.', 'assistant')
  }
}

function openChatModal(){
  if(chatModal) chatModal.setAttribute('aria-hidden', 'false')
  setTimeout(() => inputEl && inputEl.focus(), 120)
}

function mountQuickActions(){
  if(!quickActionsEl) return
  const prompts = ['Pricing', 'AI chatbot', 'E-commerce', 'Free consultation', 'Restart']
  quickActionsEl.innerHTML = ''
  prompts.forEach(label => {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.addEventListener('click', () => sendMessage(label.toLowerCase()))
    quickActionsEl.appendChild(btn)
  })
}

async function initializeConversation(){
  addMessage('Initializing chat…', 'assistant')
  const res = await fetch('/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({message: '__start__'})
  })
  const data = await res.json()
  messagesEl.innerHTML = ''
  addMessage(data.reply, 'assistant')
}

document.addEventListener('DOMContentLoaded', async () => {
  messagesEl = document.getElementById('messages')
  inputEl = document.getElementById('input')
  sendBtn = document.getElementById('send')
  runChatBtn = document.getElementById('runChat')
  chatModal = document.getElementById('chatModal')
  closeChatBtn = document.getElementById('closeChat')
  floatChatBtn = document.getElementById('floatChatBtn')
  quickActionsEl = document.getElementById('quickActions')

  if(runChatBtn) runChatBtn.addEventListener('click', openChatModal)
  if(floatChatBtn) floatChatBtn.addEventListener('click', openChatModal)
  if(closeChatBtn) closeChatBtn.addEventListener('click', () => chatModal && chatModal.setAttribute('aria-hidden', 'true'))

  if(!messagesEl || !inputEl || !sendBtn) return

  sendBtn.addEventListener('click', () => sendMessage(inputEl.value))
  inputEl.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') sendMessage(inputEl.value)
  })

  mountQuickActions()
  await initializeConversation()

  const params = new URLSearchParams(window.location.search)
  if(params.get('chat') === '1' || window.location.pathname === '/chatbot') openChatModal()

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && chatModal) chatModal.setAttribute('aria-hidden', 'true')
  })
})
