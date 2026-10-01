const fs = require('fs');
const vm = require('vm');
const path = require('path');
const babel = require('@babel/core');
const { Readable } = require('stream');

const mockStore = new Map();
const mockFiles = {
  write: jest.fn(async (name, content) => { mockStore.set(name, Buffer.from(content)); }),
  read: jest.fn(async name => { if (!mockStore.has(name)) throw new Error('Not found'); return mockStore.get(name); }),
  getProperties: jest.fn(async name => ({ contentLength: mockStore.get(name).length })),
  generatePresignURL: jest.fn(async name => `https://storage.invalid/${name}`),
  copy: jest.fn(async (source, destination) => { mockStore.set(destination, mockStore.get(source)); }),
  createReadStream: jest.fn(async name => Readable.from(mockStore.get(name))),
  delete: jest.fn(async name => { for (const key of mockStore.keys()) if (key === name || (name.endsWith('/') && key.startsWith(name))) mockStore.delete(key); }),
  list: jest.fn(async () => [])
};

jest.mock('@adobe/aio-lib-files', () => ({ init: jest.fn(async () => mockFiles) }));
jest.mock('node-fetch', () => jest.fn());
jest.mock('openwhisk', () => jest.fn(() => ({ actions: { invoke: mockInvoke } })));
const mockInvoke = jest.fn(async () => ({ activationId: 'activation' }));
jest.mock('../src/workfront-ui-1/actions/utils/workfront', () => ({
  ...jest.requireActual('../src/workfront-ui-1/actions/utils/workfront'),
  callWorkfrontApi: jest.fn(async () => ({ data: { ID: 'project' } })),
  callWorkfrontApiPost: jest.fn(async () => ({ data: { ID: 'document' } })),
  uploadWorkfrontFile: jest.fn(async () => ({ data: { handle: 'handle' } }))
}));

const fetch = require('node-fetch');
const uploads = require('../src/workfront-ui-1/actions/utils/documentUploads');
const control = require('../src/workfront-ui-1/actions/upload-project-document').main;
const transfer = require('../src/workfront-ui-1/actions/transfer-project-document').main;
const cleanup = require('../src/workfront-ui-1/actions/cleanup-document-uploads').main;
const workfront = require('../src/workfront-ui-1/actions/utils/workfront');
const context = { hostname: 'https://example.workfront.com', token: 'test-session', projectId: 'a'.repeat(32) };

test('Runtime actions, triggers, and rules have distinct names and valid cleanup targets', () => {
  const yaml = require('js-yaml');
  const manifest = yaml.load(fs.readFileSync(path.join(__dirname, '../src/workfront-ui-1/ext.config.yaml'), 'utf8'));
  const runtimePackage = manifest.runtimeManifest.packages['workfront-ui-1'];
  const resourceNames = ['actions', 'triggers', 'rules'].flatMap(collection => Object.keys(runtimePackage[collection] || {}));
  expect(new Set(resourceNames).size).toBe(resourceNames.length);
  const rule = runtimePackage.rules['cleanup-document-uploads-schedule'];
  expect(runtimePackage.triggers[rule.trigger]).toBeDefined();
  expect(runtimePackage.actions[rule.action]).toBeDefined();
  expect(runtimePackage.actions['upload-project-document'].limits.timeout).toBe(600000);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  fetch.mockReset().mockResolvedValue({ status: 201, ok: true });
  mockInvoke.mockReset().mockResolvedValue({ activationId: 'activation' });
  workfront.uploadWorkfrontFile.mockReset().mockResolvedValue({ data: { handle: 'handle' } });
  workfront.callWorkfrontApiPost.mockReset().mockResolvedValue({ data: { ID: 'document' } });
  mockFiles.list.mockReset().mockResolvedValue([]);
});

async function prepared(fileSize = 1100000) {
  const response = await control({ ...context, operation: 'prepare', fileName: 'test.pdf', contentType: 'application/pdf', fileSize });
  expect(response.statusCode).toBe(200);
  const uploadId = response.body.uploadId;
  mockStore.set(uploads.paths(uploadId).file, Buffer.alloc(fileSize, 65));
  return uploadId;
}

