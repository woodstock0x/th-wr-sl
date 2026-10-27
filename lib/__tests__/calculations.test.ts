import { describe, expect, it } from 'vitest'
import {
  calculateROI,
  calculateProfit,
  calculateRealizationProfit,
  calculateSellQuantity,
  calculatePortfolioSummary,
  calculateConsolidatedPositions,
  getTargetStatus,
  getTradeCurrency,
  getTradeCurrentPrice,
  getTradeRealizedProfit,
} from '../calculations'
import type { Trade, TargetConfig } from '../types'

const targets: TargetConfig[] = [
  { level: 1, percentage: 7, sellPercentage: 30 },
  { level: 2, percentage: 14, sellPercentage: 30 },
  { level: 3, percentage: 21, sellPercentage: 40 },
]

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    coinId: 'bitcoin',
    coinSymbol: 'BTC',
    coinName: 'Bitcoin',
    type: 'COMPRA',
    fundingSource: 'EXTERNAL',
    entryPrice: 100,
    quantity: 1,
    fee: 0,
    remainingQuantity: 1,
    entryDate: '2025-01-01T00:00:00.000Z',
    status: 'ATIVO',
    realizations: [],
    targetsHit: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('calculateROI', () => {
  it('returns 0 when entryPrice is 0 (avoids division by zero)', () => {
    expect(calculateROI(0, 100)).toBe(0)
  })

  it('computes percentage gain', () => {
    expect(calculateROI(100, 107)).toBeCloseTo(7)
  })

  it('inverts the sign for a short (VENDA) position: price drop is a gain', () => {
    expect(calculateROI(100, 93, true)).toBeCloseTo(7)
    expect(calculateROI(100, 107, true)).toBeCloseTo(-7)
  })
})

describe('calculateProfit', () => {
  it('is positive when exit is above entry', () => {
    expect(calculateProfit(100, 120, 2)).toBe(40)
  })

  it('is negative when exit is below entry', () => {
    expect(calculateProfit(100, 80, 2)).toBe(-40)
  })

  it('inverts for a short position: buying back cheaper than the entry sale price is a profit', () => {
    expect(calculateProfit(100, 80, 2, true)).toBe(40)
    expect(calculateProfit(100, 120, 2, true)).toBe(-40)
  })
})

describe('calculateRealizationProfit (VENDA)', () => {
  it('profits a short trade when the buy-back (realization) price is below the entry sale price', () => {
    const shortTrade = makeTrade({ type: 'VENDA', entryPrice: 100 })
    expect(calculateRealizationProfit({ exitPrice: 80, quantity: 2 }, shortTrade)).toBe(40)
  })

  it('loses on a short trade when the buy-back price is above the entry sale price', () => {
    const shortTrade = makeTrade({ type: 'VENDA', entryPrice: 100 })
    expect(calculateRealizationProfit({ exitPrice: 120, quantity: 2 }, shortTrade)).toBe(-40)
  })

  it('keeps normal (long) direction for COMPRA/RECOMPRA trades', () => {
    const longTrade = makeTrade({ type: 'COMPRA', entryPrice: 100 })
    expect(calculateRealizationProfit({ exitPrice: 120, quantity: 2 }, longTrade)).toBe(40)
  })
})

describe('calculateSellQuantity', () => {
  it('sells the configured percentage for non-final targets', () => {
    expect(calculateSellQuantity(10, 30, false)).toBe(3)
  })

  it('sells everything remaining on the final target regardless of percentage', () => {
    expect(calculateSellQuantity(10, 40, true)).toBe(10)
  })
})

describe('getTargetStatus', () => {
  it('reports every target whose threshold is met and not yet hit', () => {
    const status = getTargetStatus(100, 116, targets, [])
    expect(status.targetsReached).toEqual([1, 2])
    expect(status.nextTarget?.level).toBe(3)
  })

  it('excludes targets already marked as hit', () => {
    const status = getTargetStatus(100, 116, targets, [1])
    expect(status.targetsReached).toEqual([2])
  })

  it('reaches targets on a price drop when inverted (short/VENDA)', () => {
    const status = getTargetStatus(100, 84, targets, [], true)
    expect(status.targetsReached).toEqual([1, 2])
    expect(status.nextTarget?.level).toBe(3)
  })
})

