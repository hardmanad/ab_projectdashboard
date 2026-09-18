/**
 * Formatting helpers for Workfront JRNLE (journal entry) records — the system-generated
 * updates shown alongside user notes (status changes, condition/health updates, document uploads).
 */

// Field-specific phrasing to match Workfront's native "Updates" feed wording
const FIELD_LABEL_BUILDERS = {
  status: (value) => `changed the status to ${value}`,
  condition: (value) => `said this project is ${value}`,
};

function humanizeFieldName(fieldName) {
  if (!fieldName) return 'a field';
  return fieldName.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * Workfront emits two JRNLE records per document upload — one linking the DOCU to its
 * initial DOCV (no documentID set), and one canonical record with documentID set and the
 * filename (including extension) in aux1. Drop the former to avoid duplicate rows.
 */
export function isDuplicateJournalEntry(entry) {
  return entry.changeType === 'A'
    && entry.objObjCode === 'DOCU'
    && entry.subObjCode === 'DOCV'
    && !entry.documentID;
}

/**
 * Builds a human-readable description of a journal entry, e.g.
 * "changed the status to Current" or "uploaded barkeep.jpg".
 */
export function describeJournalEntry(entry) {
  if (entry.changeType === 'A' && entry.documentID) {
    return `uploaded ${entry.aux1 || 'a file'}`;
  }

  if (entry.changeType === 'E' && entry.fieldName) {
    const value = entry.aux1 || entry.newTextVal || '';
    const builder = FIELD_LABEL_BUILDERS[entry.fieldName];
    return builder ? builder(value) : `updated ${humanizeFieldName(entry.fieldName)} to ${value}`;
  }

  return 'made an update';
}

/**
 * Returns { objCode, objID } for the object a journal entry's upload relates to, if any.
 */
export function getJournalEntryDocument(entry) {
  if (entry.changeType === 'A' && entry.documentID) {
    return { objCode: 'DOCU', objID: entry.documentID };
  }
  return null;
}
