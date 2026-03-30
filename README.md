# Yarntons — Job Application Page

Two-step experience: applicant reads the role and enters their details, then has a short text conversation with an ElevenLabs AI agent. The full transcript is saved to Google Sheets.

## Files

```
index.html              — the page (role description + form + chat interface)
style.css               — all styles
main.js                 — form logic, ElevenLabs chat, Google Sheets logging
google-apps-script.js   — paste into Google Apps Script (do not commit with real IDs)
```

---

## Setup

### 1. ElevenLabs agent

Agent ID is already set in `main.js`:
```
agent_3901kmy8q67ke5qs7b51whkady4z
```
No further config needed — the agent prompt is managed in ElevenLabs.

### 2. Google Sheet

Create a new Google Sheet. The script will auto-create an `Applications` tab with headers.  
Copy the Sheet ID from the URL (the string between `/d/` and `/edit`).

### 3. Google Apps Script

1. Go to [script.google.com](https://script.google.com) → New project
2. Paste `google-apps-script.js`
3. Replace `YOUR_GOOGLE_SHEET_ID_HERE` with your Sheet ID
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorise when prompted, copy the deployment URL

### 4. Wire it up

In `main.js`, replace:
```js
const SHEET_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
```

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard for auto-deploys on push.

---

## What gets logged to Sheets

| Column | Content |
|---|---|
| Timestamp | ISO datetime |
| Name | From step 1 form |
| Email | From step 1 form |
| Mobile | From step 1 form |
| Stage | `Started` or `Completed` |
| Transcript | Full Q&A formatted as readable text |

Two writes per applicant: one when they start, one when the conversation ends.

---

## Local dev

```bash
npx serve .
```

Note: The ElevenLabs chat requires a live domain. For local testing, use a tunnel like [ngrok](https://ngrok.com) or deploy to Vercel preview.
