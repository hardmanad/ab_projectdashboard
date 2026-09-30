const { performance } = require('perf_hooks');
const { callWorkfrontApiPost, uploadWorkfrontFile } = require('../utils/workfront');
const { init, validateRequest, paths, writeJob, claimJob, authorizedJob, logUploadTiming, timedUploadPhase } = require('../utils/documentUploads');

async function main(params) {
  const enteredAt = Date.now();
  const workerStartedAt = performance.now();
  const validationError = validateRequest(params);
  if (validationError) throw new Error(validationError);
  const files = await init();
  const job = await authorizedJob(files, params);
  const result = await transferJob(files, job, params, { enteredAt, startedAt: workerStartedAt });
  return { status: result.status };
}

async function transferJob(files, job, params, { mode = 'async', enteredAt = Date.now(), startedAt = performance.now() } = {}) {
  if (job.status !== 'queued') return job;
  if (!await claimJob(files, job.uploadId, 'worker')) return job;
  if (mode === 'async') logUploadTiming(job, 'queue_to_worker_entry', enteredAt - job.startedAt);
  logUploadTiming(job, mode === 'inline' ? 'inline_setup' : 'worker_setup', performance.now() - startedAt);
  job.status = 'transferring';
  await timedUploadPhase(job, 'transferring_status_write', () => writeJob(files, job));
  let stream;
  try {
    const uploadPaths = paths(job.uploadId);
    await timedUploadPhase(job, 'snapshot_copy', () => files.copy(uploadPaths.file, uploadPaths.transfer));
    const props = await timedUploadPhase(job, 'snapshot_verify', () => files.getProperties(uploadPaths.transfer));
    if (props.contentLength !== job.fileSize) throw new Error('Staged file changed before transfer');
    stream = await timedUploadPhase(job, 'stream_open', () => files.createReadStream(uploadPaths.transfer));
    const upload = await timedUploadPhase(job, 'workfront_upload', () => uploadWorkfrontFile(params.hostname, params.token, job.fileName, job.contentType, stream, undefined, job.fileSize));
    const handle = upload.data?.handle || upload.handle;
    if (!handle) throw new Error('Workfront upload did not return a file handle');
    const response = await timedUploadPhase(job, 'document_create', () => callWorkfrontApiPost(params.hostname, params.token, 'document', {
      name: job.fileName,
      handle,
      docObjCode: 'PROJ',
      objID: job.projectId
    }));
    job.document = response.data || response;
    job.status = 'succeeded';
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
  } finally {
    if (stream) stream.destroy();
  }
  job.completedAt = Date.now();
  await timedUploadPhase(job, 'completion_status_write', () => writeJob(files, job));
  if (job.status === 'succeeded') {
    try {
      await timedUploadPhase(job, 'cleanup', async () => {
        let cleanupError;
        for (const path of [paths(job.uploadId).file, paths(job.uploadId).transfer]) {
          try { await files.delete(path); } catch (error) { cleanupError = error; }
        }
        if (cleanupError) throw cleanupError;
      });
    } catch (error) { console.error('Upload cleanup failed:', error.message); }
  }
  logUploadTiming(job, mode === 'inline' ? 'inline_total' : 'worker_total', performance.now() - startedAt, job.status === 'succeeded' ? 'success' : 'error');
  return job;
}

exports.main = main;
exports.transferJob = transferJob;