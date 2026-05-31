const DEFAULT_API_BASE = '/api'

function normalizeApiBaseUrl(rawValue) {
  const value = (rawValue || DEFAULT_API_BASE).replace(/\/$/, '')

  if (/^https?:\/\//i.test(value) && !/\/api(\/|$)/i.test(value)) {
    return `${value}/api`
  }

  return value
}

export function getApiBaseUrl() {
  return normalizeApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    DEFAULT_API_BASE
  )
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('es_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getStoredToken() {
  return localStorage.getItem('es_token') || ''
}

export function getFriendlyErrorMessage(error) {
  const message = String(error?.message || error || '').trim()
  const lower = message.toLowerCase()

  if (!message) return 'Something went wrong. Please try again.'
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
    return 'Network problem. Please check your connection and try again.'
  }
<<<<<<< HEAD
  if (
    lower.includes('resend_api_key is missing') ||
    lower.includes('from_email is missing') ||
    lower.includes('email_from is missing')
  ) {
=======
  if (lower.includes('resend_api_key is missing') || lower.includes('email_from is missing')) {
>>>>>>> 34a4ab751b7f0d6c2ea8b284c044162df3e2cf90
    return 'Email service is not set up yet on the server.'
  }
  if (lower.includes('failed to send verification code')) {
    return 'We could not send the code right now. Please try again shortly.'
  }
  if (lower.includes('unauthorized')) {
    return 'Your session has expired. Please sign in again.'
  }
  if (lower.includes('forbidden')) {
    return 'You do not have permission to do that.'
  }
  if (lower.includes('not found')) {
    return 'We could not find that item.'
  }
  if (lower.includes('request failed')) {
    return 'The server did not respond properly. Please try again.'
  }

  return message
}

export function persistSession(user, token) {
  if (user) {
    localStorage.setItem('es_user', JSON.stringify(user))
  } else {
    localStorage.removeItem('es_user')
  }

  if (token) {
    localStorage.setItem('es_token', token)
  } else {
    localStorage.removeItem('es_token')
  }
}

export function clearSession() {
  localStorage.removeItem('es_user')
  localStorage.removeItem('es_token')
}

async function readResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await response.text()
    return text ? { message: text } : {}
  }

  try {
    return await response.json()
  } catch {
    return {}
  }
}

export async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl()
  const token = getStoredToken()
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response
  try {
    response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...options,
      headers,
    })
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error))
  }

  const payload = await readResponse(response)

  if (!response.ok || payload.success === false) {
    throw new Error(getFriendlyErrorMessage(payload.message || 'Request failed'))
  }

  return payload
}