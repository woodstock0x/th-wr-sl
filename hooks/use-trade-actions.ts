'use client'

import { useCallback } from 'react'
import type { LedgerEntry, Realization, Trade } from '@/lib/types'
import { ledgerCashBalance } from '@/lib/ledger'
import { commitTradeLedgerState, getTradeLedgerState } from '@/lib/transaction'
import { getRealizationProfit, getRemainingQuantity, getTargetsHit, updateTradeById } from '@/lib/trade-operations'

type NewTradeInput = Omit<Trade, 'id' | 'remainingQuantity' | 'status' | 'realizations' | 'targetsHit' | 'createdAt'>
type Persist = (trades: Trade[], ledger?: LedgerEntry[]) => void

export function useTradeActions(trades: Trade[], persist: Persist) {
  const update = useCallback((id: string, updater: (trade: Trade) => Trade) => {
    const next = updateTradeById(trades, id, updater)
    persist(next)
    return next
  }, [trades, persist])

  const addTrade = useCallback((input: NewTradeInput) => {
    const remainingQuantity = input.quantity - (input.fee || 0)
    const newTrade: Trade = { ...input, id: crypto.randomUUID(), fee: input.fee || 0, remainingQuantity, status: 'ATIVO', realizations: [], targetsHit: [], createdAt: new Date().toISOString() }
    const currentLedger = getTradeLedgerState().ledger
    let nextLedger = currentLedger
    if (input.fundingSource === 'CASH') {
      const amount = input.entryPrice * input.quantity
      if (amount > ledgerCashBalance()) throw new Error('Saldo insuficiente')
      nextLedger = [...currentLedger, { id: crypto.randomUUID(), type: 'TRADE_ENTRY', amount: -amount, tradeId: newTrade.id, date: new Date().toISOString() }]
    }
    persist([...trades, newTrade], nextLedger)
    return newTrade
  }, [trades, persist])

  const updateTrade = useCallback((id: string, updates: Partial<Trade>) => update(id, (trade) => ({ ...trade, ...updates })), [update])

  const deleteTrade = useCallback((id: string) => {
    const ledger = getTradeLedgerState().ledger.filter((entry) => entry.tradeId !== id)
    persist(trades.filter((trade) => trade.id !== id), ledger)
  }, [trades, persist])

  const addRealization = useCallback((tradeId: string, input: Omit<Realization, 'id' | 'tradeId' | 'usdValue' | 'ledgerId' | 'profit'>, maxTargetLevel = 3) => {
    const trade = trades.find((item) => item.id === tradeId)
    if (!trade) return
    if (input.quantity > trade.remainingQuantity) throw new Error('Quantidade maior que a disponível')
    const value = input.exitPrice * input.quantity
    const ledgerId = crypto.randomUUID()
    const realization: Realization = { ...input, id: crypto.randomUUID(), tradeId, ledgerId, profit: getRealizationProfit(input, trade), usdValue: value, rebuyStatus: 'PENDING' }
    const nextTrades = updateTradeById(trades, tradeId, (current) => {
      const realizations = [...current.realizations, realization]
      const remainingQuantity = getRemainingQuantity(current, realizations)
      const targetsHit = getTargetsHit(realizations)
      const stopLosses = input.targetLevel > 0 ? (current.stopLosses || []).map((stop) => stop.targetLevel === input.targetLevel ? { ...stop, status: 'ENCERRADO' as const } : stop) : current.stopLosses || []
      return { ...current, realizations, remainingQuantity, targetsHit, stopLosses, status: remainingQuantity <= 0 || input.targetLevel >= maxTargetLevel ? 'FINALIZADO' : 'ATIVO' }
    })
    const ledger = [...getTradeLedgerState().ledger, { id: ledgerId, type: 'REALIZATION' as const, amount: value, tradeId, date: new Date().toISOString() }]
    persist(nextTrades, ledger)
  }, [trades, persist])

  const deleteRealization = useCallback((tradeId: string, realizationId: string, maxTargetLevel = 3) => {
    const current = trades.find((trade) => trade.id === tradeId)
    const realization = current?.realizations.find((item) => item.id === realizationId)
    const ledger = getTradeLedgerState().ledger.filter((entry) => entry.id !== realization?.ledgerId)
    const nextTrades = updateTradeById(trades, tradeId, (trade) => {
      const realizations = trade.realizations.filter((item) => item.id !== realizationId)
      const remainingQuantity = getRemainingQuantity(trade, realizations)
      const targetsHit = getTargetsHit(realizations)
      return { ...trade, realizations, remainingQuantity, targetsHit, status: remainingQuantity <= 0 || targetsHit.includes(maxTargetLevel) ? 'FINALIZADO' : 'ATIVO' }
    })
    persist(nextTrades, ledger)
  }, [trades, persist])

  const setRealizationStatus = useCallback((tradeId: string, realizationId: string, rebuyStatus: 'PENDING' | 'DISMISSED') => update(tradeId, (trade) => ({ ...trade, realizations: trade.realizations.map((item) => item.id === realizationId ? { ...item, rebuyStatus } : item) })), [update])
  const setTargetIgnored = useCallback((tradeId: string, targetLevel: number, ignored: boolean) => update(tradeId, (trade) => ({ ...trade, targetsIgnored: ignored ? [...new Set([...(trade.targetsIgnored || []), targetLevel])] : (trade.targetsIgnored || []).filter((level) => level !== targetLevel) })), [update])
  const setTargetStopLoss = useCallback((tradeId: string, targetLevel: number, price: number, quantity: number) => {
    if (!Number.isFinite(price) || price <= 0) throw new Error('Preço do Stop Loss inválido')
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantidade do Stop Loss inválida')
    update(tradeId, (trade) => {
      const stopLosses = [...(trade.stopLosses || [])]
      const index = stopLosses.findIndex((stop) => stop.targetLevel === targetLevel)
      const value = { targetLevel, price, quantity, status: 'ATIVO' as const }
      if (index >= 0) stopLosses[index] = { ...stopLosses[index], ...value }
      else stopLosses.push(value)
      return { ...trade, stopLosses }
    })
  }, [update])
  const removeTargetStopLoss = useCallback((tradeId: string, targetLevel: number) => update(tradeId, (trade) => ({ ...trade, stopLosses: (trade.stopLosses || []).filter((stop) => stop.targetLevel !== targetLevel) })), [update])

  return { addTrade, updateTrade, deleteTrade, addRealization, deleteRealization, dismissRebuyOpportunity: (id: string, realizationId: string) => setRealizationStatus(id, realizationId, 'DISMISSED'), restoreRebuyOpportunity: (id: string, realizationId: string) => setRealizationStatus(id, realizationId, 'PENDING'), dismissTargetOpportunity: (id: string, level: number) => setTargetIgnored(id, level, true), restoreTargetOpportunity: (id: string, level: number) => setTargetIgnored(id, level, false), setTargetStopLoss, removeTargetStopLoss }
}
