'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LedgerEntry, Trade } from '@/lib/types'
import { getTrades } from '@/lib/storage'
import { commitTradeLedgerState, getTradeLedgerState } from '@/lib/transaction'
import { useTradeActions } from './use-trade-actions'
import { useTradeSelectors } from './use-trade-selectors'

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setTrades(getTrades())
    setIsLoading(false)
  }, [])

  const persist = useCallback((nextTrades: Trade[], nextLedger?: LedgerEntry[]) => {
    commitTradeLedgerState({ trades: nextTrades, ledger: nextLedger ?? getTradeLedgerState().ledger })
    setTrades(nextTrades)
  }, [])

  const actions = useTradeActions(trades, persist)
  const selectors = useTradeSelectors(trades)
  const importTrades = useCallback((nextTrades: Trade[]) => persist(nextTrades), [persist])

  return { trades, isLoading, ...actions, ...selectors, importTrades }
}
