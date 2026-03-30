// ─── Config ───────────────────────────────────────────────
const AGENT_ID   = 'agent_3901kmy8q67ke5qs7b51whkady4z';
const SHEET_URL  = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// ─── State ────────────────────────────────────────────────
let applicant = { name: '', email: '', mobile: '' };
let conversation = [];
let conversationId = null;
let awaitingReply = false;
let chatEnded = false;

// ─── Step 1: Validate and start ───────────────────────────
function handleStart() {
  const name   = document.getElementById('f-name').value.trim();
  const email  = document.getElementById('f-email').value.trim();
  const mobile = document.getElementById('f-mobile').value.trim();
  const errEl  = document.getElementById('err-msg');

  errEl.style.display = 'none';

  if (!name)                                  return showErr('Please add your name.');
  if (!email || !email.includes('@'))         return showErr('Please enter a valid email address.');
  if (!mobile || mobile.length < 7)           return showErr('Please add your mobile number.');

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

// ─── Chat init ────────────────────────────────────────────
async function initChat() {
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );

    // Use the signed URL approach to start a conversation session
    const data = await res.json();
    conversationId = data.conversation_id || generateId();

    // Send opening context with applicant details, then get first message
    await agentTurn(`The applicant's name is ${applicant.name}. Their email is ${applicant.email} and mobile is ${applicant.mobile}. Please greet them by first name and begin the interview.`, true);

  } catch (err) {
    console.error('Chat init error:', err);
    // Fallback: show opening message directly
    hideLoading();
    appendMessage('agent', `Hey ${applicant.name.split(' ')[0]}, thanks for putting your hand up — really appreciate it. We'll keep this quick, five minutes or so. Just a few questions to get to know you a bit before someone from the team follows up. Ready to go?`);
  }
}

// ─── Send user message ────────────────────────────────────
async function sendMessage() {
  if (awaitingReply || chatEnded) return;

  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  autoResize(input);

  appendMessage('user', text);
  conversation.push({ role: 'user', content: text });

  await agentTurn(text, false);
}

// ─── Get agent reply via ElevenLabs Conversational AI REST ─
async function agentTurn(userText, isSystem) {
  awaitingReply = true;
  setInputEnabled(false);
  showLoading();

  try {
    const messages = buildMessages(userText, isSystem);

    const res = await fetch('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        conversation_id: conversationId,
        messages: messages
      })
    });

    let reply = '';

    if (res.ok) {
      const data = await res.json();
      reply = data.reply || data.message || data.text || '';
    }

    // Fallback to direct LLM call if REST endpoint differs
    if (!reply) {
      reply = await callAgentDirect(messages);
    }

    hideLoading();

    if (reply) {
      appendMessage('agent', reply);
      conversation.push({ role: 'assistant', content: reply });

      // Detect conversation end
      const endPhrases = ["that's everything from me", "be in touch directly", "appreciate you taking the time"];
      if (endPhrases.some(p => reply.toLowerCase().includes(p))) {
        chatEnded = true;
        setInputEnabled(false);
        logToSheet({
          ...applicant,
          stage: 'completed',
          transcript: JSON.stringify(conversation),
          timestamp: new Date().toISOString()
        });
        setTimeout(() => showStep('step-done'), 2000);
        return;
      }
    }

  } catch (err) {
    console.error('Agent turn error:', err);
    hideLoading();
    appendMessage('agent', 'Sorry, something went wrong on our end. Feel free to email us directly at careers@yarntons.co.nz.');
    chatEnded = true;
    setInputEnabled(false);
    return;
  }

  awaitingReply = false;
  setInputEnabled(true);
  document.getElementById('chat-input').focus();
}

// ─── Direct agent API call (primary path) ─────────────────
async function callAgentDirect(messages) {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });

  if (!res.ok) return '';
  const data = await res.json();
  return data.reply || data.message || data.response || data.text || '';
}

// ─── Build message history for API ───────────────────────
function buildMessages(userText, isSystem) {
  const msgs = [];

  // Inject applicant context as first system-style user message
  if (conversation.length === 0) {
    msgs.push({
      role: 'user',
      content: `Context: applicant name is ${applicant.name}, email ${applicant.email}, mobile ${applicant.mobile}.`
    });
  } else {
    for (const m of conversation) {
      msgs.push({ role: m.role, content: m.content });
    }
  }

  if (!isSystem) {
    msgs.push({ role: 'user', content: userText });
  }

  return msgs;
}

// ─── DOM helpers ──────────────────────────────────────────
function appendMessage(role, text) {
  const win  = document.getElementById('chat-window');
  const wrap = document.createElement('div');
  wrap.className = `msg msg-${role}`;

  const label  = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'agent' ? 'Yarntons' : applicant.name.split(' ')[0] || 'You';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  wrap.appendChild(label);
  wrap.appendChild(bubble);
  win.appendChild(wrap);
  win.scrollTop = win.scrollHeight;
}

function showLoading() {
  const loading = document.getElementById('chat-loading');
  if (loading) {
    loading.style.display = 'flex';
    const win = document.getElementById('chat-window');
    win.scrollTop = win.scrollHeight;
  }
}

function hideLoading() {
  const loading = document.getElementById('chat-loading');
  if (loading) loading.style.display = 'none';
}

function setInputEnabled(enabled) {
  const input = document.getElementById('chat-input');
  const send  = document.getElementById('chat-send');
  input.disabled = !enabled;
  send.disabled  = !enabled;
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
  el.textContent = msg;
  el.style.display = 'block';
}

function generateId() {
  return 'conv_' + Math.random().toString(36).slice(2, 11);
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
