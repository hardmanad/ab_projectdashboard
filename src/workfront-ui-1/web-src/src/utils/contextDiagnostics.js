export const CONTEXT_DIAGNOSTICS_ENABLED = false;

function describeField(field, value, ancestors = new Set(), depth = 0) {
  const description = {
    field,
    type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  };
  if (description.type !== 'object') return description;
  if (ancestors.has(value) || depth >= 5) {
    description.traversal = ancestors.has(value) ? 'circular' : 'depth-limit';
    return description;
  }

  ancestors.add(value);
  description.children = Object.entries(Object.getOwnPropertyDescriptors(value))
    .filter(([, descriptor]) => descriptor.enumerable)
    .map(([name, descriptor]) => 'value' in descriptor
      ? describeField(name, descriptor.value, ancestors, depth + 1)
      : { field: name, type: 'accessor' });
  ancestors.delete(value);
  return description;
}

export function startContextDiagnostics(connection, source) {
  if (!CONTEXT_DIAGNOSTICS_ENABLED) return () => {};

  const report = (phase, context, enumeration) => {
    try {
      const entries = context instanceof Map
        ? Array.from(context.entries())
        : Object.entries(context || {});
      const fields = entries.map(([field, value]) => field === 'auth' || field === 'user'
        ? describeField(field, value)
        : ({
        field,
        type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
      }));
      console.info('[Workfront context diagnostics]', {
        source,
        phase,
        enumeration,
        fields
      });
    } catch {
      console.info('[Workfront context diagnostics]', { source, phase, enumeration: 'unavailable' });
    }
  };

  const onContextChange = event => {
    report('contextchange', event.detail?.context, 'event.detail.context');
  };
  const supportsChanges = typeof connection?.addEventListener === 'function'
    && typeof connection?.removeEventListener === 'function';

  if (supportsChanges) connection.addEventListener('contextchange', onContextChange);

  const contextMap = connection?.sharedContext?._map;
  report('initial', contextMap instanceof Map ? contextMap : null,
    contextMap instanceof Map ? 'private sharedContext._map (temporary fallback)' : 'unavailable');
  console.info('[Workfront context diagnostics]', {
    source,
    get: typeof connection?.sharedContext?.get === 'function',
    contextchange: supportsChanges
  });

  return () => {
    if (supportsChanges) connection.removeEventListener('contextchange', onContextChange);
  };
}