// ─── Yarntons Job Applications — Google Apps Script ───────
//
// SETUP:
// 1. Go to script.google.com → New project
// 2. Paste this entire file in
// 3. Replace SHEET_ID below with your Google Sheet's ID
//    (the long string in the sheet URL between /d/ and /edit)
// 4. Click Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the deployment URL and paste it into main.js as SHEET_URL

var SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
var SHEET_TAB = 'Applications'; // name of the tab in your sheet

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_TAB);

    // Create header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Email', 'About', 'Source']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name      || '',
      data.email     || '',
      data.about     || '',
      data.source    || 'direct'
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test this by running it manually in the Apps Script editor:
function testPost() {
  var mock = {
    postData: {
      contents: JSON.stringify({
        name:      'Test Person',
        email:     'test@example.com',
        about:     'This is a test submission from the Apps Script editor.',
        timestamp: new Date().toISOString(),
        source:    'test'
      })
    }
  };
  var result = doPost(mock);
  Logger.log(result.getContent());
}
