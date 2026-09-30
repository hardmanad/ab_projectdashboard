const { init, PREFIX, UPLOAD_TTL_MS, readJob } = require('../utils/documentUploads');

async function main() {
  const files = await init();
  const entries = await files.list(PREFIX);
  const directories = new Set(entries
    .filter(entry => Date.now() - new Date(entry.lastModified).getTime() > UPLOAD_TTL_MS)
    .map(entry => entry.name.slice(0, entry.name.lastIndexOf('/') + 1)));
  let deleted = 0;
  for (const directory of directories) {
    const uploadId = directory.slice(PREFIX.length, -1);
    try {
      const job = await readJob(files, uploadId);
      if (job.expiresAt > Date.now()) continue;
    } catch (error) {
      console.error('Unable to read cleanup record:', error.message);
      continue;
    }
    await files.delete(directory);
    deleted += 1;
  }
  return { deleted };
}

exports.main = main;