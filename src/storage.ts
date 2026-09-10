import type { AppData } from './api'

const KEY = 'mt_appdata_v1'

export function loadStoredData(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as AppData).movies) ||
      !Array.isArray((parsed as AppData).series)
    ) {
      return null
    }
    return parsed as AppData
  } catch {
    return null
  }
}

export function saveDataToStorage(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage unavailable — regular server save still covers sync
  }
}