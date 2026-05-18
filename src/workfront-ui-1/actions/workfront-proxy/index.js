/**
 * Workfront API Proxy Action
 * Proxies requests from the browser to the Workfront API to avoid CORS issues
 */

const fetch = require('node-fetch');

/**
 * Main action handler
 * @param {object} params - Action parameters
 * @param {string} params.hostname - Workfront hostname (e.g., "company.my.workfront.com")
 * @param {string} params.endpoint - API endpoint (e.g., "project/search")
 * @param {string} params.token - IMS token for authentication
 * @param {object} params.queryParams - Query parameters for the request
 * @returns {object} Response with statusCode, body, and headers
 */
async function main(params) {
  // Log incoming request (without sensitive data)
  console.log('Workfront proxy request:', {
    hostname: params.hostname,
    endpoint: params.endpoint,
    hasToken: !!params.token
  });

  // Validate required parameters
  if (!params.hostname) {
    return {
      statusCode: 400,
      body: { error: 'Missing required parameter: hostname' }
    };
  }

  if (!params.endpoint) {
    return {
      statusCode: 400,
      body: { error: 'Missing required parameter: endpoint' }
    };
  }

  if (!params.token) {
    return {
      statusCode: 400,
      body: { error: 'Missing required parameter: token' }
    };
  }

  try {
    // Ensure hostname has proper protocol
    const hostname = params.hostname.startsWith('http') 
      ? params.hostname 
      : `https://${params.hostname}`;

    // Build the Workfront API URL
    const apiVersion = 'v20.0';
    const url = new URL(`${hostname}/attask/api/${apiVersion}/${params.endpoint}`);

    // Add query parameters if provided
    if (params.queryParams) {
      Object.keys(params.queryParams).forEach(key => {
        if (params.queryParams[key] !== null && params.queryParams[key] !== undefined) {
          url.searchParams.append(key, params.queryParams[key]);
        }
      });
    }

    console.log('Making Workfront API request to:', url.toString());

    // Determine if token is IMS (JWT) or session token
    const headers = {
      'Content-Type': 'application/json'
    };

    if (params.token.startsWith('eyJ')) {
      // IMS token - use Bearer authentication
      headers['Authorization'] = `Bearer ${params.token}`;
    } else {
      // Session token
      headers['sessionID'] = params.token;
    }

    // Make the request to Workfront API
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: headers
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    console.log('Workfront API response status:', response.status);

    // Return the response
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: {
          error: 'Workfront API error',
          status: response.status,
          data: responseData
        }
      };
    }

    return {
      statusCode: 200,
      body: responseData
    };

  } catch (error) {
    console.error('Error in Workfront proxy:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Internal server error',
        message: error.message
      }
    };
  }
}

exports.main = main;
