const openwhisk = require('openwhisk');
const { callWorkfrontApi } = require('../utils/workfront');
const { transferJob } = require('../transfer-project-document');
const { init, INLINE_FILE_SIZE_LIMIT, validateRequest, paths, writeJob, claimJob, authorizedJob, prepareJob } = require('../utils/documentUploads');

async function main(params) {
  const validationError = validateRequest(params);
  if (validationError) return { statusCode: 400, body: { error: validationError } };
  try {
    const files = await init();
    if (params.operation === 'prepare') {
      await callWorkfrontApi(params.hostname, params.token, `project/${params.projectId}`, { fields: 'ID' });
      const prepared = await prepareJob(files, params);
      return { statusCode: 200, body: prepared };
    }
    if (!['start', 'status'].includes(params.operation)) return { statusCode: 400, body: { error: 'Invalid upload operation' } };
    const job = await authorizedJob(files, params);
    if (params.operation === 'start' && job.status === 'staging') {
      const props = await files.getProperties(paths(job.uploadId).file);
      if (props.contentLength !== job.fileSize) return { statusCode: 400, body: { error: 'Staged file size does not match the selected file' } };
      if (!await claimJob(files, job.uploadId, 'start')) {
        const current = await authorizedJob(files, params);
        return { statusCode: 202, body: { uploadId: current.uploadId, status: current.status, document: current.document, error: current.error } };
      }
      job.status = 'queued';
      job.transferMode = job.fileSize <= INLINE_FILE_SIZE_LIMIT ? 'inline' : 'async';
      job.startedAt = Date.now();
      await writeJob(files, job);
      if (job.transferMode === 'inline') {
        const result = await transferJob(files, job, params);
        return { statusCode: 200, body: { uploadId: job.uploadId, status: result.status, document: result.document, error: result.error } };
      }
      try {
        await openwhisk().actions.invoke({
          name: 'workfront-ui-1/transfer-project-document',
          blocking: false,
          result: false,
          params: { hostname: params.hostname, token: params.token, projectId: params.projectId, uploadId: job.uploadId }
        });
      } catch (error) {
        job.status = 'failed';
        job.error = `Unable to queue Workfront transfer: ${error.message}`;
        await writeJob(files, job);
        throw error;
      }
      return { statusCode: 202, body: { uploadId: job.uploadId, status: 'queued' } };
    }
    if (['queued', 'transferring'].includes(job.status) && Date.now() - job.startedAt > 12 * 60 * 1000) {
      return { statusCode: 200, body: { uploadId: job.uploadId, status: 'failed', error: 'Workfront transfer timed out. Check Project Documents before retrying to avoid duplicates.' } };
    }
    return { statusCode: 200, body: { uploadId: job.uploadId, status: job.status, error: job.error, document: job.document } };
  } catch (error) {
    return { statusCode: error.status || 400, body: { error: error.message } };
  }
}

exports.main = main;