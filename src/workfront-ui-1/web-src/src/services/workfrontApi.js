/**
 * Workfront API Service
 * Calls purpose-built Adobe I/O Runtime actions instead of a generic proxy.
 * Each function maps 1:1 to a single action that validates inputs and hardcodes
 * the Workfront endpoint + field list on the server side.
 */

import actionWebInvoke from '../utils';
import { isDuplicateJournalEntry } from '../utils/journalFormatter';
import { parseWorkfrontDate } from '../utils/dateFormatter';

function getActionUrl(actionName) {
  const actionPath = `/api/v1/web/workfront-ui-1/${actionName}`;

  if (process.env.AIO_STATIC_HOST) {
    return `https://${process.env.AIO_STATIC_HOST}${actionPath}`;
  }

  const currentHost = window.location.origin;

  if (currentHost.includes('localhost')) {
    return `${currentHost}${actionPath}`;
  }

  const namespace = window.location.hostname.split('.')[0];
  return `https://${namespace}.adobeioruntime.net${actionPath}`;
}

async function callAction(actionName, actionParams) {
  const actionUrl = getActionUrl(actionName);
  const response = await actionWebInvoke(actionUrl, {}, actionParams, { method: 'POST' });
  if (response && response.error) {
    throw new Error(`[${actionName}] ${response.error}`);
  }
  return response;
}

/**
 * Fetches projects with optional status filter.
 * Status OR-filter logic is handled server-side in the get-projects action.
 */
export async function fetchProjects(hostname, sessionToken, statusFilter = []) {
  const response = await callAction('get-projects', {
    hostname,
    token: sessionToken,
    statusFilter
  });

  const projects = response.data || [];

  projects.sort((a, b) => new Date(b.entryDate || 0) - new Date(a.entryDate || 0));

  return projects;
}

/**
 * Fetches detailed information for a single project.
 */
export async function fetchProjectDetails(hostname, sessionToken, projectId) {
  const response = await callAction('get-project', {
    hostname,
    token: sessionToken,
    projectId
  });
  return response.data || response;
}

/**
 * Fetches notes/comments for a project with pagination.
 */
export async function fetchComments(hostname, sessionToken, projectId, limit = 10, offset = 0) {
  const response = await callAction('get-project-comments', {
    hostname,
    token: sessionToken,
    projectId,
    limit,
    offset
  });

  const notes = response.data || [];

  const notesWithText = notes.filter(note => note.noteText && note.noteText.trim() !== '');

  notesWithText.sort((a, b) => new Date(b.entryDate || 0) - new Date(a.entryDate || 0));

  return notesWithText;
}

/**
 * Fetches the display name of an arbitrary Workfront object (used to resolve the
 * name of whatever object a note is attached to — a task, issue, document, etc.
 * — when that name isn't already available via a cheap field expansion).
 */
export async function fetchObjectName(hostname, sessionToken, objCode, objID) {
  const response = await callAction('get-object-name', {
    hostname,
    token: sessionToken,
    objCode,
    objID
  });
  return response.data?.name || null;
}

/**
 * Fetches system-generated journal entries (status changes, condition/health updates,
 * document uploads, etc.) for a project. These are the "system update" entries shown
 * alongside user notes when "Show System Updates" is checked.
 */
export async function fetchJournalEntries(hostname, sessionToken, projectId) {
  const response = await callAction('get-project-journal', {
    hostname,
    token: sessionToken,
    projectId
  });

  const entries = (response.data || []).filter(entry => !isDuplicateJournalEntry(entry));

  entries.sort((a, b) => parseWorkfrontDate(b.entryDate) - parseWorkfrontDate(a.entryDate));

  return entries;
}

/**
 * Fetches documents attached to a project.
 */
export async function fetchDocuments(hostname, sessionToken, projectId) {
  const response = await callAction('get-project-documents', {
    hostname,
    token: sessionToken,
    projectId
  });

  const documents = (response.data || []).map((doc) => {
    const extensionFromCurrentVersion = doc.currentVersion?.ext;
    let extensionFromName = '';
    if (doc.name && doc.name.includes('.')) {
      const lastPart = doc.name.split('.').pop();
      if (lastPart.length <= 5 && !lastPart.includes(' ')) {
        extensionFromName = lastPart;
      }
    }

    return {
      ...doc,
      ext: extensionFromCurrentVersion || doc.ext || doc.fileType || doc.extension || extensionFromName,
      entryDate: doc.entryDate || doc.lastUpdateDate || doc.lastModDate
    };
  });

  return documents;
}

/**
 * Fetches documents attached to a portfolio, program, or project.
 */
export async function fetchCustomDocuments(hostname, sessionToken, objCode, objID) {
  const response = await callAction('get-custom-documents', {
    hostname,
    token: sessionToken,
    objCode,
    objID
  });

  return (response.data || []).map((doc) => ({
    ...doc,
    ext: doc.currentVersion?.ext || doc.ext || doc.fileType || doc.extension || '',
    entryDate: doc.entryDate || doc.lastUpdateDate || doc.lastModDate
  }));
}

/**
 * Fetches a document thumbnail through an action so auth does not depend on iframe cookies.
 */
export async function fetchDocumentThumbnail(hostname, sessionToken, documentId, documentVersionId, size) {
  const response = await callAction('get-document-thumbnail', {
    hostname,
    token: sessionToken,
    documentId,
    documentVersionId,
    size
  });

  return response.dataUrl;
}

/**
 * Fetches available project statuses.
 */
export async function fetchStatuses(hostname, sessionToken) {
  try {
    const response = await callAction('get-project-statuses', {
      hostname,
      token: sessionToken
    });

    const statuses = (response.data || []).map(status => ({
      value: status.enumValue || status.value,
      label: status.label || status.enumValue || status.value,
      rawStatus: status
    }));

    const uniqueStatuses = [];
    const seen = new Set();
    for (const status of statuses) {
      if (status.value && !seen.has(status.value)) {
        seen.add(status.value);
        uniqueStatuses.push({ value: status.value, label: status.label });
      }
    }

    return uniqueStatuses;
  } catch (error) {
    console.warn('Failed to fetch statuses, using defaults:', error);
    return [
      { value: 'CUR', label: 'Current' },
      { value: 'PLN', label: 'Planning' },
      { value: 'CPL', label: 'Complete' },
      { value: 'ONH', label: 'On Hold' },
      { value: 'DED', label: 'Dead' }
    ];
  }
}

/**
 * Calculates summary statistics client-side from the project list.
 */
export async function fetchProjectSummary(hostname, sessionToken) {
  try {
    const projects = await fetchProjects(hostname, sessionToken);

    const summary = {
      totalProjects: projects.length,
      byStatus: {},
      recentProjects: projects.slice(0, 5)
    };

    projects.forEach(project => {
      const status = project.status || 'Unknown';
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    });

    return summary;
  } catch (error) {
    console.error('Error fetching project summary:', error);
    return { totalProjects: 0, byStatus: {}, recentProjects: [] };
  }
}
