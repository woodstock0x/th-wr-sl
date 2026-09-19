import { describe, expect, it } from 'vitest'
import { computeRebuyAlerts } from '../rebuy'
import type { Trade } from '../types'

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'trade-1',
    coinId: 'bitcoin',
    coinSymbol: 'BTC',
    coinName: 'Bitcoin',
    type: 'COMPRA',
    fundingSource: 'EXTERNAL',
    entryPrice: 100,
    quantity: 1,
    fee: 0,
    remainingQuantity: 0.7,
    entryDate: '2025-01-01T00:00:00.000Z',
    status: 'ATIVO',
    realizations: [],
    targetsHit: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('computeRebuyAlerts', () => {
  it('generates an active alert once price drops past the trigger', () => {
    const trade = makeTrade({
      realizations: [
        {
          id: 'r1',
          tradeId: 'trade-1',
          targetLevel: 1,
          exitPrice: 200,
          quantity: 0.3,
          date: '2025-01-02T00:00:00.000Z',
          profit: 30,
          usdValue: 60,
          ledgerId: 'l1',
          rebuyStatus: 'PENDING',
        },
      ],
    })

    const { alerts, dismissedAlerts } = computeRebuyAlerts(
      [trade],
      { bitcoin: { usd: 197, brl: 0 } },
      'USD',
    )

    expect(dismissedAlerts).toHaveLength(0)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].realizationId).toBe('r1')
  })

  it('does not alert before the price has dropped enough', () => {
    const trade = makeTrade({
      realizations: [
        {
          id: 'r1',
          tradeId: 'trade-1',
          targetLevel: 1,
          exitPrice: 200,
          quantity: 0.3,
          date: '2025-01-02T00:00:00.000Z',
          profit: 30,
          usdValue: 60,
          ledgerId: 'l1',
          rebuyStatus: 'PENDING',
        },
      ],
    })

    const { alerts } = computeRebuyAlerts([trade], { bitcoin: { usd: 199, brl: 0 } }, 'USD')

    expect(alerts).toHaveLength(0)
  })

  it('keeps dismissed opportunities visible in dismissedAlerts so they can be restored', () => {
    // Regression test: the original component had an early `continue` for
    // rebuyStatus === 'DISMISSED' that ran BEFORE the dismissed branch was
    // ever reached, so dismissedAlerts was always empty and the "restore"
    // button never rendered anything.
    const trade = makeTrade({
      realizations: [
        {
          id: 'r1',
          tradeId: 'trade-1',
          targetLevel: 1,
          exitPrice: 200,
          quantity: 0.3,
          date: '2025-01-02T00:00:00.000Z',
          profit: 30,
          usdValue: 60,
          ledgerId: 'l1',
          rebuyStatus: 'DISMISSED',
        },
      ],
    })

    const { alerts, dismissedAlerts } = computeRebuyAlerts(
      [trade],
      { bitcoin: { usd: 150, brl: 0 } },
      'USD',
    )

    expect(alerts).toHaveLength(0)
    expect(dismissedAlerts).toHaveLength(1)
    expect(dismissedAlerts[0].realizationId).toBe('r1')
  })

  it('ignores manual realizations (targetLevel 0)', () => {
    const trade = makeTrade({
      realizations: [
        {
          id: 'r1',
          tradeId: 'trade-1',
          targetLevel: 0,
          exitPrice: 200,
          quantity: 0.3,
          date: '2025-01-02T00:00:00.000Z',
          profit: 30,
          usdValue: 60,
          ledgerId: 'l1',
          rebuyStatus: 'PENDING',
        },
      ],
    })

    const { alerts, dismissedAlerts } = computeRebuyAlerts(
      [trade],
      { bitcoin: { usd: 100, brl: 0 } },
      'USD',
    )

    expect(alerts).toHaveLength(0)
    expect(dismissedAlerts).toHaveLength(0)
  })

  it('suppresses the opportunity once a RECOMPRA trade already used it', () => {
    const source = makeTrade({
      realizations: [
        {
          id: 'r1',
          tradeId: 'trade-1',
          targetLevel: 1,
          exitPrice: 200,
          quantity: 0.3,
          date: '2025-01-02T00:00:00.000Z',
          profit: 30,
          usdValue: 60,
          ledgerId: 'l1',
          rebuyStatus: 'PENDING',
        },
      ],
    })

    const rebuyTrade = makeTrade({
      id: 'trade-2',
      type: 'RECOMPRA',
      rebuySource: { tradeId: 'trade-1', realizationId: 'r1', targetLevel: 1 },
    })

    const { alerts, dismissedAlerts } = computeRebuyAlerts(
      [source, rebuyTrade],
      { bitcoin: { usd: 150, brl: 0 } },
      'USD',
    )

    expect(alerts).toHaveLength(0)
    expect(dismissedAlerts).toHaveLength(0)
  })
})
