import { describe, expect, it } from 'vitest'
import { getRemainingQuantity, getTargetsHit } from '../trade-operations'
import type { Realization, Trade } from '../types'

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
    fee: 0.001,
    remainingQuantity: 1,
    entryDate: '2025-01-01T00:00:00.000Z',
    status: 'ATIVO',
    realizations: [],
    targetsHit: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeRealization(overrides: Partial<Realization> = {}): Realization {
  return {
    id: 'r1',
    tradeId: 't1',
    targetLevel: 1,
    exitPrice: 120,
    quantity: 0.3,
    date: '2025-01-02T00:00:00.000Z',
    profit: 6,
    usdValue: 36,
    ledgerId: 'l1',
    rebuyStatus: 'PENDING',
    ...overrides,
  }
}

describe('getRemainingQuantity', () => {
  it('subtracts the entry fee and all realizations from the initial quantity', () => {
    const trade = makeTrade({ quantity: 1, fee: 0.001 })
    const remaining = getRemainingQuantity(trade, [makeRealization({ quantity: 0.3 })])
    expect(remaining).toBeCloseTo(0.699, 8)
  })

  it('never returns a negative amount from floating point drift when selling everything', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754; this mirrors selling "all remaining" in
    // three partial realizations that should sum back exactly to the total.
    const trade = makeTrade({ quantity: 0.6, fee: 0 })
    const realizations = [
      makeRealization({ id: 'r1', quantity: 0.1 }),
      makeRealization({ id: 'r2', quantity: 0.2 }),
      makeRealization({ id: 'r3', quantity: 0.3 }),
    ]

    const remaining = getRemainingQuantity(trade, realizations)
    expect(remaining).toBe(0)
  })

  it('rounds to 8 decimals instead of leaking float noise', () => {
    const trade = makeTrade({ quantity: 0.888893000805, fee: 0.000889782784 })
    const remaining = getRemainingQuantity(trade, [])
    expect(remaining.toString().replace('-', '').split('.')[1]?.length ?? 0).toBeLessThanOrEqual(8)
  })
})

describe('getTargetsHit', () => {
  it('returns unique target levels above zero, ignoring manual realizations', () => {
    const hit = getTargetsHit([
      makeRealization({ id: 'r1', targetLevel: 1 }),
      makeRealization({ id: 'r2', targetLevel: 1 }),
      makeRealization({ id: 'r3', targetLevel: 0 }),
      makeRealization({ id: 'r4', targetLevel: 2 }),
    ])
    expect(hit.sort()).toEqual([1, 2])
  })
})
