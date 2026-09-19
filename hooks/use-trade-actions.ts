'use client'

import { useCallback } from 'react'
import type { LedgerEntry, Realization, Trade } from '@/lib/types'
import { ledgerCashBalance } from '@/lib/ledger'
import { commitTradeLedgerState, getTradeLedgerState } from '@/lib/transaction'
import { getRealizationProfit, getRemainingQuantity, getTargetsHit, updateTradeById } from '@/lib/trade-operations'
import { roundCurrency, roundQuantity } from '@/lib/precision'

type NewTradeInput = Omit<Trade, 'id' | 'remainingQuantity' | 'status' | 'realizations' | 'targetsHit' | 'createdAt'>
type Persist = (trades: Trade[], ledger?: LedgerEntry[]) => void

/**
 * `trades` (o argumento do hook) é o snapshot de estado do último render do
 * React. Se duas ações disparam em sequência rápida antes de o componente
 * re-renderizar (ex.: dois cliques, ou uma resposta assíncrona), ambas
 * fechariam sobre o mesmo array antigo e a segunda `persist(...)` apagaria
 * a mudança da primeira (lost update). Por isso toda mutação aqui lê o
 * estado atual direto do localStorage via `getTradeLedgerState()` em vez de
 * usar o `trades` do closure — a fonte de verdade é sempre a persistida.
 */
export function useTradeActions(trades: Trade[], persist: Persist) {
  const update = useCallback((id: string, updater: (trade: Trade) => Trade) => {
    const current = getTradeLedgerState().trades
    const next = updateTradeById(current, id, updater)
    persist(next)
    return next
  }, [persist])

  const addTrade = useCallback((input: NewTradeInput) => {
    if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) throw new Error('Preço de entrada inválido')
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantidade inválida')
    if (input.fee !== undefined && (!Number.isFinite(input.fee) || input.fee < 0)) throw new Error('Taxa inválida')
    if (input.fee && input.fee >= input.quantity) throw new Error('Taxa não pode ser maior ou igual à quantidade')

    const remainingQuantity = roundQuantity(input.quantity - (input.fee || 0))
    const newTrade: Trade = { ...input, id: crypto.randomUUID(), fee: input.fee || 0, remainingQuantity, status: 'ATIVO', realizations: [], targetsHit: [], createdAt: new Date().toISOString() }

    const { trades: currentTrades, ledger: currentLedger } = getTradeLedgerState()
    let nextLedger = currentLedger
    if (input.fundingSource === 'CASH') {
      const amount = roundCurrency(input.entryPrice * input.quantity)
      if (amount > ledgerCashBalance()) throw new Error('Saldo insuficiente')
      nextLedger = [...currentLedger, { id: crypto.randomUUID(), type: 'TRADE_ENTRY', amount: -amount, tradeId: newTrade.id, date: new Date().toISOString() }]
    }
    persist([...currentTrades, newTrade], nextLedger)
    return newTrade
  }, [persist])

  const updateTrade = useCallback((id: string, updates: Partial<Trade>) => update(id, (trade) => ({ ...trade, ...updates })), [update])

  const deleteTrade = useCallback((id: string) => {
    const { trades: currentTrades, ledger: currentLedger } = getTradeLedgerState()
    persist(currentTrades.filter((trade) => trade.id !== id), currentLedger.filter((entry) => entry.tradeId !== id))
  }, [persist])

  const addRealization = useCallback((tradeId: string, input: Omit<Realization, 'id' | 'tradeId' | 'usdValue' | 'ledgerId' | 'profit'>, maxTargetLevel = 3) => {
    const { trades: currentTrades, ledger: currentLedger } = getTradeLedgerState()
    const trade = currentTrades.find((item) => item.id === tradeId)
    if (!trade) throw new Error('Trade não encontrado')
    if (!Number.isFinite(input.exitPrice) || input.exitPrice <= 0) throw new Error('Preço de saída inválido')
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('Quantidade inválida')
    if (!Number.isInteger(input.targetLevel) || input.targetLevel < 0 || input.targetLevel > maxTargetLevel) {
      throw new Error('Target inválido')
    }
    if (roundQuantity(input.quantity) > trade.remainingQuantity) throw new Error('Quantidade maior que a disponível')

    const quantity = roundQuantity(input.quantity)
    const value = roundCurrency(input.exitPrice * quantity)
    const ledgerId = crypto.randomUUID()
    const realization: Realization = { ...input, quantity, id: crypto.randomUUID(), tradeId, ledgerId, profit: getRealizationProfit({ ...input, quantity }, trade), usdValue: value, rebuyStatus: 'PENDING' }
    const nextTrades = updateTradeById(currentTrades, tradeId, (current) => {
      const realizations = [...current.realizations, realization]
      const remainingQuantity = getRemainingQuantity(current, realizations)
      const targetsHit = getTargetsHit(realizations)
      const stopLosses = input.targetLevel > 0 ? (current.stopLosses || []).map((stop) => stop.targetLevel === input.targetLevel ? { ...stop, status: 'ENCERRADO' as const } : stop) : current.stopLosses || []
      return { ...current, realizations, remainingQuantity, targetsHit, stopLosses, status: remainingQuantity <= 0 || input.targetLevel >= maxTargetLevel ? 'FINALIZADO' : 'ATIVO' }
    })
    const ledger = [...currentLedger, { id: ledgerId, type: 'REALIZATION' as const, amount: value, tradeId, date: new Date().toISOString() }]
    persist(nextTrades, ledger)
  }, [persist])

  const deleteRealization = useCallback((tradeId: string, realizationId: string, maxTargetLevel = 3) => {
    const { trades: currentTrades, ledger: currentLedger } = getTradeLedgerState()
    const current = currentTrades.find((trade) => trade.id === tradeId)
    const realization = current?.realizations.find((item) => item.id === realizationId)
    const ledger = currentLedger.filter((entry) => entry.id !== realization?.ledgerId)
    const nextTrades = updateTradeById(currentTrades, tradeId, (trade) => {
      const realizations = trade.realizations.filter((item) => item.id !== realizationId)
      const remainingQuantity = getRemainingQuantity(trade, realizations)
      const targetsHit = getTargetsHit(realizations)
      return { ...trade, realizations, remainingQuantity, targetsHit, status: remainingQuantity <= 0 || targetsHit.includes(maxTargetLevel) ? 'FINALIZADO' : 'ATIVO' }
    })
    persist(nextTrades, ledger)
  }, [persist])

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
