import { DEFAULT_SETTINGS, type ExportedData, type LedgerEntry, type Settings, type Trade } from './types'
import { getLedger, saveLedger } from './ledger'
import { validateExportedData } from './schema'
import { notifyDataChanged } from './data-change-events'

const TRADES_KEY = 'crypto-trades'
const SETTINGS_KEY = 'crypto-settings'
const BACKUPS_KEY = 'crypto-backups'
const CURRENT_SCHEMA_VERSION = 1
const MAX_BACKUPS = 10

export interface Backup {
  id: string
  savedAt: string
  reason: string
  data: ExportedData
}

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
  notifyDataChanged()
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
  notifyDataChanged()
}

export function exportData(): string {
  const data: ExportedData = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    trades: getTrades(),
    settings: getSettings(),
    ledger: getLedger(),
    exportedAt: new Date().toISOString(),
  }
  return JSON.stringify(data, null, 2)
}

// -----------------------------------------------------------------------
// Backups
// -----------------------------------------------------------------------

export function getBackups(): Backup[] {
  return readJson<Backup[]>(BACKUPS_KEY, [])
}

function saveBackups(backups: Backup[]): void {
  if (typeof window !== 'undefined') localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups))
}

/**
 * Guarda um snapshot do estado atual antes de uma operação destrutiva
 * (import, reset). Sem isso, um arquivo importado por engano ou corrompido
 * substitui o histórico de trades da pessoa sem qualquer forma de desfazer.
 */
export function createBackup(reason: string): Backup {
  const backup: Backup = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    reason,
    data: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      trades: getTrades(),
      settings: getSettings(),
      ledger: getLedger(),
      exportedAt: new Date().toISOString(),
    },
  }
  const backups = [backup, ...getBackups()].slice(0, MAX_BACKUPS)
  saveBackups(backups)
  return backup
}

export function restoreBackup(id: string): ExportedData | null {
  const backup = getBackups().find((item) => item.id === id)
  if (!backup) return null
  saveTrades(backup.data.trades)
  saveSettings(backup.data.settings)
  saveLedger(backup.data.ledger)
  return backup.data
}

// -----------------------------------------------------------------------
// Import / Export
// -----------------------------------------------------------------------

export interface ImportResult {
  success: boolean
  data?: ExportedData
  errors: string[]
}

/**
 * Importa dados de um backup JSON validando o schema antes de tocar em
 * qualquer coisa. Um backup automático do estado atual é criado antes de
 * sobrescrever, para que uma importação equivocada seja reversível.
 */
export function importData(jsonString: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    return { success: false, errors: ['O arquivo não é um JSON válido.'] }
  }

  const validation = validateExportedData(parsed)
  if (!validation.success || !validation.data) {
    return { success: false, errors: validation.errors }
  }

  if (typeof window !== 'undefined' && (getTrades().length > 0 || getLedger().length > 0)) {
    createBackup('Backup automático antes de importar dados')
  }

  const { trades, settings, ledger, exportedAt } = validation.data
  saveTrades(trades)
  saveSettings(settings)
  saveLedger(ledger)

  return {
    success: true,
    data: { trades, settings, ledger, exportedAt },
    errors: [],
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
