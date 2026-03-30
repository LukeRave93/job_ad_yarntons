// ─── Config ───────────────────────────────────────────────
const AGENT_ID  = 'agent_3901kmy8q67ke5qs7b51whkady4z';
const SHEET_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// ─── State ────────────────────────────────────────────────
let applicant    = { name: '', email: '', mobile: '' };
let conversation = [];
let convSession  = null;   // ElevenLabs Conversation instance
let chatEnded    = false;

// ─── Step 1: Validate and proceed ─────────────────────────
function handleStart() {
  const name   = document.getElementById('f-name').value.trim();
  const email  = document.getElementById('f-email').value.trim();
  const mobile = document.getElementById('f-mobile').value.trim();
  const errEl  = document.getElementById('err-msg');

  errEl.style.display = 'none';

  if (!name)                         return showErr('Please add your name.');
  if (!email || !email.includes('@')) return showErr('Please enter a valid email address.');
  if (!mobile || mobile.length < 7)  return showErr('Please add your mobile number.');

  applicant = { name, email, mobile };
  logToSheet({ ...applicant, stage: 'started', timestamp: new Date().toISOString() });

  showStep('step-chat');
  initChat();
}

// ─── Step navigation ──────────────────────────────────────
function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Init ElevenLabs text-only session ────────────────────
async function initChat() {
  showLoading();
  setInputEnabled(false);

  try {
    // UMD global is window.client — confirmed from lib.umd.js source: e.Conversation = x
    const Conversation = window.client && window.client.Conversation;
    if (!Conversation) throw new Error('ElevenLabs SDK not loaded — check CDN script');

    convSession = await Conversation.startSession({
      agentId: AGENT_ID,

      // textOnly must go through overrides.conversation.textOnly per SDK source
      overrides: {
        conversation: { textOnly: true }
      },

      // dynamicVariables are passed to the agent — define matching {{variable}} in the agent prompt
      dynamicVariables: {
        applicant_name:   applicant.name,
        applicant_email:  applicant.email,
        applicant_mobile: applicant.mobile
      },

      onConnect: () => {
        hideLoading();
        setInputEnabled(true);
        document.getElementById('chat-input').focus();
      },

      onDisconnect: () => {
        if (!chatEnded) setInputEnabled(false);
      },

      onMessage: (msg) => {
        if (msg.source === 'ai') {
          hideLoading();
          appendMessage('agent', msg.message);
          conversation.push({ role: 'assistant', content: msg.message });

          const endPhrases = [
            "that's everything from me",
            "be in touch directly",
            "appreciate you taking the time"
          ];

          if (endPhrases.some(p => msg.message.toLowerCase().includes(p))) {
            chatEnded = true;
            setInputEnabled(false);
            logToSheet({
              ...applicant,
              stage: 'completed',
              transcript: formatTranscript(conversation),
              timestamp: new Date().toISOString()
            });
            setTimeout(() => showStep('step-done'), 2200);
          }
        }
      },

      onError: (err) => {
        console.error('ElevenLabs error:', err);
        hideLoading();
        appendMessage('agent', 'Something went wrong on our end — feel free to email us at careers@yarntons.co.nz.');
        setInputEnabled(false);
        chatEnded = true;
      }
    });

  } catch (err) {
    console.error('Session start error:', err);
    hideLoading();
    appendMessage('agent', `Hey ${firstName()}, something went wrong connecting to our chat. Please email us at careers@yarntons.co.nz and we'll be in touch.`);
    setInputEnabled(false);
  }
}

// ─── Send user message ────────────────────────────────────
async function sendMessage() {
  if (chatEnded || !convSession) return;

  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  autoResize(input);

  appendMessage('user', text);
  conversation.push({ role: 'user', content: text });

  setInputEnabled(false);
  showLoading();

  try {
    // sendUserMessage is the correct SDK method for text-only conversations
    await convSession.sendUserMessage(text);
  } catch (err) {
    console.error('sendUserMessage error:', err);
    hideLoading();
    appendMessage('agent', 'Sorry, that message didn\'t go through. Try again?');
    setInputEnabled(true);
  }
}

// ─── DOM helpers ──────────────────────────────────────────
function appendMessage(role, text) {
  const win    = document.getElementById('chat-window');
  const wrap   = document.createElement('div');
  wrap.className = `msg msg-${role}`;

  const label  = document.createElement('div');
  label.className   = 'msg-label';
  label.textContent = role === 'agent' ? 'Yarntons' : firstName();

  const bubble = document.createElement('div');
  bubble.className   = 'msg-bubble';
  bubble.textContent = text;

  wrap.appendChild(label);
  wrap.appendChild(bubble);
  win.appendChild(wrap);
  win.scrollTop = win.scrollHeight;
}

function showLoading() {
  const el = document.getElementById('chat-loading');
  if (el) {
    el.style.display = 'flex';
    document.getElementById('chat-window').scrollTop = 9999;
  }
}

function hideLoading() {
  const el = document.getElementById('chat-loading');
  if (el) el.style.display = 'none';
}

function setInputEnabled(enabled) {
  document.getElementById('chat-input').disabled = !enabled;
  document.getElementById('chat-send').disabled  = !enabled;
  if (enabled) document.getElementById('chat-input').focus();
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function showErr(msg) {
  const el = document.getElementById('err-msg');
  el.textContent  = msg;
  el.style.display = 'block';
}

function firstName() {
  return (applicant.name || 'You').split(' ')[0];
}

function formatTranscript(msgs) {
  return msgs
    .map(m => `${m.role === 'assistant' ? 'Yarntons' : applicant.name}: ${m.content}`)
    .join('\n\n');
}

// ─── Google Sheets logging ────────────────────────────────
async function logToSheet(payload) {
  if (!SHEET_URL || SHEET_URL.includes('YOUR_')) return;
  try {
    await fetch(SHEET_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('Sheet log failed:', e);
  }
}
