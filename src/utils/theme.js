export const THEME_KEY = 'siteTheme'
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
}

export function getStoredTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT
}

export function applyTheme(theme) {
  const nextTheme = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT
  document.documentElement.classList.toggle('dark', nextTheme === THEMES.DARK)
  document.documentElement.dataset.theme = nextTheme
  document.documentElement.style.colorScheme = nextTheme
  return nextTheme
}

export function saveTheme(theme) {
  const nextTheme = applyTheme(theme)
  localStorage.setItem(THEME_KEY, nextTheme)
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: nextTheme } }))
  return nextTheme
}

export function initTheme() {
  applyTheme(getStoredTheme())
}
