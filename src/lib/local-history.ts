/**
 * localStorage session restore — persists the current page state between navigations.
 */

export function saveLastSession(data: object) {
  try {
    localStorage.setItem('endo_health_last_session', JSON.stringify(data))
  } catch {}
}

export function loadLastSession<T>(): T | null {
  try {
    const raw = localStorage.getItem('endo_health_last_session')
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
