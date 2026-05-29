const { validateHostname, validateToken, validateWorkfrontId, callWorkfrontApi } = require('../utils/workfront');

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const idErr = validateWorkfrontId(params.projectId, 'projectId');
  if (idErr) return { statusCode: 400, body: { error: idErr } };

  try {
    const data = await callWorkfrontApi(params.hostname, params.token, `project/${params.projectId}`, {
      fields: '*,owner:name,portfolio:name,program:name,group:name,company:name'
    });
    return { statusCode: 200, body: data };
  } catch (err) {
    console.error('get-project error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;
