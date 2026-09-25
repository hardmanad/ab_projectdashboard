const {
  validateHostname,
  validateToken,
  validateWorkfrontId,
  validateObjCode,
  callWorkfrontApi
} = require('../utils/workfront');

const PARENT_OBJECT_CODES = ['PORT', 'PRGM', 'PROJ'];
const PARENT_ID_FIELDS = {
  PORT: 'portfolioID',
  PRGM: 'programID',
  PROJ: 'projectID'
};

async function addVersionMetadata(hostname, token, document) {
  if (!document.currentVersionID) {
    return { ...document, aemurn: null, externalStorageID: null };
  }

  try {
    const version = await callWorkfrontApi(hostname, token, `docv/${document.currentVersionID}`, {
      fields: 'aemurn,externalStorageID'
    }, 'unsupported');
    const versionData = version.data || version;
    return {
      ...document,
      aemurn: versionData.aemurn || null,
      externalStorageID: versionData.externalStorageID || null,
      currentVersion: {
        ...(document.currentVersion || {}),
        externalStorageID: versionData.externalStorageID || null
      }
    };
  } catch (err) {
    console.warn(`Unable to load metadata for document version ${document.currentVersionID}:`, err.message);
    return { ...document, aemurn: null, externalStorageID: null };
  }
}

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
      fields: '*,owner:name,currentVersion:ext,currentVersionID'
    });
    console.log('[Custom documents]', JSON.stringify({
      parentObjectCode: params.objCode,
      parentId: params.objID,
      documentCount: (data.data || []).length,
      documents: (data.data || []).map(document => ({
        documentId: document.ID,
        currentVersionID: document.currentVersionID
      }))
    }));
    const documents = await Promise.all((data.data || []).map(document => (
      addVersionMetadata(params.hostname, params.token, document)
    )));
    console.log('[Custom document AEM metadata]', JSON.stringify((documents || []).map(document => ({
      documentId: document.ID,
      currentVersionID: document.currentVersionID,
      aemurn: document.aemurn || null,
      externalStorageID: document.externalStorageID || null
    }))));
    return { statusCode: 200, body: { ...data, data: documents } };
  } catch (err) {
    console.error('get-custom-documents error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;