describe('calculatePortfolioSummary', () => {
  it('excludes CASH-funded trades from totalInvested (capital already came from the ledger)', () => {
    const external = makeTrade({ id: 'ext', fundingSource: 'EXTERNAL', entryPrice: 100, quantity: 1 })
    const cashFunded = makeTrade({ id: 'cash', fundingSource: 'CASH', entryPrice: 50, quantity: 1 })

    const summary = calculatePortfolioSummary([external, cashFunded], {}, 'USD')

    expect(summary.totalInvested).toBe(100)
  })

  it('only counts remaining quantity of active trades toward position value', () => {
    const finished = makeTrade({ id: 'done', status: 'FINALIZADO', remainingQuantity: 0 })
    const active = makeTrade({ id: 'open', status: 'ATIVO', remainingQuantity: 2 })

    const summary = calculatePortfolioSummary(
      [finished, active],
      { bitcoin: { usd: 150, brl: 0 } },
      'USD',
    )

    expect(summary.positionValue).toBe(300)
    expect(summary.activeTrades).toBe(1)
  })

  it('excludes VENDA (short) trades from the aggregate totals', () => {
    const long = makeTrade({ id: 'long', type: 'COMPRA', fundingSource: 'EXTERNAL', entryPrice: 100, quantity: 1, remainingQuantity: 1 })
    const short = makeTrade({ id: 'short', type: 'VENDA', entryPrice: 200, quantity: 5, remainingQuantity: 5 })

    const summary = calculatePortfolioSummary(
      [long, short],
      { bitcoin: { usd: 110, brl: 0 } },
      'USD',
    )

    expect(summary.totalInvested).toBe(100)
    expect(summary.positionValue).toBe(110)
    expect(summary.activeTrades).toBe(1)
  })
})

describe('calculateConsolidatedPositions', () => {
  it('excludes VENDA (short) trades from the per-coin consolidation', () => {
    const long = makeTrade({ id: 'long', type: 'COMPRA', entryPrice: 100, quantity: 1, remainingQuantity: 1 })
    const short = makeTrade({ id: 'short', type: 'VENDA', entryPrice: 200, quantity: 5, remainingQuantity: 5 })

    const positions = calculateConsolidatedPositions(
      [long, short],
      { bitcoin: { usd: 110, brl: 0 } },
      'USD',
    )

    expect(positions).toHaveLength(1)
    expect(positions[0].quantity).toBe(1)
  })
})

describe('calculatePortfolioSummary — per-trade currency conversion', () => {
  const prices = { 'usd-coin': { usd: 1, brl: 5 } }

  it('converts totalInvested when a trade is denominated in a different currency than the display one', () => {
    const brlTrade = makeTrade({ id: 'brl', coinId: 'usd-coin', currency: 'BRL', entryPrice: 5, quantity: 100, remainingQuantity: 100 })

    const summary = calculatePortfolioSummary([brlTrade], prices, 'USD')

    // Investiu R$500 (5 * 100) a uma taxa de 5 BRL/USD = US$100, não R$500
    // somados como se já fossem dólares.
    expect(summary.totalInvested).toBeCloseTo(100)
  })

  it('converts realizedProfit when a trade is denominated in a different currency than the display one', () => {
    const brlTrade = makeTrade({
      id: 'brl',
      coinId: 'usd-coin',
      currency: 'BRL',
      entryPrice: 5,
      quantity: 100,
      remainingQuantity: 0,
      status: 'FINALIZADO',
      realizations: [
        { id: 'r1', tradeId: 'brl', targetLevel: 1, exitPrice: 10, quantity: 100, date: '2026-01-01', profit: 500, usdValue: 1000, ledgerId: 'l1' },
      ],
    })

    const summary = calculatePortfolioSummary([brlTrade], prices, 'USD')

    // Lucro de R$500 (saiu de 5 para 10 reais) a 5 BRL/USD = US$100.
    expect(summary.realizedProfit).toBeCloseTo(100)
  })
})

