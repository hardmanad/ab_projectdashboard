/**
 * Normalizes Workfront's date format to standard ISO format
 * Workfront returns dates like "2026-01-22T09:20:05:825-0700" 
 * which needs to be converted to "2026-01-22T09:20:05.825-0700"
 * @param {string} dateString - Date string from Workfront API
 * @returns {string} Normalized ISO date string
 */
function normalizeWorkfrontDate(dateString) {
  if (!dateString) return dateString;
  
  // Replace the last colon before the timezone with a dot for milliseconds
  // Match pattern: T##:##:### where ### are milliseconds
  return dateString.replace(/T(\d{2}):(\d{2}):(\d{2}):(\d{3})/, 'T$1:$2:$3.$4');
}

/**
 * Formats an ISO date string from Workfront API to a readable format
 * @param {string} isoDate - ISO date string from Workfront
 * @param {boolean} includeTime - Whether to include time in the output
 * @param {boolean} fullFormat - Use full format with day of week
 * @returns {string} Formatted date string or empty string if date is null/undefined
 */
export function formatDate(isoDate, includeTime = false, fullFormat = false) {
  if (!isoDate) {
    return '';
  }

  try {
    // Normalize Workfront's non-standard date format
    const normalizedDate = normalizeWorkfrontDate(isoDate);
    const date = new Date(normalizedDate);
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatDate:', isoDate);
      return '';
    }

    if (fullFormat) {
      // Full format: "Thursday, January 22, 2026 12:22 PM"
      const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return date.toLocaleString('en-US', options);
    }

    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Formats a date as a relative time string (e.g., "2 hours ago", "3 days ago")
 * @param {string} isoDate - ISO date string from Workfront
 * @returns {string} Relative time string or empty string if date is null/undefined
 */
export function formatRelativeTime(isoDate) {
  if (!isoDate) {
    return '';
  }

  try {
    // Normalize Workfront's non-standard date format
    const normalizedDate = normalizeWorkfrontDate(isoDate);
    const date = new Date(normalizedDate);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatRelativeTime:', isoDate);
      return '';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
    }

    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '';
  }
}
