import type { LedgerEntry } from './types'
import { notifyDataChanged } from './data-change-events'

const LEDGER_KEY = 'ledger'

function readLedger(): LedgerEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const value = localStorage.getItem(LEDGER_KEY)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed as LedgerEntry[] : []
  } catch {
    return []
  }
}

export function getLedger(): LedgerEntry[] {
  return readLedger()
}

export function saveLedger(ledger: LedgerEntry[]): void {
  if (typeof window !== 'undefined') localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger))
  notifyDataChanged()
}

export function saveLedgerEntry(entry: LedgerEntry): void {
  saveLedger([...readLedger(), entry])
}

export function deleteLedgerEntry(id: string): void {
  saveLedger(readLedger().filter((entry) => entry.id !== id))
}

export function ledgerCashBalance(): number {
  return readLedger().reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
}

type PriceMap = Record<string, { usd: number; brl: number }>

/**
 * Taxa de câmbio BRL por 1 USD, derivada dos preços já carregados: o
 * CoinGecko aplica a mesma taxa de conversão para qualquer moeda, então
 * qualquer ativo com os dois preços disponíveis serve de referência. Sem
 * nenhuma referência disponível, assume 1 (sem conversão) — melhor do que
 * travar a tela, mas pode ficar incorreto nesse caso extremo.
 */
export function getExchangeRate(prices: PriceMap): number {
  const reference = Object.values(prices).find((price) => price.usd > 0 && price.brl > 0)
  return reference ? reference.brl / reference.usd : 1
}

export function convertCurrency(
  amount: number,
  from: 'USD' | 'BRL',
  to: 'USD' | 'BRL',
  prices: PriceMap,
): number {
  if (from === to) return amount
  const rate = getExchangeRate(prices)
  return from === 'USD' ? amount * rate : amount / rate
}

/**
 * Saldo de caixa convertido para uma única moeda de exibição. Cada
 * lançamento guarda a moeda em que foi registrado (`entry.currency`); um
 * trade VENDA de USD/BRL, por exemplo, gera um lançamento em reais que não
 * pode ser somado cru a lançamentos em dólar. Lançamentos antigos, sem essa
 * tag, são tratados como já estando na moeda de destino (não havia
 * ambiguidade quando foram criados).
 */
export function calculateCashBalance(ledger: LedgerEntry[], currency: 'USD' | 'BRL', prices: PriceMap): number {
  return ledger.reduce((sum, entry) => {
    const entryCurrency = entry.currency || currency
    return sum + convertCurrency(Number(entry.amount || 0), entryCurrency, currency, prices)
  }, 0)
}

export function ledgerCashBalanceInCurrency(currency: 'USD' | 'BRL', prices: PriceMap): number {
  return calculateCashBalance(readLedger(), currency, prices)
}