test('prepares a private write-only URL without persisting the session token', async () => {
  const uploadId = await prepared();
  const job = await uploads.readJob(mockFiles, uploadId);
  expect(job.fileSize).toBe(1100000);
  expect(JSON.stringify(job)).not.toContain(context.token);
  expect(mockFiles.generatePresignURL).toHaveBeenCalledWith(uploads.paths(uploadId).file, { expiryInSeconds: 600, permissions: 'w', urlType: 'external' });
});

test.each([0, uploads.MAX_FILE_SIZE + 1])('rejects unsupported file size %s', async fileSize => {
  const response = await control({ ...context, operation: 'prepare', fileName: 'test.pdf', fileSize });
  expect(response.statusCode).toBe(400);
  expect(mockFiles.generatePresignURL).not.toHaveBeenCalled();
});

test('rejects another session, another project, expired jobs, and path traversal', async () => {
  const uploadId = await prepared();
  expect((await control({ ...context, token: 'another-session', operation: 'status', uploadId })).statusCode).toBe(403);
  expect((await control({ ...context, projectId: 'b'.repeat(32), operation: 'status', uploadId })).statusCode).toBe(403);
  const job = await uploads.readJob(mockFiles, uploadId);
  job.expiresAt = 0;
  await uploads.writeJob(mockFiles, job);
  expect((await control({ ...context, operation: 'status', uploadId })).statusCode).toBe(410);
  expect((await control({ ...context, operation: 'status', uploadId: '../job' })).statusCode).toBe(400);
});

