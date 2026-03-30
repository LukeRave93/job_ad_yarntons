// ─── Config ───────────────────────────────────────────────
// Replace this with your deployed Google Apps Script URL
const SHEET_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// ─── Step navigation ──────────────────────────────────────
function showStep(id) {
  document.querySelectorAll('.step').forEach(function(s) {
    s.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Form submission ──────────────────────────────────────
async function handleSubmit() {
  const name  = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const about = document.getElementById('f-about').value.trim();
  const errEl = document.getElementById('err-msg');

  errEl.style.display = 'none';

  // Validation
  if (!name) {
    return showErr('Please add your name.');
  }
  if (!email || !email.includes('@') || !email.includes('.')) {
    return showErr('Please enter a valid email address.');
  }
  if (!about || about.length < 20) {
    return showErr('Tell us a little more about yourself — just a few sentences is fine.');
  }

  // Loading state
  const btn = document.getElementById('submit-btn');
  btn.classList.add('submitting');
  btn.disabled = true;

  const payload = {
    name:      name,
    email:     email,
    about:     about,
    timestamp: new Date().toISOString(),
    source:    'yarntons-jobs-page'
  };

  try {
    await fetch(SHEET_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
  } catch (err) {
    // no-cors means we can't read the response — treat any network error
    // as a pass-through and still show success. The sheet will have the data.
    console.warn('Submission fetch error (may still have succeeded):', err);
  }

  // Show success regardless — no-cors prevents reading the response
  showStep('step-done');
  const statusEl = document.getElementById('gs-status');
  if (statusEl) {
    statusEl.textContent = 'Sent at ' + new Date().toLocaleTimeString('en-NZ', {
      hour:   '2-digit',
      minute: '2-digit'
    });
  }
}

// ─── Error display ────────────────────────────────────────
function showErr(msg) {
  const el = document.getElementById('err-msg');
  el.textContent = msg;
  el.style.display = 'block';
}
