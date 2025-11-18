const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1uvi-6MCuvjbYEuqUn-FMyoxjZks_nUWKLdnYTZ9evuQ/edit';
const SHEET_NAME = 'Form Responses 1';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function doGet() {
  return buildTextResponse_(true, 'RSVP endpoint is running.');
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return buildTextResponse_(false, 'Invalid request body.');
  }

  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    return buildTextResponse_(false, 'Body must be valid JSON.');
  }

  const normalized = normalizePayload_(payload);
  if (!normalized.success) {
    return buildTextResponse_(false, normalized.errorMessage);
  }

  try {
    appendRsvpRow_(normalized.data);
    return buildTextResponse_(true, 'RSVP saved successfully.');
  } catch (error) {
    return buildTextResponse_(false, 'Failed to write RSVP: ' + error.message);
  }
}

function normalizePayload_(payload) {
  if (typeof payload !== 'object' || payload === null) {
    return { success: false, errorMessage: 'Body must be a JSON object.' };
  }

  const guestName = (payload.GuestName || payload.guestName || '').toString().trim();
  const attendingRaw = payload.Attending ?? payload.attending;

  if (!guestName) {
    return { success: false, errorMessage: 'GuestName is required.' };
  }

  if (attendingRaw === undefined || attendingRaw === null) {
    return { success: false, errorMessage: 'Attending status is required.' };
  }

  const attending = parseAttending_(attendingRaw);
  if (attending === null) {
    return { success: false, errorMessage: 'Attending must be yes/no, true/false, or 1/0.' };
  }

  return {
    success: true,
    data: {
      timestamp: new Date(),
      guestName,
      attending
    }
  };
}

function parseAttending_(value) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    if (value === 1) return 'Yes';
    if (value === 0) return 'No';
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['yes', 'y', 'true', '1'].indexOf(normalized) >= 0) {
      return 'Yes';
    }
    if (['no', 'n', 'false', '0'].indexOf(normalized) >= 0) {
      return 'No';
    }
  }

  return null;
}

function appendRsvpRow_(rsvp) {
  const sheet = SpreadsheetApp.openByUrl(SHEET_URL).getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet "' + SHEET_NAME + '" was not found.');
  }

  sheet.appendRow([
    rsvp.timestamp,
    rsvp.guestName,
    rsvp.attending
  ]);
}

function buildTextResponse_(success, message) {
  const output = ContentService
    .createTextOutput(JSON.stringify({ success, message }))
    .setMimeType(ContentService.MimeType.JSON);

  for (var header in CORS_HEADERS) {
    if (CORS_HEADERS.hasOwnProperty(header)) {
      output.setHeader(header, CORS_HEADERS[header]);
    }
  }

  return output;
}
