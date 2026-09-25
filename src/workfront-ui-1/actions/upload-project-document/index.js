const {
  validateHostname,
  validateToken,
  validateWorkfrontId,
  callWorkfrontApiPost,
  uploadWorkfrontFile
} = require('../utils/workfront');

function validateFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'Missing required parameter: fileName';
  if (fileName.includes('/') || fileName.includes('\\')) return 'Invalid fileName: path separators are not allowed';
  return null;
}

function validateFileContent(fileContent) {
  if (!fileContent || typeof fileContent !== 'string') return 'Missing required parameter: fileContent';
  return null;
}

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const projectIdErr = validateWorkfrontId(params.projectId, 'projectId');
  if (projectIdErr) return { statusCode: 400, body: { error: projectIdErr } };

  const fileNameErr = validateFileName(params.fileName);
  if (fileNameErr) return { statusCode: 400, body: { error: fileNameErr } };

  const fileContentErr = validateFileContent(params.fileContent);
  if (fileContentErr) return { statusCode: 400, body: { error: fileContentErr } };

  try {
    const fileBuffer = Buffer.from(params.fileContent, 'base64');
    if (!fileBuffer.length) return { statusCode: 400, body: { error: 'Uploaded file is empty' } };

    const uploadData = await uploadWorkfrontFile(
      params.hostname,
      params.token,
      params.fileName,
      params.contentType || 'application/octet-stream',
      fileBuffer
    );
    const handle = uploadData.data?.handle || uploadData.handle;
    if (!handle) throw new Error('Workfront upload did not return a file handle');

    const documentData = await callWorkfrontApiPost(params.hostname, params.token, 'document', {
      name: params.fileName,
      handle,
      docObjCode: 'PROJ',
      objID: params.projectId
    });

    return { statusCode: 200, body: documentData };
  } catch (err) {
    console.error('upload-project-document error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;