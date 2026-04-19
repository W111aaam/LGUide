const API_BASE = (import.meta.env.VITE_POMODORO_API_BASE || '').replace(/\/$/, '')
const LOCAL_API_HINT = '本地未连接番茄钟 Worker API。请在 worker/ 目录运行 npx wrangler dev --port 8787，或设置 VITE_POMODORO_API_BASE 指向已部署的 Worker。'

function getApiUrl(path) {
  return `${API_BASE}${path}`
}

function getRequestErrorMessage(status, fallbackMessage) {
  if (import.meta.env.DEV && !API_BASE && (status === 404 || status >= 500)) {
    return LOCAL_API_HINT
  }
  return fallbackMessage
}

async function request(path, options = {}) {
  let response

  try {
    response = await fetch(getApiUrl(path), {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch (error) {
    throw new Error(import.meta.env.DEV && !API_BASE ? LOCAL_API_HINT : (error.message || 'Network request failed'))
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getRequestErrorMessage(response.status, data.error || `Request failed with ${response.status}`))
  }
  return data
}

export function fetchPomodoroAuthSession() {
  return request('/api/auth/session')
}

export function registerPomodoroUser({ username, password }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function loginPomodoroUser({ username, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logoutPomodoroUser() {
  return request('/api/auth/logout', {
    method: 'POST',
  })
}

export function savePomodoroSession({ startedAt, endedAt, durationSeconds }) {
  return request('/api/session', {
    method: 'POST',
    body: JSON.stringify({
      id: crypto.randomUUID(),
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      completed: true,
    }),
  })
}

export function fetchPomodoroHeatmap(year = new Date().getFullYear()) {
  const params = new URLSearchParams({ year: String(year) })
  return request(`/api/heatmap?${params.toString()}`)
}

export function fetchPomodoroStats() {
  return request('/api/stats')
}
