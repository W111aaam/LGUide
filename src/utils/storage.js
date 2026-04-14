/**
 * 通用 localStorage 读写工具。
 * 后续各功能模块（番茄钟、课表等）均可复用这两个函数。
 */

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}
