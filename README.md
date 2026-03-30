# Yarntons — Job Application Page

Simple two-step job application page. Collects name, email, and a short about-me, writes to a Google Sheet.

## Files

```
index.html              — the page
style.css               — all styles
main.js                 — form logic and step navigation
google-apps-script.js   — paste this into Google Apps Script (not uploaded to GitHub)
```

---

## Setup

### 1. Google Sheet

Create a new Google Sheet. Name the first tab `Applications`.  
Copy the Sheet ID from the URL — it's the string between `/d/` and `/edit`.

### 2. Google Apps Script

1. Go to [script.google.com](https://script.google.com) → New project
2. Paste the contents of `google-apps-script.js`
3. Replace `YOUR_GOOGLE_SHEET_ID_HERE` with your Sheet ID
4. Click **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorise when prompted
6. Copy the deployment URL

### 3. Connect the form

In `main.js`, replace:
```js
const SHEET_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
```
with your deployment URL.

### 4. Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# From the project folder
vercel

# Follow the prompts — framework: Other, output directory: ./
# On subsequent deploys:
vercel --prod
```

Or connect your GitHub repo in the Vercel dashboard for automatic deploys on push.

---

## Local development

No build step needed. Just open `index.html` in a browser, or run:

```bash
npx serve .
```
