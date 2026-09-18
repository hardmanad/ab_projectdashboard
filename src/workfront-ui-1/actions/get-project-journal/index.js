const { validateHostname, validateToken, validateWorkfrontId, callWorkfrontApi } = require('../utils/workfront');

const MAX_LIMIT = 200;

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const idErr = validateWorkfrontId(params.projectId, 'projectId');
  if (idErr) return { statusCode: 400, body: { error: idErr } };

  const limit = Math.min(Math.max(parseInt(params.limit, 10) || MAX_LIMIT, 1), MAX_LIMIT);

  try {
    const data = await callWorkfrontApi(params.hostname, params.token, 'JRNLE/search', {
      projectID: params.projectId,
      projectID_Mod: 'eq',
      fields: '*,editedBy:name',
      '$$LIMIT': limit
    });
    return { statusCode: 200, body: data };
  } catch (err) {
    console.error('get-project-journal error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;
