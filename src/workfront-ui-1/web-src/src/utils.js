/*
* <license header>
*/

/* global fetch */

/**
 *
 * Invokes a web action
 *
 * @param  {string} actionUrl
 * @param {object} headers
 * @param  {object} params
 *
 * @returns {Promise<string|object>} the response
 *
 */

async function actionWebInvoke (actionUrl, headers = {}, params = {}, options = { method: 'POST' }) {  
  const actionHeaders = {
    'Content-Type': 'application/json',
    ...headers
  }

  const fetchConfig = {
    headers: actionHeaders
  }

  if (window.location.hostname === 'localhost') {
    actionHeaders['x-ow-extra-logging'] = 'on'
  }

  fetchConfig.method = options.method.toUpperCase()

  if (fetchConfig.method === 'GET') {
    actionUrl = new URL(actionUrl)
    Object.keys(params).forEach(key => actionUrl.searchParams.append(key, params[key]))
  } else if (fetchConfig.method === 'POST') {
    fetchConfig.body = JSON.stringify(params)
  }
  
  const response = await fetch(actionUrl, fetchConfig)

  let content = await response.text()
  try {
    content = JSON.parse(content)
  } catch (e) {
    // response is not json
  }
  if (!response.ok) {
    const detail = typeof content === 'string'
      ? content
      : content?.error?.message || content?.error || content?.message
    const error = new Error(`HTTP ${response.status}: ${typeof detail === 'string' && detail ? detail : response.statusText || 'Request failed'}`)
    error.status = response.status
    throw error
  }
  return content
}

export default actionWebInvoke
