// ─── Yarntons Job Applications — Google Apps Script ───────
//
// SETUP:
// 1. Go to script.google.com → New project
// 2. Paste this entire file
// 3. Replace SHEET_ID with your Google Sheet's ID
// 4. Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the deployment URL → paste into main.js as SHEET_URL

var SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';

function doPost(e) {
  try {
    var data  = JSON.parse(e.postData.contents);
    var stage = data.stage || 'unknown';
    var ss    = SpreadsheetApp.openById(SHEET_ID);

    if (stage === 'started') {
      writeToTab(ss, 'Applications', [
        data.timestamp,
        data.name,
        data.email,
        data.mobile,
        'Started',
        ''
      ], ['Timestamp', 'Name', 'Email', 'Mobile', 'Stage', 'Transcript']);

    } else if (stage === 'completed') {
      var sheet = ss.getSheetByName('Applications');
      if (!sheet) return ok();

      // Find existing row by email and update it, or append new
      var emails = sheet.getRange(2, 3, sheet.getLastRow(), 1).getValues().flat();
      var rowIdx = emails.indexOf(data.email);

      if (rowIdx >= 0) {
        var row = rowIdx + 2;
        sheet.getRange(row, 5).setValue('Completed');
        sheet.getRange(row, 6).setValue(formatTranscript(data.transcript));
      } else {
        sheet.appendRow([
          data.timestamp,
          data.name,
          data.email,
          data.mobile,
          'Completed',
          formatTranscript(data.transcript)
        ]);
      }
    }

    return ok();

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeToTab(ss, tabName, values, headers) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  sheet.appendRow(values);
}

function formatTranscript(raw) {
  if (!raw) return '';
  try {
    var msgs = JSON.parse(raw);
    return msgs.map(function(m) {
      return (m.role === 'assistant' ? 'Yarntons' : 'Applicant') + ': ' + m.content;
    }).join('\n\n');
  } catch (e) {
    return raw;
  }
}

function ok() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Test runner ──────────────────────────────────────────
function testStarted() {
  doPost({ postData: { contents: JSON.stringify({
    stage: 'started', name: 'Test Person', email: 'test@example.com',
    mobile: '021 000 0000', timestamp: new Date().toISOString()
  })}});
}

function testCompleted() {
  doPost({ postData: { contents: JSON.stringify({
    stage: 'completed', name: 'Test Person', email: 'test@example.com',
    mobile: '021 000 0000', timestamp: new Date().toISOString(),
    transcript: JSON.stringify([
      { role: 'assistant', content: 'Hey Test, great to meet you.' },
      { role: 'user', content: 'Hi, I live in Birkenhead actually.' }
    ])
  })}});
}
