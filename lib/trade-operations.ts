import type { Realization, Trade } from './types'
import { isEffectivelyZero, roundQuantity } from './precision'

export function updateTradeById(
  trades: Trade[],
  id: string,
  updater: (trade: Trade) => Trade,
): Trade[] {
  return trades.map((trade) => trade.id === id ? updater(trade) : trade)
}

export function getTradeById(trades: Trade[], id: string): Trade | undefined {
  return trades.find((trade) => trade.id === id)
}

export function getActiveTrades(trades: Trade[]): Trade[] {
  return trades.filter((trade) => trade.status === 'ATIVO')
}

export function getFinishedTrades(trades: Trade[]): Trade[] {
  return trades.filter((trade) => trade.status === 'FINALIZADO')
}

export function getRealizationProfit(
  realization: Pick<Realization, 'exitPrice' | 'quantity'>,
  trade: Pick<Trade, 'entryPrice' | 'type'>,
): number {
  const profit = (realization.exitPrice - trade.entryPrice) * realization.quantity
  return trade.type === 'VENDA' ? -profit : profit
}

export function getRemainingQuantity(trade: Trade, realizations: Realization[]): number {
  const raw = trade.quantity - (trade.fee || 0) - realizations.reduce((sum, realization) => sum + realization.quantity, 0)
  const rounded = roundQuantity(raw)
  // Uma venda "tudo que resta" não deve deixar poeira de ponto flutuante negativa.
  return isEffectivelyZero(rounded) ? 0 : Math.max(0, rounded)
}

export function getTargetsHit(realizations: Realization[]): number[] {
  return [...new Set(realizations.filter((realization) => realization.targetLevel > 0).map((realization) => realization.targetLevel))]
}
