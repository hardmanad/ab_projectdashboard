const {
  validateHostname,
  validateToken,
  validateWorkfrontId,
  callWorkfrontInternalBinary
} = require('../utils/workfront');

const THUMBNAIL_SIZES = ['MEDIUM', 'LARGE', 'ORIGINAL'];
// ORIGINAL can exceed the runtime's response size limit and cause gateway 400s, so default to MEDIUM
const DEFAULT_SIZE = 'MEDIUM';

function validateThumbnailSize(size) {
  if (!size) return null;
  if (!THUMBNAIL_SIZES.includes(size)) return `Invalid size: must be one of ${THUMBNAIL_SIZES.join(', ')}`;
  return null;
}

async function main(params) {
  const hostnameErr = validateHostname(params.hostname);
  if (hostnameErr) return { statusCode: 400, body: { error: hostnameErr } };

  const tokenErr = validateToken(params.token);
  if (tokenErr) return { statusCode: 400, body: { error: tokenErr } };

  const documentIdErr = validateWorkfrontId(params.documentId, 'documentId');
  if (documentIdErr) return { statusCode: 400, body: { error: documentIdErr } };

  const documentVersionIdErr = validateWorkfrontId(params.documentVersionId, 'documentVersionId');
  if (documentVersionIdErr) return { statusCode: 400, body: { error: documentVersionIdErr } };

  const sizeErr = validateThumbnailSize(params.size);
  if (sizeErr) return { statusCode: 400, body: { error: sizeErr } };

  try {
    const size = params.size || DEFAULT_SIZE;
    const thumbnail = await callWorkfrontInternalBinary(params.hostname, params.token, '/internal/document/thumbnail', {
      ID: params.documentId,
      documentVersionID: params.documentVersionId,
      size
    });

    return {
      statusCode: 200,
      body: {
        dataUrl: `data:${thumbnail.contentType};base64,${thumbnail.buffer.toString('base64')}`,
        contentType: thumbnail.contentType,
        size
      }
    };
  } catch (err) {
    console.error('get-document-thumbnail error:', err.message);
    return { statusCode: err.status || 500, body: { error: err.message } };
  }
}

exports.main = main;