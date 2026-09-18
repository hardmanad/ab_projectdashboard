const fetch = require('node-fetch');

const API_VERSION = 'v20.0';

// Only allow requests to known Workfront tenant domains to prevent SSRF.
const ALLOWED_HOST_SUFFIXES = ['.workfront.adobe.com', '.workfront.com'];
const INVALID_HOSTNAME_MESSAGE = 'Invalid hostname: must be a Workfront domain (*.workfront.adobe.com or *.workfront.com)';

// Workfront object IDs are 32-char hex strings
const WF_ID = /^[a-f0-9]{32}$/i;

function validateHostname(hostname) {
  if (!hostname) return 'Missing required parameter: hostname';
  try {
    const url = new URL(hostname.startsWith('http') ? hostname : `https://${hostname}`);
    const isAllowedHost = ALLOWED_HOST_SUFFIXES.some(suffix => url.hostname.endsWith(suffix));
    if (url.protocol !== 'https:' || !isAllowedHost || url.username || url.password || url.port) {
      return INVALID_HOSTNAME_MESSAGE;
    }
    return null;
  } catch (error) {
    return INVALID_HOSTNAME_MESSAGE;
  }
}

function normalizeHostname(hostname) {
  const url = new URL(hostname.startsWith('http') ? hostname : `https://${hostname}`);
  return url.origin;
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

// Workfront objCodes are short uppercase-letter codes (PROJ, TASK, OPTASK, DOCU, etc.)
const OBJ_CODE = /^[A-Z]{2,10}$/;

function validateObjCode(objCode, allowedCodes) {
  if (!objCode) return 'Missing required parameter: objCode';
  if (!OBJ_CODE.test(objCode)) return 'Invalid objCode: must be an uppercase object code';
  if (allowedCodes && !allowedCodes.includes(objCode)) return `Invalid objCode: must be one of ${allowedCodes.join(', ')}`;
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

module.exports = { validateHostname, validateToken, validateWorkfrontId, validateObjCode, callWorkfrontApi };
