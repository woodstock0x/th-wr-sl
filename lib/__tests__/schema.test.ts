import { describe, expect, it } from 'vitest'
import { validateExportedData } from '../schema'

const validPayload = {
  schemaVersion: 1,
  trades: [
    {
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
    },
  ],
  settings: {
    targets: [
      { level: 1, percentage: 7, sellPercentage: 30 },
      { level: 2, percentage: 14, sellPercentage: 30 },
      { level: 3, percentage: 21, sellPercentage: 40 },
    ],
    currency: 'USD',
    theme: 'dark',
  },
  ledger: [],
  exportedAt: '2025-01-01T00:00:00.000Z',
}

describe('validateExportedData', () => {
  it('accepts a well-formed export', () => {
    const result = validateExportedData(validPayload)
    expect(result.success).toBe(true)
    expect(result.data?.trades).toHaveLength(1)
  })

  it('rejects a payload with trades missing required fields instead of silently wiping data', () => {
    const broken = { ...validPayload, trades: [{ id: 't1' }] }
    const result = validateExportedData(broken)
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects garbage input (e.g. an array or a string) instead of throwing', () => {
    expect(validateExportedData('not an object').success).toBe(false)
    expect(validateExportedData([1, 2, 3]).success).toBe(false)
    expect(validateExportedData(null).success).toBe(false)
  })

  it('rejects a ledger entry with a non-numeric amount', () => {
    const broken = {
      ...validPayload,
      ledger: [{ id: 'l1', type: 'WITHDRAW', amount: 'not-a-number', tradeId: null, date: '2025-01-01T00:00:00.000Z' }],
    }
    const result = validateExportedData(broken)
    expect(result.success).toBe(false)
  })
})
