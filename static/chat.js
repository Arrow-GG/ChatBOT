let messagesEl;
let inputEl;
let sendBtn;
let chatModal;
let closeChatBtn;
let chatStarted = false;
let isSending = false;

function escapeHtml(text) {
  return (text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function addMessage(text, from) {
  if (!messagesEl) return;
  const row = document.createElement('div');
  row.className = `msg ${from}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = escapeHtml(text);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
  if (!messagesEl) return null;
  const row = document.createElement('div');
  row.className = 'msg assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const dots = document.createElement('div');
  dots.className = 'typing';
  bubble.appendChild(dots);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function setModalOpen(open) {
  if (!chatModal) return;
  chatModal.setAttribute('data-open', open ? 'true' : 'false');
  chatModal.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle('chat-open', open);
  if (open && inputEl) {
    setTimeout(() => inputEl.focus(), 100);
    if (!chatStarted) {
      startChat();
    }
  }
}

async function persistLead(lead) {
  try {
    await fetch('/save_lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
  } catch (err) {
    console.warn('save_lead failed', err);
  }

  if (window.firebaseConfig && window.firebase) {
    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(window.firebaseConfig);
      }
      const db = window.firebase.firestore();
      await db.collection('leads').add(lead);
    } catch (err) {
      console.warn('firebase mirror failed', err);
    }
  }
}

async function sendMessage(text) {
  const trimmed = (text || '').trim();
  if (!trimmed || isSending) return;
  isSending = true;
  addMessage(trimmed, 'user');
  if (inputEl) inputEl.value = '';

  const typingEl = showTyping();
  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed }),
    });
    const payload = await res.json();
    if (typingEl) typingEl.remove();
    addMessage(payload.reply || 'Thanks. Please continue.', 'assistant');
    if (payload.lead) {
      persistLead(payload.lead);
    }
  } catch (err) {
    if (typingEl) typingEl.remove();
    addMessage('Request failed. Please try again in a moment.', 'assistant');
  }
  isSending = false;
}

async function startChat() {
  if (!messagesEl || chatStarted) return;
  chatStarted = true;
  const typingEl = showTyping();
  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '__start__' }),
    });
    const payload = await res.json();
    if (typingEl) typingEl.remove();
    addMessage(payload.reply || 'Hello. How can I help?', 'assistant');
  } catch (err) {
    if (typingEl) typingEl.remove();
    addMessage('Chat is temporarily unavailable.', 'assistant');
  }
}

function bindOpeners() {
  const openers = [
    document.getElementById('runChat'),
    document.getElementById('floatChatBtn'),
    ...Array.from(document.querySelectorAll('.js-open-chat')),
  ].filter(Boolean);

  openers.forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      if (!chatModal) {
        window.location.href = '/chatbot';
        return;
      }
      setModalOpen(true);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  messagesEl = document.getElementById('messages');
  inputEl = document.getElementById('input');
  sendBtn = document.getElementById('send');
  chatModal = document.getElementById('chatModal');
  closeChatBtn = document.getElementById('closeChat');

  bindOpeners();

  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => setModalOpen(false));
  }

  if (chatModal) {
    chatModal.addEventListener('click', (event) => {
      if (event.target === chatModal) {
        setModalOpen(false);
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setModalOpen(false);
    }
  });

  if (sendBtn && inputEl) {
    sendBtn.addEventListener('click', () => sendMessage(inputEl.value));
    inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        sendMessage(inputEl.value);
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  if (window.location.pathname === '/chatbot' || params.get('chat') === '1') {
    setModalOpen(true);
  }
});