test('size mismatch cannot enqueue a transfer', async () => {
  const uploadId = await prepared();
  mockStore.set(uploads.paths(uploadId).file, Buffer.from('short'));
  expect((await control({ ...context, operation: 'start', uploadId })).statusCode).toBe(400);
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('streams the staged file, creates a Project document, cleans bytes, and retains success status', async () => {
  const uploadId = await prepared();
  const response = await control({ ...context, operation: 'start', uploadId });
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ status: 'succeeded', document: { ID: 'document' } });
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(workfront.uploadWorkfrontFile).toHaveBeenCalledWith(context.hostname, context.token, 'test.pdf', 'application/pdf', expect.any(Readable), undefined, 1100000);
  expect(workfront.callWorkfrontApiPost).toHaveBeenCalledWith(context.hostname, context.token, 'document', { name: 'test.pdf', handle: 'handle', docObjCode: 'PROJ', objID: context.projectId });
  expect(mockStore.has(uploads.paths(uploadId).file)).toBe(false);
  expect((await control({ ...context, operation: 'status', uploadId })).body.document.ID).toBe('document');
  await control({ ...context, operation: 'start', uploadId });
  await transfer({ ...context, uploadId });
  expect(workfront.callWorkfrontApiPost).toHaveBeenCalledTimes(1);
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('files above the inline limit still enqueue the asynchronous worker', async () => {
  const uploadId = await prepared(uploads.INLINE_FILE_SIZE_LIMIT + 1);
  expect((await control({ ...context, operation: 'start', uploadId })).statusCode).toBe(202);
  expect(mockInvoke).toHaveBeenCalledWith(expect.objectContaining({ blocking: false, name: 'workfront-ui-1/transfer-project-document' }));
  expect(workfront.uploadWorkfrontFile).not.toHaveBeenCalled();
  expect(await transfer({ ...context, uploadId })).toEqual({ status: 'succeeded' });
});

test('the inline size boundary transfers directly without diagnostic logging', async () => {
  const uploadId = await prepared(uploads.INLINE_FILE_SIZE_LIMIT);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    expect((await control({ ...context, operation: 'start', uploadId })).body.status).toBe('succeeded');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});

test('duplicate starts during an inline transfer cannot upload or attach twice', async () => {
  const uploadId = await prepared();
  const claimed = new Set();
  fetch.mockImplementation(async url => {
    if (claimed.has(url)) return { status: 412, ok: false };
    claimed.add(url);
    return { status: 201, ok: true };
  });
  let releaseTransfer;
  let signalTransferStarted;
  const paused = new Promise(resolve => { releaseTransfer = resolve; });
  const entered = new Promise(resolve => { signalTransferStarted = resolve; });
  workfront.uploadWorkfrontFile.mockImplementationOnce(async () => {
    signalTransferStarted();
    await paused;
    return { data: { handle: 'handle' } };
  });
  const firstStart = control({ ...context, operation: 'start', uploadId });
  const concurrentStart = control({ ...context, operation: 'start', uploadId });
  await entered;
  const concurrent = await concurrentStart;
  expect(['queued', 'transferring']).toContain(concurrent.body.status);
  expect(workfront.uploadWorkfrontFile).toHaveBeenCalledTimes(1);
  releaseTransfer();
  expect((await firstStart).body.status).toBe('succeeded');
  expect(workfront.callWorkfrontApiPost).toHaveBeenCalledTimes(1);
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('preserves the actual Workfront transfer error in polled status', async () => {
  const uploadId = await prepared();
  workfront.uploadWorkfrontFile.mockRejectedValueOnce(new Error('Workfront: insufficient permissions'));
  const started = await control({ ...context, operation: 'start', uploadId });
  expect(started.body).toMatchObject({ status: 'failed', error: 'Workfront: insufficient permissions' });
  const response = await control({ ...context, operation: 'status', uploadId });
  expect(response.body).toMatchObject({ status: 'failed', error: 'Workfront: insufficient permissions' });
  expect(workfront.callWorkfrontApiPost).not.toHaveBeenCalled();
  expect(mockStore.has(uploads.paths(uploadId).file)).toBe(true);
});

test('the asynchronous worker completes without diagnostic logging', async () => {
  const uploadId = await prepared(uploads.INLINE_FILE_SIZE_LIMIT + 1);
  await control({ ...context, operation: 'start', uploadId });
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await transfer({ ...context, uploadId });
    expect(log).not.toHaveBeenCalled();
    expect((await control({ ...context, operation: 'status', uploadId })).body.status).toBe('succeeded');
  } finally { log.mockRestore(); }
});

test('the retired diagnostic reporting operation is rejected', async () => {
  const uploadId = await prepared();
  expect((await control({ ...context, operation: 'timings', uploadId })).statusCode).toBe(400);
});

test('status polling does not emit diagnostic logs', async () => {
  const uploadId = await prepared();
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await control({ ...context, operation: 'status', uploadId });
    await control({ ...context, operation: 'status', uploadId });
    expect(log).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});

test('multipart streaming preserves bytes and sends the correct content length', async () => {
  const actual = jest.requireActual('../src/workfront-ui-1/actions/utils/workfront');
  const bytes = Buffer.alloc(1100000, 65);
  fetch.mockImplementationOnce(async (url, options) => {
    const chunks = [];
    await new Promise((resolve, reject) => {
      options.body.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      options.body.on('end', resolve);
      options.body.on('error', reject);
      options.body.resume();
    });
    const body = Buffer.concat(chunks);
    expect(options.headers['Content-Length']).toBe(String(body.length));
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.headers['content-type']).toMatch(/multipart\/form-data; boundary=/);
    expect(body.includes(bytes)).toBe(true);
    return { ok: true, status: 200, text: async () => '{"data":{"handle":"handle"}}' };
  });
  await expect(actual.uploadWorkfrontFile(context.hostname, context.token, 'test.pdf', 'application/pdf', Readable.from(bytes), undefined, bytes.length)).resolves.toEqual({ data: { handle: 'handle' } });
});

test('document creation errors preserve a non-JSON Workfront response', async () => {
  const actual = jest.requireActual('../src/workfront-ui-1/actions/utils/workfront');
  fetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'You cannot attach documents to this project' });
  await expect(actual.callWorkfrontApiPost(context.hostname, context.token, 'document', {})).rejects.toThrow('You cannot attach documents to this project');
});

test('atomic claim rejects concurrent duplicates and storage authorization failures', async () => {
  const uploadId = await prepared();
  expect(await uploads.claimJob(mockFiles, uploadId, 'start')).toBe(true);
  fetch.mockResolvedValueOnce({ status: 412, ok: false });
  expect(await uploads.claimJob(mockFiles, uploadId, 'start')).toBe(false);
  expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { 'x-ms-blob-type': 'BlockBlob', 'If-None-Match': '*' } }));
  fetch.mockResolvedValueOnce({ status: 403, ok: false });
  await expect(uploads.claimJob(mockFiles, uploadId, 'start')).rejects.toThrow('403');
});

