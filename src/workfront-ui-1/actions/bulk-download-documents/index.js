const JSZip = require('jszip');
const { init: initFiles } = require('@adobe/aio-lib-files');
const {
  validateHostname,
  validateToken,
  validateWorkfrontId,
  callWorkfrontApi,
  callWorkfrontAbsoluteBinary
} = require('../utils/workfront');

function sanitizeZipName(name, fallback) {
  const sanitized = String(name || fallback || 'document')
    .replace(/[\\/:*?"<>|]/g, '_')
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .trim();
  return sanitized || fallback || 'document';
}

function uniqueName(name, usedNames) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : '';
  let counter = 2;
  let candidate = `${base} (${counter})${ext}`;
  while (usedNames.has(candidate)) {
    counter += 1;
    candidate = `${base} (${counter})${ext}`;
  }
  usedNames.add(candidate);
  return candidate;
}

function createDownloadPath(fileName) {
  return `bulk-downloads/${Date.now()}-${Math.random().toString(16).slice(2)}-${sanitizeZipName(fileName, 'documents.zip')}`;
}

function validateDocumentIds(documentIds) {
  if (!Array.isArray(documentIds) || documentIds.length === 0) return 'Missing required parameter: documentIds';
  if (documentIds.length > 50) return 'Cannot download more than 50 documents at once';

  for (const documentId of documentIds) {
    const idErr = validateWorkfrontId(documentId, 'documentId');
    if (idErr) return idErr;
  }

  return null;
}

async function loadDocument(hostname, token, documentId) {
  const metadata = await callWorkfrontApi(hostname, token, `docu/${documentId}`, {
    fields: 'ID,name,downloadURL,currentVersion:ext,currentVersionID'
  });
  const document = metadata.data || metadata;

  if (!document.downloadURL) {
    throw new Error(`Document ${documentId} does not have a download URL`);
  }

  const file = await callWorkfrontAbsoluteBinary(hostname, token, document.downloadURL);
  return { document, file };
}

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const idsErr = validateDocumentIds(params.documentIds);
  if (idsErr) return { statusCode: 400, body: { error: idsErr } };

  try {
    const zip = new JSZip();
    const usedNames = new Set();
    const loadedDocuments = await Promise.all(params.documentIds.map((documentId) => (
      loadDocument(params.hostname, params.token, documentId)
    )));

    loadedDocuments.forEach(({ document, file }) => {
      const extension = document.currentVersion?.ext || '';
      const baseName = sanitizeZipName(document.name, document.ID);
      const fileName = extension && !baseName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
        ? `${baseName}.${extension}`
        : baseName;
      zip.file(uniqueName(fileName, usedNames), file.buffer);
    });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `workfront-documents-${now}.zip`;
    const filePath = createDownloadPath(fileName);
    const files = await initFiles();

    await files.write(filePath, zipBuffer);
    const downloadUrl = await files.generatePresignURL(filePath, {
      expiryInSeconds: 10 * 60,
      permissions: 'r'
    });

    return {
      statusCode: 200,
      body: {
        fileName,
        contentType: 'application/zip',
        downloadUrl
      }
    };
  } catch (err) {
    console.error('bulk-download-documents error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;