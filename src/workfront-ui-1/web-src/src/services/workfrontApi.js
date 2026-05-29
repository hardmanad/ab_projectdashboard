/**
 * Workfront API Service
 * Provides functions to interact with Workfront REST API v20.0
 * Uses Adobe I/O Runtime action as a proxy to avoid CORS issues
 */

import actionWebInvoke from '../utils';

/**
 * Makes a GET request to Workfront API via the proxy action
 * @param {string} hostname - Workfront hostname
 * @param {string} sessionToken - Session token from sharedContext
 * @param {string} endpoint - API endpoint (e.g., 'project/search')
 * @param {object} params - Query parameters
 * @returns {Promise<any>} API response data
 */
/**
 * Gets the action URL for the workfront-proxy action
 * Constructs it based on the current window location
 */
function getActionUrl() {
  const actionPath = '/api/v1/web/workfront-ui-1/workfront-proxy';

  if (process.env.AIO_STATIC_HOST) {
    return `https://${process.env.AIO_STATIC_HOST}${actionPath}`;
  }

  // Fallback: construct URL from current window location
  const currentHost = window.location.origin;

  if (currentHost.includes('localhost')) {
    return `${currentHost}${actionPath}`;
  }

  // Deployed: derive runtime URL from the static hosting subdomain
  const namespace = window.location.hostname.split('.')[0];
  return `https://${namespace}.adobeioruntime.net${actionPath}`;
}

async function makeApiRequest(hostname, sessionToken, endpoint, params = {}) {
  // console.log('Making Workfront API request via proxy:', endpoint);
  // console.log('Session token present:', !!sessionToken);

  // Get the action URL
  const actionUrl = getActionUrl();
  // console.log('Action URL:', actionUrl);

  // Prepare the payload for the action
  const actionParams = {
    hostname: hostname,
    endpoint: endpoint,
    token: sessionToken,
    queryParams: params
  };

  try {
    // Call the proxy action
    const response = await actionWebInvoke(actionUrl, {}, actionParams, { method: 'POST' });
    
    // console.log('Proxy action response received');

    // Check if there was an error in the response
    if (response.error) {
      throw new Error(`Workfront API error via proxy: ${response.error} - ${JSON.stringify(response.data || response.message)}`);
    }

    return response;
  } catch (error) {
    console.error('Error calling proxy action:', error);
    throw error;
  }
}

/**
 * Fetches projects from Workfront with optional status filter
 * @param {string} hostname - Workfront hostname
 * @param {string} sessionToken - Session token
 * @param {Array<string>} statusFilter - Array of status codes to filter by (e.g., ['CUR', 'PLN'])
 * @returns {Promise<Array>} Array of project objects
 */
export async function fetchProjects(hostname, sessionToken, statusFilter = []) {
  const params = {
    fields: '*,owner:name,portfolio:name,program:name,group:name,company:name',
    '$$LIMIT': 1000
  };

  // Add status filter if provided (OR logic - match any of the selected statuses)
  if (statusFilter && statusFilter.length > 0) {
    // console.log('Fetching projects with status filter (OR logic):', statusFilter);
    if (statusFilter.length === 1) {
      // Single status - use simple equality
      params.status = statusFilter[0];
      params.status_Mod = 'eq';
    } else {
      // Multiple statuses - use OR filter syntax
      // Workfront API requires OR:1:field=value, OR:2:field=value pattern for OR logic
      statusFilter.forEach((status, index) => {
        const orIndex = index + 1;
        params[`OR:${orIndex}:status`] = status;
        params[`OR:${orIndex}:status_Mod`] = 'eq';
      });
    }
  } else {
    // console.log('Fetching ALL projects (no status filter)');
  }

  // console.log('API Request params:', JSON.stringify(params, null, 2));
  const response = await makeApiRequest(hostname, sessionToken, 'project/search', params);
  
  // Workfront returns data in a 'data' property
  const projects = response.data || [];
  
  // console.log(`Received ${projects.length} projects from Workfront API`);
  
  // Log unique statuses in the returned projects
  const uniqueStatuses = [...new Set(projects.map(p => p.status).filter(s => s))];
  // console.log('Unique statuses in returned projects:', uniqueStatuses);
  
  // Sort by entryDate DESC (most recent first)
  projects.sort((a, b) => {
    const dateA = new Date(a.entryDate || 0);
    const dateB = new Date(b.entryDate || 0);
    return dateB - dateA;
  });

  return projects;
}

/**
 * Fetches detailed information for a specific project
 * @param {string} hostname - Workfront hostname
 * @param {string} sessionToken - Session token
 * @param {string} projectId - Project ID
 * @returns {Promise<object>} Project object with detailed information
 */
export async function fetchProjectDetails(hostname, sessionToken, projectId) {
  const params = {
    fields: '*,owner:name,portfolio:name,program:name,group:name,company:name'
  };

  const response = await makeApiRequest(hostname, sessionToken, `project/${projectId}`, params);
  return response.data || response;
}

/**
 * Fetches comments/notes for a project
 * @param {string} hostname - Workfront hostname
 * @param {string} sessionToken - Session token
 * @param {string} projectId - Project ID
 * @param {number} limit - Number of comments to fetch (default 10)
 * @param {number} offset - Offset for pagination (default 0)
 * @returns {Promise<Array>} Array of note objects
 */
