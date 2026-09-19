import { DEFAULT_SETTINGS, type ExportedData, type LedgerEntry, type Settings, type Trade } from './types'
import { getLedger, saveLedger } from './ledger'

const TRADES_KEY = 'crypto-trades'
const SETTINGS_KEY = 'crypto-settings'

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

export function getTrades(): Trade[] {
  const trades = readJson<unknown>(TRADES_KEY, [])
  return Array.isArray(trades) ? trades as Trade[] : []
}

export function saveTrades(trades: Trade[]): void {
  if (typeof window !== 'undefined') localStorage.setItem(TRADES_KEY, JSON.stringify(trades))
}

export function getSettings(): Settings {
  const settings = readJson<Partial<Settings>>(SETTINGS_KEY, DEFAULT_SETTINGS)
  const targets = settings.targets?.length === 3 ? settings.targets : DEFAULT_SETTINGS.targets
  const safeSettings: Settings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    targets,
  }
  if (typeof window !== 'undefined') localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeSettings))
  return safeSettings
}

export function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return
  const safeSettings: Settings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    targets: settings.targets?.length === 3 ? settings.targets : DEFAULT_SETTINGS.targets,
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeSettings))
}

export function exportData(): string {
  const data: ExportedData = {
    trades: getTrades(),
    settings: getSettings(),
    ledger: getLedger(),
    exportedAt: new Date().toISOString(),
  }
  return JSON.stringify(data, null, 2)
}

export function importData(jsonString: string): ExportedData {
  const data = JSON.parse(jsonString) as Partial<ExportedData>
  const trades = Array.isArray(data.trades) ? data.trades : []
  const settings = data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : DEFAULT_SETTINGS
  const ledger: LedgerEntry[] = Array.isArray(data.ledger) ? data.ledger : []
  saveTrades(trades)
  saveSettings(settings)
  saveLedger(ledger)
  return {
    trades,
    settings,
    ledger,
    exportedAt: data.exportedAt || new Date().toISOString(),
  }
}

export function downloadJSON(filename: string, data: string): void {
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
