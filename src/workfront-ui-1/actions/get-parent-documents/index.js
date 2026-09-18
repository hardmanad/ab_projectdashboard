const {
  validateHostname,
  validateToken,
  validateWorkfrontId,
  validateObjCode,
  callWorkfrontApi
} = require('../utils/workfront');

const PARENT_OBJECT_CODES = ['PORT', 'PRGM'];
const PARENT_ID_FIELDS = {
  PORT: 'portfolioID',
  PRGM: 'programID'
};

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const objCodeErr = validateObjCode(params.objCode, PARENT_OBJECT_CODES);
  if (objCodeErr) return { statusCode: 400, body: { error: objCodeErr } };

  const idErr = validateWorkfrontId(params.objID, 'objID');
  if (idErr) return { statusCode: 400, body: { error: idErr } };

  try {
    const parentIdField = PARENT_ID_FIELDS[params.objCode];
    const data = await callWorkfrontApi(params.hostname, params.token, 'document/search', {
      [parentIdField]: params.objID,
      fields: 'ID,name,lastUpdateDate,owner:name,currentVersion:ext,currentVersionID'
    });
    return { statusCode: 200, body: data };
  } catch (err) {
    console.error('get-parent-documents error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;