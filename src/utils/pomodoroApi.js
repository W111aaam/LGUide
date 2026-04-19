const USER_ID_KEY = 'lguide_user_id'

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

export function getPomodoroUserId() {
  let userId = localStorage.getItem(USER_ID_KEY)
  if (!userId) {
    userId = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, userId)
  }
  return userId
}

async function request(path, options = {}) {
  let response

  try {
    response = await fetch(getApiUrl(path), {
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

export function touchPomodoroUser(userId) {
  return request('/api/user', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
}

export function savePomodoroSession({ userId, startedAt, endedAt, durationSeconds }) {
  return request('/api/session', {
    method: 'POST',
    body: JSON.stringify({
      id: crypto.randomUUID(),
      user_id: userId,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      completed: true,
    }),
  })
}

export function fetchPomodoroHeatmap(userId, year = new Date().getFullYear()) {
  const params = new URLSearchParams({ user_id: userId, year: String(year) })
  return request(`/api/heatmap?${params.toString()}`)
}

export function fetchPomodoroStats(userId) {
  const params = new URLSearchParams({ user_id: userId })
  return request(`/api/stats?${params.toString()}`)
}
