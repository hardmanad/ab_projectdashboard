const fetch = require('node-fetch');

const API_VERSION = 'v20.0';

// Only allow requests to known Workfront domains — prevents SSRF
const ALLOWED_HOSTNAME = /^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]+\.(my\.workfront\.adobe\.com|my\.workfront\.com)$/;

// Workfront object IDs are 32-char hex strings
const WF_ID = /^[a-f0-9]{32}$/i;

function validateHostname(hostname) {
  if (!hostname) return 'Missing required parameter: hostname';
  const normalized = hostname.startsWith('http') ? hostname : `https://${hostname}`;
  if (!ALLOWED_HOSTNAME.test(normalized)) return 'Invalid hostname: must be a Workfront domain (*.my.workfront.adobe.com or *.my.workfront.com)';
  return null;
}

function normalizeHostname(hostname) {
  return hostname.startsWith('http') ? hostname : `https://${hostname}`;
}

function validateToken(token) {
  if (!token) return 'Missing required parameter: token';
  return null;
}

function validateWorkfrontId(id, name = 'ID') {
  if (!id) return `Missing required parameter: ${name}`;
  if (!WF_ID.test(id)) return `Invalid ${name}: must be a 32-character hex string`;
  return null;
}

function buildAuthHeaders(token) {
  // IMS JWT tokens start with eyJ; everything else is treated as a WF session token
  if (token.startsWith('eyJ')) {
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  }
  return { 'sessionID': token, 'Content-Type': 'application/json' };
}

async function callWorkfrontApi(hostname, token, endpoint, queryParams = {}) {
  const base = normalizeHostname(hostname);
  const url = new URL(`${base}/attask/api/${API_VERSION}/${endpoint}`);

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value);
    }
  });

  console.log('Workfront API request:', endpoint);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: buildAuthHeaders(token)
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }

  if (!response.ok) {
    const err = new Error(`Workfront API error: ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

module.exports = { validateHostname, validateToken, validateWorkfrontId, callWorkfrontApi };
