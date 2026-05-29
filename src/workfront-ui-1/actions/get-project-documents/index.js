const { validateHostname, validateToken, validateWorkfrontId, callWorkfrontApi } = require('../utils/workfront');

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const idErr = validateWorkfrontId(params.projectId, 'projectId');
  if (idErr) return { statusCode: 400, body: { error: idErr } };

  try {
    const data = await callWorkfrontApi(params.hostname, params.token, 'document/search', {
      docObjCode: 'PROJ',
      docObjCode_Mod: 'eq',
      objID: params.projectId,
      objID_Mod: 'eq',
      fields: '*,owner:name,currentVersion:ext,currentVersionID'
    });
    return { statusCode: 200, body: data };
  } catch (err) {
    console.error('get-project-documents error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;
