const { callWorkfrontApiPost, uploadWorkfrontFile } = require('../utils/workfront');
const { init, validateRequest, paths, writeJob, claimJob, authorizedJob } = require('../utils/documentUploads');

async function main(params) {
  const validationError = validateRequest(params);
  if (validationError) throw new Error(validationError);
  const files = await init();
  const job = await authorizedJob(files, params);
  const result = await transferJob(files, job, params);
  return { status: result.status };
}

async function transferJob(files, job, params) {
  if (job.status !== 'queued') return job;
  if (!await claimJob(files, job.uploadId, 'worker')) return job;
  job.status = 'transferring';
  await writeJob(files, job);
  let stream;
  try {
    const uploadPaths = paths(job.uploadId);
    await files.copy(uploadPaths.file, uploadPaths.transfer);
    const props = await files.getProperties(uploadPaths.transfer);
    if (props.contentLength !== job.fileSize) throw new Error('Staged file changed before transfer');
    stream = await files.createReadStream(uploadPaths.transfer);
    const upload = await uploadWorkfrontFile(params.hostname, params.token, job.fileName, job.contentType, stream, undefined, job.fileSize);
    const handle = upload.data?.handle || upload.handle;
    if (!handle) throw new Error('Workfront upload did not return a file handle');
    const response = await callWorkfrontApiPost(params.hostname, params.token, 'document', {
      name: job.fileName,
      handle,
      docObjCode: 'PROJ',
      objID: job.projectId
    });
    job.document = response.data || response;
    job.status = 'succeeded';
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
  } finally {
    if (stream) stream.destroy();
  }
  await writeJob(files, job);
  if (job.status === 'succeeded') {
    try {
      let cleanupError;
      for (const path of [paths(job.uploadId).file, paths(job.uploadId).transfer]) {
        try { await files.delete(path); } catch (error) { cleanupError = error; }
      }
      if (cleanupError) throw cleanupError;
    } catch (error) { console.error('Upload cleanup failed:', error.message); }
  }
  return job;
}

exports.main = main;
exports.transferJob = transferJob;