// ─── Config ───────────────────────────────────────────────
const AGENT_ID  = 'agent_3901kmy8q67ke5qs7b51whkady4z';
const SHEET_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// ─── State ────────────────────────────────────────────────
let applicant    = { name: '', email: '', mobile: '' };
let conversation = [];
let convSession  = null;
let chatEnded    = false;
let chatMode     = 'text'; // 'text' | 'voice'

// ─── Step 1: Validate and proceed ─────────────────────────
function handleStart(mode) {
  const name   = document.getElementById('f-name').value.trim();
  const email  = document.getElementById('f-email').value.trim();
  const mobile = document.getElementById('f-mobile').value.trim();
  const errEl  = document.getElementById('err-msg');

  errEl.style.display = 'none';

  if (!name)                          return showErr('Please add your name.');
  if (!email || !email.includes('@')) return showErr('Please enter a valid email address.');
  if (!mobile || mobile.length < 7)   return showErr('Please add your mobile number.');

  applicant = { name, email, mobile };
  chatMode  = mode;

  logToSheet({ ...applicant, mode, stage: 'started', timestamp: new Date().toISOString() });

  showStep('step-chat');
  setupChatUI(mode);
  initChat(mode);
}

// ─── Step navigation ──────────────────────────────────────
function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Configure UI for chosen mode ─────────────────────────
function setupChatUI(mode) {
  const textRow  = document.getElementById('text-input-row');
  const voiceRow = document.getElementById('voice-row');
  const status   = document.getElementById('chat-status-text');

  if (mode === 'voice') {
    textRow.style.display  = 'none';
    voiceRow.style.display = 'flex';
    status.textContent     = 'Connecting...';
  } else {
    textRow.style.display  = 'flex';
    voiceRow.style.display = 'none';
    status.textContent     = 'Connecting...';
  }
}

// ─── Init ElevenLabs session ───────────────────────────────
async function initChat(mode) {
  showLoading();
  setInputEnabled(false);

  try {
    // UMD global is window.client — confirmed from lib.umd.js source: e.Conversation = x
    const Conversation = window.client && window.client.Conversation;
    if (!Conversation) throw new Error('ElevenLabs SDK not loaded — check CDN script');

    convSession = await Conversation.startSession({
      agentId: AGENT_ID,

      overrides: {
        conversation: { textOnly: mode === 'text' }
      },

      dynamicVariables: {
        applicant_name:   applicant.name,
        applicant_email:  applicant.email,
        applicant_mobile: applicant.mobile
      },

      onConnect: () => {
        hideLoading();
        document.getElementById('chat-status-text').textContent = 'Ready to chat';
        if (mode === 'text') {
          setInputEnabled(true);
          document.getElementById('chat-input').focus();
        } else {
          // Voice mode — orb shows listening state
          setVoiceState('listening');
        }
      },

      onDisconnect: () => {
        if (!chatEnded) {
          document.getElementById('chat-status-text').textContent = 'Disconnected';
          if (mode === 'voice') setVoiceState('idle');
        }
      },

      onModeChange: (data) => {
        // Voice mode: update orb based on whether agent is speaking or listening
        if (mode === 'voice') {
          setVoiceState(data.mode === 'speaking' ? 'speaking' : 'listening');
        }
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
            if (mode === 'text') setInputEnabled(false);
            if (mode === 'voice') setVoiceState('idle');
            logToSheet({
              ...applicant,
              mode,
              stage: 'completed',
              transcript: formatTranscript(conversation),
              timestamp: new Date().toISOString()
            });
            setTimeout(() => showStep('step-done'), 2200);
          } else {
            if (mode === 'text') setInputEnabled(true);
          }
        }

        // Voice mode: also show user transcripts in the chat window
        if (msg.source === 'user' && mode === 'voice' && msg.message) {
          appendMessage('user', msg.message);
          conversation.push({ role: 'user', content: msg.message });
        }
      },

      onError: (err) => {
        console.error('ElevenLabs error:', err);
        hideLoading();
        appendMessage('agent', 'Something went wrong on our end — feel free to email us at careers@yarntons.co.nz.');
        if (mode === 'text') setInputEnabled(false);
        if (mode === 'voice') setVoiceState('idle');
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

function setVoiceState(state) {
  const orb  = document.getElementById('voice-orb');
  const hint = document.getElementById('voice-hint');
  if (!orb) return;
  orb.className = 'voice-orb voice-orb--' + state;
  hint.textContent = state === 'speaking' ? 'Yarntons is speaking...' : 'Listening — just talk';
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
