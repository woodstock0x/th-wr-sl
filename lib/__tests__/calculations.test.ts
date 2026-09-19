import { describe, expect, it } from 'vitest'
import {
  calculateROI,
  calculateProfit,
  calculateSellQuantity,
  calculatePortfolioSummary,
  getTargetStatus,
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
})

describe('calculateProfit', () => {
  it('is positive when exit is above entry', () => {
    expect(calculateProfit(100, 120, 2)).toBe(40)
  })

  it('is negative when exit is below entry', () => {
    expect(calculateProfit(100, 80, 2)).toBe(-40)
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
})