test('cleanup removes expired jobs but leaves active jobs', async () => {
  const uploadId = await prepared();
  const old = new Date(Date.now() - uploads.UPLOAD_TTL_MS - 1000);
  mockFiles.list.mockResolvedValue([{ name: uploads.paths(uploadId).file, lastModified: old }]);
  expect(await cleanup()).toEqual({ deleted: 0 });
  const job = await uploads.readJob(mockFiles, uploadId);
  job.expiresAt = 0;
  await uploads.writeJob(mockFiles, job);
  expect(await cleanup()).toEqual({ deleted: 1 });
});

function frontendModule(relativePath, overrides = {}, suffix = '') {
  const source = fs.readFileSync(path.join(__dirname, '../src/workfront-ui-1/web-src/src', relativePath), 'utf8') + suffix;
  const { code } = babel.transformSync(source, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] });
  const sandbox = { exports: {}, URL, process: { env: {} }, window: { location: { origin: 'https://example.invalid', hostname: 'example.invalid' } }, setTimeout: callback => callback(), Date, require: () => ({}), ...overrides };
  vm.runInNewContext(code, sandbox);
  return sandbox.exports;
}

test.each(['{"error":"content too large"}', '{"message":"content too large"}', '<html>Content Too Large</html>'])('preserves HTTP status and response detail: %s', async body => {
  const api = frontendModule('utils.js', { fetch: async () => ({ ok: false, status: 413, text: async () => body }) });
  await expect(api.default('https://example.invalid')).rejects.toThrow(/HTTP 413: .*content too large/i);
});

test('1.1 MB browser upload uses raw storage bytes, metadata-only actions, and status polling', async () => {
  const file = { name: 'test.pdf', size: 1100000, type: 'application/pdf' };
  const action = jest.fn(async (url, headers, params) => {
    if (params.operation === 'prepare') return { uploadId: 'upload', uploadUrl: 'https://storage.invalid/file' };
    if (params.operation === 'start') return { status: 'queued' };
    return { status: 'succeeded', document: { ID: 'document' } };
  });
  const storage = jest.fn(async () => ({ ok: true }));
  const api = frontendModule('services/workfrontApi.js', { require: name => name === '../utils' ? { __esModule: true, default: action } : {}, fetch: storage });
  await expect(api.uploadProjectDocument(context.hostname, context.token, context.projectId, file)).resolves.toEqual({ ID: 'document' });
  expect(storage).toHaveBeenCalledWith('https://storage.invalid/file', expect.objectContaining({ method: 'PUT', body: file }));
  expect(action.mock.calls.map(call => call[2].operation)).toEqual(['prepare', 'start', 'status']);
  expect(action.mock.calls.every(call => !('fileContent' in call[2]))).toBe(true);
});

test('storage HTTP failures prevent transfer and preserve response detail', async () => {
  const action = jest.fn(async () => ({ uploadId: 'upload', uploadUrl: 'https://storage.invalid/file' }));
  const api = frontendModule('services/workfrontApi.js', { require: name => name === '../utils' ? { __esModule: true, default: action } : {}, fetch: async () => ({ ok: false, status: 403, text: async () => '{"message":"Signature expired"}' }) });
  await expect(api.uploadProjectDocument(context.hostname, context.token, context.projectId, { name: 'test.pdf', size: 1100000 })).rejects.toThrow('Storage upload HTTP 403: Signature expired');
  expect(action.mock.calls.map(call => call[2].operation)).toEqual(['prepare']);
});

test('inline browser completion returns the document without polling', async () => {
  const action = jest.fn(async (url, headers, params) => {
    if (params.operation === 'prepare') return { uploadId: 'upload', uploadUrl: 'https://storage.invalid/file' };
    if (params.operation === 'start') return { status: 'succeeded', document: { ID: 'document' } };
    return { recorded: true };
  });
  const api = frontendModule('services/workfrontApi.js', { require: name => name === '../utils' ? { __esModule: true, default: action } : {}, fetch: async () => ({ ok: true }) });
  await expect(api.uploadProjectDocument(context.hostname, context.token, context.projectId, { name: 'test.pdf', size: 1100000 })).resolves.toEqual({ ID: 'document' });
  expect(action.mock.calls.map(call => call[2].operation)).toEqual(['prepare', 'start']);
});

