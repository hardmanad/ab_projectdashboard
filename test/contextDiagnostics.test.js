const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

function loadDiagnostics(enableDiagnostics = false) {
  const filename = path.join(__dirname, '../src/workfront-ui-1/web-src/src/utils/contextDiagnostics.js');
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    plugins: enableDiagnostics ? [() => ({
      visitor: {
        VariableDeclarator({ node }) {
          if (node.id.name === 'CONTEXT_DIAGNOSTICS_ENABLED') node.init.value = true;
        }
      }
    })] : []
  });
  const exports = {};
  const info = jest.fn();
  vm.runInNewContext(code, { exports, console: { info }, Map });
  return { startContextDiagnostics: exports.startContextDiagnostics, info };
}

test('initial and changed context diagnostics expose every top-level field and type, never values', () => {
  const { startContextDiagnostics, info } = loadDiagnostics(true);
  const values = {
    sessionToken: 'credential-sentinel',
    hostname: 'private-host-sentinel',
    objID: 'personal-id-sentinel',
    auth: { imsToken: 'nested-credential-sentinel' },
    user: { name: 'personal-name-sentinel', profile: { email: 'personal-email-sentinel' } },
    enabled: true,
    count: 42,
    absent: undefined,
    empty: null,
    items: ['personal-array-sentinel']
  };
  const connection = {
    sharedContext: { _map: new Map(Object.entries(values)), get: jest.fn() },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  const stop = startContextDiagnostics(connection, 'project-tab');
  const snapshot = info.mock.calls[0][1];
  expect(snapshot.phase).toBe('initial');
  expect(snapshot.fields.map(({ field, type }) => ({ field, type }))).toEqual(Object.keys(values).map(field => ({
    field,
    type: values[field] === null ? 'null' : Array.isArray(values[field]) ? 'array' : typeof values[field]
  })));
  expect(snapshot.fields).toContainEqual({
    field: 'auth', type: 'object', children: [{ field: 'imsToken', type: 'string' }]
  });
  expect(snapshot.fields).toContainEqual({
    field: 'user', type: 'object', children: [
      { field: 'name', type: 'string' },
      { field: 'profile', type: 'object', children: [{ field: 'email', type: 'string' }] }
    ]
  });
  const listener = connection.addEventListener.mock.calls[0][1];
  listener({ detail: { context: { ...values, newField: 'changed-secret-sentinel' } } });
  expect(info.mock.calls[2][1]).toMatchObject({
    phase: 'contextchange',
    enumeration: 'event.detail.context'
  });
  expect(info.mock.calls[2][1].fields).toContainEqual({ field: 'newField', type: 'string' });
  expect(info.mock.calls[2][1].fields).toContainEqual(snapshot.fields.find(({ field }) => field === 'auth'));
  expect(info.mock.calls[2][1].fields).toContainEqual(snapshot.fields.find(({ field }) => field === 'user'));
  expect(JSON.stringify(info.mock.calls)).not.toMatch(/sentinel|42/);
  expect(connection.sharedContext.get).not.toHaveBeenCalled();
  stop();
  expect(connection.removeEventListener).toHaveBeenCalledWith('contextchange', listener);
});

test('nested diagnostics stop at arrays, cycles and the depth limit without invoking getters', () => {
  const { startContextDiagnostics, info } = loadDiagnostics(true);
  const getter = jest.fn(() => 'getter-secret-sentinel');
  const user = { roles: ['array-secret-sentinel'] };
  user.self = user;
  Object.defineProperty(user, 'computed', { enumerable: true, get: getter });
  let nested = user;
  for (let depth = 0; depth < 7; depth++) {
    nested.profile = {};
    nested = nested.profile;
  }
  nested.secret = 'depth-secret-sentinel';
  startContextDiagnostics({ sharedContext: { _map: new Map([['user', user]]) } }, 'project-tab');
  const children = info.mock.calls[0][1].fields[0].children;
  expect(children).toContainEqual({ field: 'roles', type: 'array' });
  expect(children).toContainEqual({ field: 'self', type: 'object', traversal: 'circular' });
  expect(children).toContainEqual({ field: 'computed', type: 'accessor' });
  expect(getter).not.toHaveBeenCalled();
  expect(JSON.stringify(info.mock.calls)).toContain('depth-limit');
  expect(JSON.stringify(info.mock.calls)).not.toContain('sentinel');
});

test('unsupported context APIs produce an explicit unavailable report without throwing', () => {
  const { startContextDiagnostics, info } = loadDiagnostics(true);
  expect(startContextDiagnostics({ sharedContext: { get: () => 'secret' } }, 'registration')).toEqual(expect.any(Function));
  expect(info.mock.calls[0][1]).toMatchObject({ enumeration: 'unavailable', fields: [] });
  expect(info.mock.calls[1][1]).toMatchObject({ get: true, contextchange: false });
});

test('production diagnostics are disabled without logging, context access or subscriptions', () => {
  const { startContextDiagnostics, info } = loadDiagnostics();
  const contextGetter = jest.fn();
  const connection = {
    get sharedContext() { return contextGetter(); },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  const stop = startContextDiagnostics(connection, 'project-tab');
  stop();
  expect(info).not.toHaveBeenCalled();
  expect(contextGetter).not.toHaveBeenCalled();
  expect(connection.addEventListener).not.toHaveBeenCalled();
  expect(connection.removeEventListener).not.toHaveBeenCalled();
});