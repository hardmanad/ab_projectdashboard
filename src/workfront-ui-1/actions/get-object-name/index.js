const { validateHostname, validateToken, validateWorkfrontId, validateObjCode, callWorkfrontApi } = require('../utils/workfront');

// objCodes a note can be attached to (mirrors noteObjCode values we resolve on the frontend)
const ALLOWED_OBJ_CODES = ['PROJ', 'TASK', 'OPTASK', 'DOCU', 'TMPL', 'TTSK', 'USER'];

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const objCodeErr = validateObjCode(params.objCode, ALLOWED_OBJ_CODES);
  if (objCodeErr) return { statusCode: 400, body: { error: objCodeErr } };

  const idErr = validateWorkfrontId(params.objID, 'objID');
  if (idErr) return { statusCode: 400, body: { error: idErr } };

  try {
    const data = await callWorkfrontApi(params.hostname, params.token, `${params.objCode}/${params.objID}`, {
      fields: 'name'
    });
    return { statusCode: 200, body: data };
  } catch (err) {
    console.error('get-object-name error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;