export async function fetchComments(hostname, sessionToken, projectId, limit = 10, offset = 0) {
  const params = {
    projectID: projectId,
    projectID_Mod: 'eq',
    fields: '*,owner:name,opTask:name,task:name,project:name',
    '$$LIMIT': limit,
    '$$FIRST': offset
  };

  const response = await makeApiRequest(hostname, sessionToken, 'note/search', params);
  const notes = response.data || [];
  
  // Filter to only include notes with actual text content
  const notesWithText = notes.filter(note => note.noteText && note.noteText.trim() !== '');
  
  // Sort by entryDate DESC (newest first)
  notesWithText.sort((a, b) => {
    const dateA = new Date(a.entryDate || 0);
    const dateB = new Date(b.entryDate || 0);
    return dateB - dateA;
  });

  return notesWithText;
}

/**
 * Fetches documents attached to a project
 * @param {string} hostname - Workfront hostname
 * @param {string} sessionToken - Session token
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of document objects
 */
export async function fetchDocuments(hostname, sessionToken, projectId) {
  const params = {
    docObjCode: 'PROJ',
    docObjCode_Mod: 'eq',
    objID: projectId,
    objID_Mod: 'eq',
    fields: '*,owner:name,currentVersion:ext,currentVersionID'
  };

  const response = await makeApiRequest(hostname, sessionToken, 'document/search', params);
  
  // Use whatever fields are returned - try multiple field names for extension
  const documents = (response.data || []).map((doc) => {
    // Extract extension from currentVersion object or filename as fallback
    let extensionFromCurrentVersion = doc.currentVersion?.ext;
    let extensionFromName = '';
    if (doc.name && doc.name.includes('.')) {
      const parts = doc.name.split('.');
      // Only use extension if it looks valid (not more than 5 chars, no spaces)
      const lastPart = parts[parts.length - 1];
      if (lastPart.length <= 5 && !lastPart.includes(' ')) {
        extensionFromName = lastPart;
      }
    }
    
    return {
      ...doc,
      ext: extensionFromCurrentVersion || doc.ext || doc.fileType || doc.extension || extensionFromName,
      entryDate: doc.lastUpdateDate || doc.lastModDate
    };
  });
  
  return documents;
}

/**
 * Fetches available project statuses
 * @param {string} hostname - Workfront hostname
 * @param {string} sessionToken - Session token
 * @returns {Promise<Array>} Array of status objects
 */
export async function fetchStatuses(hostname, sessionToken) {
  const params = {
    fields: '*',
    enumClass: 'STATUS_PROJ',
    '$$LIMIT': 2000
  };

  try {
    const response = await makeApiRequest(hostname, sessionToken, 'CSTEM/search', params);
    // console.log('Raw CSTEM response data count:', response.data?.length || 0);
    
    const statuses = (response.data || []).map((status, index) => {
      // Log first few statuses for debugging
      // if (index < 5) {
      //   console.log(`Status ${index}:`, {
      //     enumValue: status.enumValue,
      //     value: status.value,
      //     label: status.label,
      //     allKeys: Object.keys(status)
      //   });
      // }
      
      // Map CSTEM response to the format expected by StatusFilter
      // CSTEM returns fields like: enumValue, label, etc.
      return {
        value: status.enumValue || status.value,
        label: status.label || status.enumValue || status.value,
        rawStatus: status
      };
    });
    
    // console.log(`Mapped ${statuses.length} statuses before deduplication`);
    
    // Deduplicate statuses based on the 'value' field
    const uniqueStatuses = [];
    const seenValues = new Set();
    
    for (const status of statuses) {
      if (status.value && !seenValues.has(status.value)) {
        seenValues.add(status.value);
        uniqueStatuses.push({
          value: status.value,
          label: status.label
        });
      }
    }
    
    // console.log('Fetched unique statuses from CSTEM:', uniqueStatuses);
    // console.log('Status values:', uniqueStatuses.map(s => s.value).join(', '));
    
    // Check if PLN is in the list
    // const hasPLN = uniqueStatuses.some(s => s.value === 'PLN');
    // console.log('Has PLN status:', hasPLN);
    
    return uniqueStatuses;
  } catch (error) {
    // If status fetch fails, return common default statuses
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
 * Fetches summary statistics for projects
 * @param {string} hostname - Workfront hostname
 * @param {string} sessionToken - Session token
 * @returns {Promise<object>} Summary statistics
 */
export async function fetchProjectSummary(hostname, sessionToken) {
  try {
    // Fetch all current projects for summary
    const projects = await fetchProjects(hostname, sessionToken);
    
    // Calculate statistics
    const summary = {
      totalProjects: projects.length,
      byStatus: {},
      recentProjects: projects.slice(0, 5) // Top 5 most recent
    };

    // Count projects by status
    projects.forEach(project => {
      const status = project.status || 'Unknown';
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    });

    return summary;
  } catch (error) {
    console.error('Error fetching project summary:', error);
    return {
      totalProjects: 0,
      byStatus: {},
      recentProjects: []
    };
  }
}
