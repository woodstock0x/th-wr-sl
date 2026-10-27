import { convertCurrency, calculateCashBalance, getLedger } from '@/lib/ledger'
import type { LedgerEntry, PortfolioSummary, TargetConfig, Trade } from '@/lib/types'

export type PriceMap = Record<string, { usd: number; brl: number }>

/**
 * Moeda em que o preço do trade está denominado — a própria do trade,
 * se definida, senão a moeda de exibição global (compatibilidade com
 * trades antigos, que não tinham esse campo).
 */
export function getTradeCurrency(
  trade: Pick<Trade, 'currency'>,
  displayCurrency: 'USD' | 'BRL',
): 'USD' | 'BRL' {
  return trade.currency || displayCurrency
}

/** Busca o preço atual de um trade na moeda em que o próprio trade foi registrado. */
export function getTradeCurrentPrice(
  trade: Pick<Trade, 'coinId' | 'currency' | 'entryPrice'>,
  prices: PriceMap,
  displayCurrency: 'USD' | 'BRL',
): number {
  const currencyKey = getTradeCurrency(trade, displayCurrency).toLowerCase() as 'usd' | 'brl'
  return prices[trade.coinId]?.[currencyKey] || trade.entryPrice
}

/**
 * `inverted` é para trades do tipo VENDA (venda a descoberto): você já
 * vendeu o ativo, então o lucro vai no sentido contrário — preço caindo
 * valoriza a posição, preço subindo desvaloriza.
 */
export function calculateROI(entryPrice: number, currentPrice: number, inverted = false): number {
  if (entryPrice === 0) return 0
  const roi = ((currentPrice - entryPrice) / entryPrice) * 100
  return inverted ? -roi : roi
}

export function calculateProfit(entryPrice: number, exitPrice: number, quantity: number, inverted = false): number {
  const profit = (exitPrice - entryPrice) * quantity
  return inverted ? -profit : profit
}

export function calculateRealizationProfit(
  realization: { exitPrice: number; quantity: number },
  trade: Pick<Trade, 'entryPrice' | 'type'>,
): number {
  return calculateProfit(trade.entryPrice, realization.exitPrice, realization.quantity, trade.type === 'VENDA')
}

export function calculateTotalRealized(trade: Trade): number {
  return trade.realizations.reduce(
    (sum, realization) => sum + calculateRealizationProfit(realization, trade),
    0,
  )
}

/** Lucro realizado de um trade convertido para a moeda de exibição. */
export function getTradeRealizedProfit(trade: Trade, prices: PriceMap, currency: 'USD' | 'BRL'): number {
  return convertCurrency(calculateTotalRealized(trade), getTradeCurrency(trade, currency), currency, prices)
}

export function getTargetStatus(
  entryPrice: number,
  currentPrice: number,
  targets: TargetConfig[],
  targetsHit: number[],
  inverted = false,
): { nextTarget: TargetConfig | null; currentROI: number; targetsReached: number[] } {
  const currentROI = calculateROI(entryPrice, currentPrice, inverted)
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
  allTrades: Trade[],
  prices: PriceMap,
  currency: 'USD' | 'BRL',
  ledger: LedgerEntry[] = getLedger(),
): PortfolioSummary {
  // Trades VENDA (venda a descoberto) ficam de fora do somatório de
  // investido/realizado: misturar exposição comprada e vendida num único
  // total investido/ROI exigiria uma contabilidade própria. Eles continuam
  // aparecendo normalmente em "Trades Ativos" e na própria página do
  // trade, só não entram nesses dois cards específicos do dashboard.
  const trades = allTrades.filter((trade) => trade.type !== 'VENDA')
  const shortTrades = allTrades.filter((trade) => trade.type === 'VENDA' && trade.status === 'ATIVO')
  const currencyKey = currency.toLowerCase() as 'usd' | 'brl'
  const activeTrades = trades.filter((trade) => trade.status === 'ATIVO')
  // `entryPrice`/realizações de um trade estão na moeda do PRÓPRIO trade
  // (`trade.currency`), não necessariamente na moeda de exibição — precisa
  // converter antes de somar com trades de moedas diferentes.
  const totalInvested = trades.reduce(
    (sum, trade) => sum + (trade.fundingSource === 'CASH'
      ? 0
      : convertCurrency(trade.entryPrice * trade.quantity, getTradeCurrency(trade, currency), currency, prices)),
    0,
  )
  const positionValue = activeTrades.reduce((sum, trade) => {
    const currentPrice = prices[trade.coinId]?.[currencyKey] || trade.entryPrice
    return sum + calculatePositionValue(trade, currentPrice)
  }, 0)
  const realizedProfit = trades.reduce(
    (sum, trade) => sum + convertCurrency(calculateTotalRealized(trade), getTradeCurrency(trade, currency), currency, prices),
    0,
  )
  const cashBalance = calculateCashBalance(ledger, currency, prices)
  // Uma VENDA em aberto já injetou caixa no ledger no valor total vendido
  // (ex.: R$2.716 ao vender USD/BRL) — mas isso não é patrimônio novo, é
  // dinheiro que está "preso" na posição vendida até ela ser recomprada.
  // O passivo (quanto custaria recomprar agora, na moeda de exibição)
  // precisa ser descontado do patrimônio, senão o caixa gerado na entrada
  // conta como ganho inteiro em vez de só a variação de preço desde então.
  const shortLiability = shortTrades.reduce((sum, trade) => {
    const tradeCurrency = getTradeCurrency(trade, currency)
    const currentPriceInTradeCurrency = getTradeCurrentPrice(trade, prices, currency)
    const liability = currentPriceInTradeCurrency * trade.remainingQuantity
    return sum + convertCurrency(liability, tradeCurrency, currency, prices)
  }, 0)
  const totalEquity = positionValue + cashBalance - shortLiability
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
  // VENDA fica fora da consolidação por moeda: somar quantidade vendida
  // (a descoberto) com quantidade comprada do mesmo ativo não representa
  // uma posição líquida coerente com a fórmula de custo médio usada aqui.
  const activeTrades = trades.filter((trade) => trade.status === 'ATIVO' && trade.type !== 'VENDA')
  const uniqueCoins = [...new Set(activeTrades.map((trade) => trade.coinId))]
  const positions = uniqueCoins.map((coinId) => {
    const coinTrades = activeTrades.filter((trade) => trade.coinId === coinId)
    const quantity = coinTrades.reduce((sum, trade) => sum + trade.remainingQuantity, 0)
    const totalCost = coinTrades.reduce((sum, trade) => {
      const sold = trade.realizations.reduce((value, realization) => value + realization.exitPrice * realization.quantity, 0)
      const costInTradeCurrency = trade.entryPrice * trade.quantity - sold
      return sum + convertCurrency(costInTradeCurrency, getTradeCurrency(trade, currency), currency, prices)
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
