import type { LedgerEntry } from './types'

const LEDGER_KEY = 'ledger'

function readLedger(): LedgerEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const value = localStorage.getItem(LEDGER_KEY)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed as LedgerEntry[] : []
  } catch {
    return []
  }
}

export function getLedger(): LedgerEntry[] {
  return readLedger()
}

export function saveLedger(ledger: LedgerEntry[]): void {
  if (typeof window !== 'undefined') localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger))
}

export function saveLedgerEntry(entry: LedgerEntry): void {
  saveLedger([...readLedger(), entry])
}

export function deleteLedgerEntry(id: string): void {
  saveLedger(readLedger().filter((entry) => entry.id !== id))
}

export function deleteLedgerEntriesByTradeId(tradeId: string): void {
  saveLedger(readLedger().filter((entry) => entry.tradeId !== tradeId))
}

export function ledgerCashBalance(): number {
  return readLedger().reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
}
