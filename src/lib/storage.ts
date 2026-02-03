type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null || raw === '') return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Safe localStorage writer.
 * - Uses JSON.stringify
 * - Never throws (important for Safari private mode / quota / blocked storage)
 */
export function setJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value as JsonValue))
  } catch {
    // ignore
  }
}

/**
 * Optional helper: remove a key safely (useful for debugging/reset buttons)
 */
export function removeKey(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
