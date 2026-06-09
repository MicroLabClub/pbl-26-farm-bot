const STORAGE_KEY = 'dashboard-settings'

export interface DashboardSettings {
  rehoming: number
  moistLow: number
  moistHigh: number
  apiUrl: string
  mqtt: string
  alerts: boolean
  mock: boolean
}

const defaults: DashboardSettings = {
  rehoming: 20,
  moistLow: 40,
  moistHigh: 80,
  apiUrl: 'https://my.farmbot.io',
  mqtt: 'wss://my.farmbot.io:3002/ws',
  alerts: true,
  mock: false,
}

export function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(s: DashboardSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
