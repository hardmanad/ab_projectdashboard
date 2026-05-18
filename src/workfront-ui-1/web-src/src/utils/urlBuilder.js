/**
 * Ensures hostname has proper protocol (https://)
 * @param {string} hostname - Hostname from Workfront sharedContext
 * @returns {string} Hostname with https:// protocol
 */
export function ensureProtocol(hostname) {
  if (!hostname) {
    return '';
  }
  return hostname.startsWith('http') ? hostname : `https://${hostname}`;
}

/**
 * Builds a Workfront object URL
 * @param {string} hostname - Workfront hostname (with or without protocol)
 * @param {string} objCode - Workfront object code (PROJ, PORT, PRGM, DOCU, etc.)
 * @param {string} objID - Object ID
 * @returns {string} Full URL to the Workfront object
 */
export function buildWorkfrontObjectUrl(hostname, objCode, objID) {
  if (!hostname || !objCode || !objID) {
    return '';
  }

  const baseUrl = ensureProtocol(hostname);
  
  // Map object codes to URL paths
  const pathMap = {
    'PROJ': 'project',
    'PORT': 'portfolio',
    'PRGM': 'program',
    'DOCU': 'document',
    'TASK': 'task',
    'OPTASK': 'issue',
    'ISSUE': 'issue',
    'USER': 'user',
    'TMPL': 'template',
    'TTSK': 'task'
  };

  const path = pathMap[objCode] || objCode.toLowerCase();
  return `${baseUrl}/${path}/${objID}`;
}

/**
 * Builds a Workfront project URL
 * @param {string} hostname - Workfront hostname
 * @param {string} projectID - Project ID
 * @returns {string} Full URL to the project
 */
export function buildProjectUrl(hostname, projectID) {
  return buildWorkfrontObjectUrl(hostname, 'PROJ', projectID);
}

/**
 * Builds a Workfront portfolio URL
 * @param {string} hostname - Workfront hostname
 * @param {string} portfolioID - Portfolio ID
 * @returns {string} Full URL to the portfolio
 */
export function buildPortfolioUrl(hostname, portfolioID) {
  return buildWorkfrontObjectUrl(hostname, 'PORT', portfolioID);
}

/**
 * Builds a Workfront program URL
 * @param {string} hostname - Workfront hostname
 * @param {string} programID - Program ID
 * @returns {string} Full URL to the program
 */
export function buildProgramUrl(hostname, programID) {
  return buildWorkfrontObjectUrl(hostname, 'PRGM', programID);
}

/**
 * Builds a Workfront document URL
 * @param {string} hostname - Workfront hostname
 * @param {string} documentID - Document ID
 * @returns {string} Full URL to the document
 */
export function buildDocumentUrl(hostname, documentID) {
  return buildWorkfrontObjectUrl(hostname, 'DOCU', documentID);
}
