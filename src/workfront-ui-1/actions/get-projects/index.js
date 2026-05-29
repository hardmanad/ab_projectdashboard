const { validateHostname, validateToken, callWorkfrontApi } = require('../utils/workfront');

// Workfront status codes are short alphanumeric strings (built-in or custom)
const VALID_STATUS = /^[A-Za-z0-9_]{1,20}$/;

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const statusFilter = params.statusFilter || [];
  if (!Array.isArray(statusFilter)) {
    return { statusCode: 400, body: { error: 'statusFilter must be an array' } };
  }
  for (const s of statusFilter) {
    if (!VALID_STATUS.test(s)) {
      return { statusCode: 400, body: { error: `Invalid status value: ${s}` } };
    }
  }

  try {
    const queryParams = {
      fields: '*,owner:name,portfolio:name,program:name,group:name,company:name',
      '$$LIMIT': 1000
    };

    if (statusFilter.length === 1) {
      queryParams.status = statusFilter[0];
      queryParams.status_Mod = 'eq';
    } else if (statusFilter.length > 1) {
      statusFilter.forEach((status, i) => {
        queryParams[`OR:${i + 1}:status`] = status;
        queryParams[`OR:${i + 1}:status_Mod`] = 'eq';
      });
    }

    const data = await callWorkfrontApi(params.hostname, params.token, 'project/search', queryParams);
    return { statusCode: 200, body: data };
  } catch (err) {
    console.error('get-projects error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;