test.each([
  Object.assign(new Error('Gateway timeout'), { status: 504 }),
  new TypeError('Failed to fetch')
])('uncertain start response polls the same upload without restarting: %s', async startError => {
  const action = jest.fn(async (url, headers, params) => {
    if (params.operation === 'prepare') return { uploadId: 'upload', uploadUrl: 'https://storage.invalid/file' };
    if (params.operation === 'start') throw startError;
    if (params.operation === 'status') return { status: 'succeeded', document: { ID: 'document' } };
    return { recorded: true };
  });
  const api = frontendModule('services/workfrontApi.js', { require: name => name === '../utils' ? { __esModule: true, default: action } : {}, fetch: async () => ({ ok: true }) });
  await expect(api.uploadProjectDocument(context.hostname, context.token, context.projectId, { name: 'test.pdf', size: 1100000 })).resolves.toEqual({ ID: 'document' });
  expect(action.mock.calls.filter(call => call[2].operation === 'start')).toHaveLength(1);
  expect(action.mock.calls.find(call => call[2].operation === 'status')[2].uploadId).toBe('upload');
});

test('transient status failures are retried without restarting the transfer', async () => {
  let statusCalls = 0;
  const action = jest.fn(async (url, headers, params) => {
    if (params.operation === 'prepare') return { uploadId: 'upload', uploadUrl: 'https://storage.invalid/file' };
    if (params.operation === 'start') throw Object.assign(new Error('Timeout'), { status: 504 });
    if (params.operation === 'status') {
      statusCalls += 1;
      if (statusCalls === 1) throw Object.assign(new Error('Unavailable'), { status: 503 });
      return { status: 'succeeded', document: { ID: 'document' } };
    }
    return { recorded: true };
  });
  const api = frontendModule('services/workfrontApi.js', { require: name => name === '../utils' ? { __esModule: true, default: action } : {}, fetch: async () => ({ ok: true }) });
  await expect(api.uploadProjectDocument(context.hostname, context.token, context.projectId, { name: 'test.pdf', size: 1100000 })).resolves.toEqual({ ID: 'document' });
  expect(action.mock.calls.filter(call => call[2].operation === 'start')).toHaveLength(1);
  expect(statusCalls).toBe(2);
});

test('a definite start authorization failure is not retried or polled', async () => {
  const action = jest.fn(async (url, headers, params) => {
    if (params.operation === 'prepare') return { uploadId: 'upload', uploadUrl: 'https://storage.invalid/file' };
    if (params.operation === 'start') throw Object.assign(new Error('Forbidden'), { status: 403 });
    return { recorded: true };
  });
  const api = frontendModule('services/workfrontApi.js', { require: name => name === '../utils' ? { __esModule: true, default: action } : {}, fetch: async () => ({ ok: true }) });
  await expect(api.uploadProjectDocument(context.hostname, context.token, context.projectId, { name: 'test.pdf', size: 1100000 })).rejects.toThrow('Forbidden');
  expect(action.mock.calls.some(call => call[2].operation === 'status')).toBe(false);
});

test('renders upload error immediately before the Project drop zone', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Stub = ({ children }) => React.createElement('span', null, children);
  const component = frontendModule('components/CustomDocumentsTab.js', {
    require: name => name === 'react' ? React : name === '@adobe/react-spectrum' ? new Proxy({}, { get: () => Stub }) : name.startsWith('@spectrum-icons/') ? Stub : name.endsWith('urlBuilder') ? { buildWorkfrontObjectUrl: () => '/project' } : {}
  }, '\nexport { CustomDocumentSection };');
  const html = renderToStaticMarkup(React.createElement(component.CustomDocumentSection, {
    parent: { objCode: 'PROJ', ID: context.projectId, label: 'Project' }, documents: [], selectedDocumentIds: new Set(), uploadError: 'test.pdf: content too large'
  }));
  expect(html).toContain('role="alert"');
  expect(html).toContain('test.pdf: content too large');
  expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('custom-doc-upload-zone'));
});