describe('calculatePortfolioSummary — VENDA (short) liability', () => {
  it('does not change totalEquity at entry: cash generated is offset by the open short liability', () => {
    // Vendeu 500 "dólares" a 5.39 reais cada — o ledger recebe um
    // TRADE_ENTRY de R$2695 de caixa, mas também existe um passivo em
    // aberto (recomprar agora custaria o mesmo, já que o preço não
    // mudou), então o patrimônio não deve pular.
    const shortTrade = makeTrade({
      id: 'short', type: 'VENDA', coinId: 'usd-coin', currency: 'BRL', entryPrice: 5.39, quantity: 500, remainingQuantity: 500,
    })
    const prices = { 'usd-coin': { usd: 1, brl: 5.39 } }
    const ledger = [
      { id: 'l1', type: 'TRADE_ENTRY' as const, amount: 2695, currency: 'BRL' as const, tradeId: 'short', date: '2026-01-01' },
    ]

    const summary = calculatePortfolioSummary([shortTrade], prices, 'USD', ledger)

    expect(summary.totalEquity).toBeCloseTo(0, 5)
  })

  it('reflects only the price move as profit once the rate changes (valorização/desvalorização)', () => {
    const shortTrade = makeTrade({
      id: 'short', type: 'VENDA', coinId: 'usd-coin', currency: 'BRL', entryPrice: 5.39, quantity: 500, remainingQuantity: 500,
    })
    // Preço caiu para 5.00 — recomprar agora é mais barato, lucro para quem vendeu.
    const prices = { 'usd-coin': { usd: 1, brl: 5.0 } }
    const ledger = [
      { id: 'l1', type: 'TRADE_ENTRY' as const, amount: 2695, currency: 'BRL' as const, tradeId: 'short', date: '2026-01-01' },
    ]

    const summary = calculatePortfolioSummary([shortTrade], prices, 'BRL', ledger)

    // Caixa gerado: 5.39*500 = 2695. Passivo agora: 5.00*500 = 2500.
    // totalEquity = 2695 - 2500 = 195 (o lucro, não o valor total vendido).
    expect(summary.totalEquity).toBeCloseTo(195, 5)
  })
})

describe('getTradeRealizedProfit', () => {
  it('converts a trade realized profit from its own currency to the display currency', () => {
    const brlTrade = makeTrade({
      coinId: 'usd-coin',
      currency: 'BRL',
      entryPrice: 5,
      realizations: [
        { id: 'r1', tradeId: 't1', targetLevel: 1, exitPrice: 10, quantity: 1, date: '2026-01-01', profit: 5, usdValue: 10, ledgerId: 'l1' },
      ],
    })
    const prices = { 'usd-coin': { usd: 1, brl: 5 } }

    expect(getTradeRealizedProfit(brlTrade, prices, 'USD')).toBeCloseTo(1)
  })
})

describe('getTradeCurrency / getTradeCurrentPrice', () => {
  it('uses the trade\'s own currency when set, ignoring the global display currency', () => {
    const brlTrade = makeTrade({ currency: 'BRL', entryPrice: 5.39 })
    expect(getTradeCurrency(brlTrade, 'USD')).toBe('BRL')
  })

  it('falls back to the global display currency for trades without their own (older trades)', () => {
    const legacyTrade = makeTrade({ currency: undefined })
    expect(getTradeCurrency(legacyTrade, 'BRL')).toBe('BRL')
  })

  it('looks up the price in the trade\'s own currency, not the global display one', () => {
    const brlTrade = makeTrade({ coinId: 'usd-coin', currency: 'BRL', entryPrice: 5.39 })
    const prices = { 'usd-coin': { usd: 1.0, brl: 5.42 } }

    // Mesmo com a tela global ajustada para USD, o trade em BRL deve
    // comparar contra o preço em BRL (5.42), não o preço em USD (1.00) —
    // é exatamente o bug relatado: ROI absurdo ao alternar a moeda global.
    expect(getTradeCurrentPrice(brlTrade, prices, 'USD')).toBe(5.42)
  })

  it('falls back to entryPrice when no price is available for the trade\'s coin', () => {
    const trade = makeTrade({ coinId: 'unknown-coin', entryPrice: 42 })
    expect(getTradeCurrentPrice(trade, {}, 'USD')).toBe(42)
  })
})
