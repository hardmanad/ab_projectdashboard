const { createHash, randomUUID } = require('crypto');
const { init } = require('@adobe/aio-lib-files');
const fetch = require('node-fetch');
const { validateHostname, validateToken, validateWorkfrontId } = require('./workfront');

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const INLINE_FILE_SIZE_LIMIT = 5 * 1024 * 1024;
const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const PREFIX = 'document-uploads/';

function validateRequest(params) {
  return validateHostname(params.hostname) || validateToken(params.token) || validateWorkfrontId(params.projectId, 'projectId');
}

function ownerKey(hostname, token) {
  const origin = new URL(hostname.startsWith('http') ? hostname : `https://${hostname}`).origin;
  return createHash('sha256').update(`${origin}\n${token}`).digest('hex');
}

function paths(uploadId) {
  if (!/^[a-f0-9-]{36}$/.test(uploadId || '')) throw new Error('Invalid uploadId');
  const directory = `${PREFIX}${uploadId}/`;
  return { directory, record: `${directory}job.json`, file: `${directory}file`, transfer: `${directory}transfer` };
}

async function readJob(files, uploadId) {
  const buffer = await files.read(paths(uploadId).record);
  return JSON.parse(buffer.toString());
}

async function writeJob(files, job) {
  await files.write(paths(job.uploadId).record, JSON.stringify(job));
}

async function claimJob(files, uploadId, phase) {
  const url = await files.generatePresignURL(`${paths(uploadId).directory}${phase}-claim`, {
    expiryInSeconds: 60,
    permissions: 'w',
    urlType: 'internal'
  });
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'If-None-Match': '*' },
    body: ''
  });
  if (response.status === 412) return false;
  if (!response.ok) throw new Error(`Unable to claim upload job: storage HTTP ${response.status}`);
  return true;
}

async function authorizedJob(files, params) {
  const job = await readJob(files, params.uploadId);
  if (job.owner !== ownerKey(params.hostname, params.token) || job.projectId !== params.projectId) {
    const error = new Error('This upload does not belong to the current Workfront session and project');
    error.status = 403;
    throw error;
  }
  if (Date.now() >= job.expiresAt) {
    const error = new Error('Upload expired. Drop the file again to start a new upload.');
    error.status = 410;
    throw error;
  }
  return job;
}

async function prepareJob(files, params) {
  if (typeof params.fileName !== 'string' || !params.fileName.trim() || params.fileName.length > 255 || /[\\/]/.test(params.fileName) || Array.from(params.fileName).some(character => character.charCodeAt(0) < 32)) throw new Error('Invalid fileName');
  if (!Number.isSafeInteger(params.fileSize) || params.fileSize <= 0 || params.fileSize > MAX_FILE_SIZE) throw new Error('Files must be nonempty and no larger than 100 MB');
  const job = {
    uploadId: randomUUID(),
    owner: ownerKey(params.hostname, params.token),
    projectId: params.projectId,
    fileName: params.fileName,
    contentType: typeof params.contentType === 'string' ? params.contentType : 'application/octet-stream',
    fileSize: params.fileSize,
    status: 'staging',
    createdAt: Date.now(),
    expiresAt: Date.now() + UPLOAD_TTL_MS
  };
  await writeJob(files, job);
  const uploadUrl = await files.generatePresignURL(paths(job.uploadId).file, {
    expiryInSeconds: 10 * 60,
    permissions: 'w',
    urlType: 'external'
  });
  return { uploadId: job.uploadId, uploadUrl, maxFileSize: MAX_FILE_SIZE };
}

module.exports = { init, MAX_FILE_SIZE, INLINE_FILE_SIZE_LIMIT, UPLOAD_TTL_MS, PREFIX, validateRequest, paths, readJob, writeJob, claimJob, authorizedJob, prepareJob };