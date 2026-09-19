import type { LedgerEntry, Trade } from './types'
import { getLedger, saveLedger } from './ledger'
import { getTrades, saveTrades } from './storage'

export interface TradeLedgerState {
  trades: Trade[]
  ledger: LedgerEntry[]
}

export function getTradeLedgerState(): TradeLedgerState {
  return { trades: getTrades(), ledger: getLedger() }
}

/** Persiste trades e ledger como uma única operação da aplicação, com rollback. */
export function commitTradeLedgerState(next: TradeLedgerState): void {
  const previous = getTradeLedgerState()

  try {
    saveTrades(next.trades)
    saveLedger(next.ledger)
  } catch (error) {
    try {
      saveTrades(previous.trades)
      saveLedger(previous.ledger)
    } catch {
      // Mantém o erro original: o rollback é apenas uma proteção adicional.
    }
    throw error
  }
}

export function updateTradeLedgerState(
  updater: (current: TradeLedgerState) => TradeLedgerState,
): TradeLedgerState {
  const next = updater(getTradeLedgerState())
  commitTradeLedgerState(next)
  return next
}

export function getLedgerBalance(ledger: LedgerEntry[]): number {
  return ledger.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
}
