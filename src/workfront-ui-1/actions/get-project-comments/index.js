const { validateHostname, validateToken, validateWorkfrontId, callWorkfrontApi } = require('../utils/workfront');

const MAX_LIMIT = 50;

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const idErr = validateWorkfrontId(params.projectId, 'projectId');
  if (idErr) return { statusCode: 400, body: { error: idErr } };

  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 10, 1), MAX_LIMIT);
  const offset = Math.max(parseInt(params.offset, 10) || 0, 0);

  try {
    const data = await callWorkfrontApi(params.hostname, params.token, 'note/search', {
      projectID: params.projectId,
      projectID_Mod: 'eq',
      fields: '*,owner:name,opTask:name,task:name,project:name',
      '$$LIMIT': limit,
      '$$FIRST': offset
    });
    return { statusCode: 200, body: data };
  } catch (err) {
    console.error('get-project-comments error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;
