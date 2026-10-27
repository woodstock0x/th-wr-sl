'use client'

import { useCallback, useMemo } from 'react'
import type { Trade } from '@/lib/types'
import { getActiveTrades, getFinishedTrades, getTradeById } from '@/lib/trade-operations'

export function useTradeSelectors(trades: Trade[]) {
  const activeTrades = useMemo(() => getActiveTrades(trades), [trades])
  const finishedTrades = useMemo(() => getFinishedTrades(trades), [trades])

  const findTrade = useCallback((id: string) => getTradeById(trades, id), [trades])
  const getActive = useCallback(() => activeTrades, [activeTrades])
  const getFinished = useCallback(() => finishedTrades, [finishedTrades])

  return { activeTrades, finishedTrades, getTradeById: findTrade, getActiveTrades: getActive, getFinishedTrades: getFinished }
}
