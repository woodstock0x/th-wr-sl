import { describe, expect, it } from 'vitest'
import { getExchangeRate, convertCurrency, calculateCashBalance } from '../ledger'
import type { LedgerEntry } from '../types'

const prices = { 'usd-coin': { usd: 1, brl: 5.4 } }

describe('getExchangeRate', () => {
  it('derives the BRL-per-USD rate from any coin that has both prices', () => {
    expect(getExchangeRate(prices)).toBeCloseTo(5.4)
  })

  it('falls back to 1 (no conversion) when no price reference is available', () => {
    expect(getExchangeRate({})).toBe(1)
  })
})

describe('convertCurrency', () => {
  it('returns the amount unchanged when converting to the same currency', () => {
    expect(convertCurrency(100, 'BRL', 'BRL', prices)).toBe(100)
  })

  it('converts BRL to USD using the derived rate', () => {
    expect(convertCurrency(540, 'BRL', 'USD', prices)).toBeCloseTo(100)
  })

  it('converts USD to BRL using the derived rate', () => {
    expect(convertCurrency(100, 'USD', 'BRL', prices)).toBeCloseTo(540)
  })
})

describe('calculateCashBalance', () => {
  it('converts each entry from its own tagged currency before summing (the reported VENDA bug)', () => {
    // Vendeu 503.9 USDC a R$5,39 cada: o lançamento fica em reais
    // (~R$2716,02), não em dólares.
    const ledger: LedgerEntry[] = [
      { id: '1', type: 'TRADE_ENTRY', amount: 2716.02, currency: 'BRL', tradeId: 't1', date: '2026-01-01' },
    ]

    const balanceInUSD = calculateCashBalance(ledger, 'USD', prices)
    // R$2716,02 a 5,40 BRL/USD ≈ US$503 — não os ~US$2716 que apareciam
    // antes da conversão (o patrimônio "saltando" relatado pelo usuário).
    expect(balanceInUSD).toBeCloseTo(2716.02 / 5.4, 1)
  })

  it('leaves same-currency entries untouched when summed in that currency', () => {
    const ledger: LedgerEntry[] = [
      { id: '1', type: 'TRADE_ENTRY', amount: 100, currency: 'USD', tradeId: 't1', date: '2026-01-01' },
      { id: '2', type: 'WITHDRAW', amount: -30, currency: 'USD', tradeId: null, date: '2026-01-02' },
    ]

    expect(calculateCashBalance(ledger, 'USD', prices)).toBe(70)
  })

  it('treats untagged (legacy) entries as already being in the target currency', () => {
    const ledger: LedgerEntry[] = [
      { id: '1', type: 'TRADE_ENTRY', amount: 100, tradeId: 't1', date: '2026-01-01' },
    ]

    expect(calculateCashBalance(ledger, 'USD', prices)).toBe(100)
  })
})
