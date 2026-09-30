const { performance } = require('perf_hooks');
const openwhisk = require('openwhisk');
const { callWorkfrontApi } = require('../utils/workfront');
const { transferJob } = require('../transfer-project-document');
const { init, INLINE_FILE_SIZE_LIMIT, validateRequest, paths, writeJob, claimJob, authorizedJob, prepareJob, logUploadTiming, timedUploadPhase } = require('../utils/documentUploads');

async function main(params) {
  const requestStartedAt = performance.now();
  const validationError = validateRequest(params);
  if (validationError) return { statusCode: 400, body: { error: validationError } };
  let timingJob = { uploadId: params.uploadId, projectId: params.projectId, fileSize: params.fileSize };
  try {
    const files = await init();
    const filesInitMs = performance.now() - requestStartedAt;
    if (params.operation === 'prepare') {
      const accessStartedAt = performance.now();
      await callWorkfrontApi(params.hostname, params.token, `project/${params.projectId}`, { fields: 'ID' });
      const projectAccessMs = performance.now() - accessStartedAt;
      const stagingStartedAt = performance.now();
      const prepared = await prepareJob(files, params);
      timingJob.uploadId = prepared.uploadId;
      logUploadTiming(timingJob, 'control_files_init', filesInitMs);
      logUploadTiming(timingJob, 'project_access', projectAccessMs);
      logUploadTiming(timingJob, 'prepare_staging', performance.now() - stagingStartedAt);
      logUploadTiming(timingJob, 'prepare_total', performance.now() - requestStartedAt);
      return { statusCode: 200, body: prepared };
    }
    if (!['start', 'status', 'timings'].includes(params.operation)) return { statusCode: 400, body: { error: 'Invalid upload operation' } };
    const job = await authorizedJob(files, params);
    timingJob = job;
    if (params.operation === 'timings') {
      const phases = ['prepare', 'storage_upload', 'start', 'polling', 'total'];
      const entries = params.timings && typeof params.timings === 'object' && !Array.isArray(params.timings) ? Object.entries(params.timings) : [];
      if (!entries.length || !Number.isSafeInteger(params.pollCount) || params.pollCount < 0 || params.pollCount > 10000 || entries.some(([phase, timing]) => !phases.includes(phase) || !timing || !Number.isFinite(timing.durationMs) || timing.durationMs < 0 || timing.durationMs > 24 * 60 * 60 * 1000 || !['success', 'error'].includes(timing.outcome))) {
        return { statusCode: 400, body: { error: 'Invalid browser upload timings' } };
      }
      for (const [phase, timing] of entries) logUploadTiming({ ...job, pollCount: params.pollCount }, `browser_${phase}`, timing.durationMs, timing.outcome, 'browser');
      return { statusCode: 200, body: { recorded: true } };
    }
    if (params.operation === 'start' && job.status === 'staging') {
      const props = await files.getProperties(paths(job.uploadId).file);
      if (props.contentLength !== job.fileSize) return { statusCode: 400, body: { error: 'Staged file size does not match the selected file' } };
      if (!await claimJob(files, job.uploadId, 'start')) {
        const current = await authorizedJob(files, params);
        return { statusCode: 202, body: { uploadId: current.uploadId, status: current.status, document: current.document, error: current.error } };
      }
      logUploadTiming(job, 'start_setup', performance.now() - requestStartedAt);
      job.status = 'queued';
      job.transferMode = job.fileSize <= INLINE_FILE_SIZE_LIMIT ? 'inline' : 'async';
      job.startedAt = Date.now();
      await timedUploadPhase(job, 'queued_status_write', () => writeJob(files, job));
      if (job.transferMode === 'inline') {
        const result = await transferJob(files, job, params, { mode: 'inline' });
        logUploadTiming(job, 'start_total', performance.now() - requestStartedAt, result.status === 'failed' ? 'error' : 'success');
        return { statusCode: 200, body: { uploadId: job.uploadId, status: result.status, document: result.document, error: result.error } };
      }
      try {
        await timedUploadPhase(job, 'worker_invoke', () => openwhisk().actions.invoke({
          name: 'workfront-ui-1/transfer-project-document',
          blocking: false,
          result: false,
          params: { hostname: params.hostname, token: params.token, projectId: params.projectId, uploadId: job.uploadId }
        }));
      } catch (error) {
        job.status = 'failed';
        job.error = `Unable to queue Workfront transfer: ${error.message}`;
        await writeJob(files, job);
        throw error;
      }
      logUploadTiming(job, 'start_total', performance.now() - requestStartedAt);
      return { statusCode: 202, body: { uploadId: job.uploadId, status: 'queued' } };
    }
    if (['queued', 'transferring'].includes(job.status) && Date.now() - job.startedAt > 12 * 60 * 1000) {
      return { statusCode: 200, body: { uploadId: job.uploadId, status: 'failed', error: 'Workfront transfer timed out. Check Project Documents before retrying to avoid duplicates.' } };
    }
    return { statusCode: 200, body: { uploadId: job.uploadId, status: job.status, error: job.error, document: job.document } };
  } catch (error) {
    if (['prepare', 'start'].includes(params.operation)) logUploadTiming(timingJob, `${params.operation}_total`, performance.now() - requestStartedAt, 'error');
    return { statusCode: error.status || 400, body: { error: error.message } };
  }
}

exports.main = main;