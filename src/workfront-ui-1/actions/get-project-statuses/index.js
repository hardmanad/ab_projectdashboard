const { validateHostname, validateToken, callWorkfrontApi } = require('../utils/workfront');

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  try {
    const data = await callWorkfrontApi(params.hostname, params.token, 'CSTEM/search', {
      fields: '*',
      enumClass: 'STATUS_PROJ',
      '$$LIMIT': 2000
    });
    return { statusCode: 200, body: data };
  } catch (err) {
    console.error('get-project-statuses error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;
