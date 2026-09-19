import { getLedger } from '@/lib/ledger'
import type { PortfolioSummary, TargetConfig, Trade } from '@/lib/types'

export type PriceMap = Record<string, { usd: number; brl: number }>

export function calculateROI(entryPrice: number, currentPrice: number): number {
  if (entryPrice === 0) return 0
  return ((currentPrice - entryPrice) / entryPrice) * 100
}

export function calculateProfit(entryPrice: number, exitPrice: number, quantity: number): number {
  return (exitPrice - entryPrice) * quantity
}

export function calculateRealizationProfit(
  realization: { exitPrice: number; quantity: number },
  trade: Pick<Trade, 'entryPrice'>,
): number {
  return calculateProfit(trade.entryPrice, realization.exitPrice, realization.quantity)
}

export function calculateTotalRealized(trade: Trade): number {
  return trade.realizations.reduce(
    (sum, realization) => sum + calculateRealizationProfit(realization, trade),
    0,
  )
}

export function getTargetStatus(
  entryPrice: number,
  currentPrice: number,
  targets: TargetConfig[],
  targetsHit: number[],
): { nextTarget: TargetConfig | null; currentROI: number; targetsReached: number[] } {
  const currentROI = calculateROI(entryPrice, currentPrice)
  const targetsReached = targets.filter(
    (target) => currentROI >= target.percentage && !targetsHit.includes(target.level),
  )
  const nextTarget = targets.find(
    (target) => currentROI < target.percentage && !targetsHit.includes(target.level),
  ) || null

  return { nextTarget, currentROI, targetsReached: targetsReached.map((target) => target.level) }
}

export function calculateSellQuantity(
  remainingQuantity: number,
  sellPercentage: number,
  isLastTarget: boolean,
): number {
  if (isLastTarget) return remainingQuantity
  return (remainingQuantity * sellPercentage) / 100
}

export function calculatePositionValue(trade: Trade, currentPrice: number): number {
  return currentPrice * trade.remainingQuantity
}

export function calculatePortfolioSummary(
  trades: Trade[],
  prices: PriceMap,
  currency: 'USD' | 'BRL',
): PortfolioSummary {
  const currencyKey = currency.toLowerCase() as 'usd' | 'brl'
  const activeTrades = trades.filter((trade) => trade.status === 'ATIVO')
  const totalInvested = trades.reduce(
    (sum, trade) => sum + (trade.fundingSource === 'CASH' ? 0 : trade.entryPrice * trade.quantity),
    0,
  )
  const positionValue = activeTrades.reduce((sum, trade) => {
    const currentPrice = prices[trade.coinId]?.[currencyKey] || trade.entryPrice
    return sum + calculatePositionValue(trade, currentPrice)
  }, 0)
  const realizedProfit = trades.reduce((sum, trade) => sum + calculateTotalRealized(trade), 0)
  const cashBalance = getLedger().reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const totalEquity = positionValue + cashBalance
  const totalProfit = totalEquity - totalInvested
  const totalROI = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

  return {
    totalInvested,
    positionValue,
    cashBalance,
    totalEquity,
    realizedProfit,
    unrealizedProfit: totalProfit - realizedProfit,
    totalProfit,
    totalROI,
    activeTrades: activeTrades.length,
    currency,
  }
}

export function calculateAdjustedEntryPrice(trade: Trade): number {
  const entryPrice = Number(trade.entryPrice) || 0
  const initialQuantity = Number(trade.quantity) || 0
  const remainingQuantity = Number(trade.remainingQuantity) || 0
  if (entryPrice <= 0 || initialQuantity <= 0 || remainingQuantity <= 0) return 0

  const totalInvested = entryPrice * initialQuantity
  const totalSold = trade.realizations.reduce(
    (sum, realization) => sum + realization.exitPrice * realization.quantity,
    0,
  )
  return (totalInvested - totalSold) / remainingQuantity
}

export function formatCurrency(value: number, currency: 'USD' | 'BRL'): string {
  return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatQuantity(value: number): string {
  return value >= 1 ? value.toLocaleString('en-US', { maximumFractionDigits: 4 }) : value.toFixed(8)
}

export function calculateConsolidatedPositions(trades: Trade[], prices: PriceMap, currency: 'USD' | 'BRL') {
  const currencyKey = currency.toLowerCase() as 'usd' | 'brl'
  const activeTrades = trades.filter((trade) => trade.status === 'ATIVO')
  const uniqueCoins = [...new Set(activeTrades.map((trade) => trade.coinId))]
  const positions = uniqueCoins.map((coinId) => {
    const coinTrades = activeTrades.filter((trade) => trade.coinId === coinId)
    const quantity = coinTrades.reduce((sum, trade) => sum + trade.remainingQuantity, 0)
    const totalCost = coinTrades.reduce((sum, trade) => {
      const sold = trade.realizations.reduce((value, realization) => value + realization.exitPrice * realization.quantity, 0)
      return sum + trade.entryPrice * trade.quantity - sold
    }, 0)
    const avgEntryPrice = quantity > 0 ? totalCost / quantity : 0
    const currentPrice = prices[coinId]?.[currencyKey] || avgEntryPrice
    const currentValue = currentPrice * quantity
    const reference = trades.find((trade) => trade.coinId === coinId)
    return {
      coinId,
      coinSymbol: reference?.coinSymbol || coinId.toUpperCase(),
      coinName: reference?.coinName,
      coinImage: reference?.coinImage,
      quantity,
      avgEntryPrice,
      currentPrice,
      currentValue,
      roi: calculateROI(avgEntryPrice, currentPrice),
      count: coinTrades.length,
    }
  })
  const totalValue = positions.reduce((sum, position) => sum + position.currentValue, 0)
  return positions.map((position) => ({
    ...position,
    portfolioPercentage: totalValue > 0 ? (position.currentValue / totalValue) * 100 : 0,
  })).sort((a, b) => b.currentValue - a.currentValue)
}
