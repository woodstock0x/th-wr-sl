export interface RebuySource {
  tradeId: string
  realizationId: string
  targetLevel: number
}

export type TargetStopLossStatus =
  | 'ATIVO'
  | 'EXECUTADO'
  | 'ENCERRADO'

export interface TargetStopLoss {
  targetLevel: number
  price: number
  quantity: number
  status: TargetStopLossStatus
}

export interface Trade {
  id: string

  coinId: string
  coinSymbol: string
  coinName: string
  coinImage?: string

  stopLosses?: TargetStopLoss[]

  type: 'COMPRA' | 'RECOMPRA'

  fundingSource?: 'CASH' | 'EXTERNAL'

  entryPrice: number
  quantity: number
  fee: number
  remainingQuantity: number

  entryDate: string

  notes?: string

  status: 'ATIVO' | 'FINALIZADO'

  realizations: Realization[]

  targetsHit: number[]

  targetsIgnored?: number[]

  rebuySource?: RebuySource

  ledgerEntryIds?: string[]

  createdAt: string
}

export type LedgerEntry = {
  id: string
  type: 'REALIZATION' | 'TRADE_ENTRY' | 'WITHDRAW'
  amount: number
  tradeId: string | null
  date: string
  metadata?: {
    method?: string
    note?: string
  }
}

export type RebuyStatus =
  | 'PENDING'
  | 'DISMISSED'
  | 'EXECUTED'

export type Realization = {
  id: string

  tradeId: string

  targetLevel: number

  exitPrice: number

  quantity: number

  date: string

  profit: number

  usdValue: number

  ledgerId: string

  rebuyStatus?: RebuyStatus
}

export interface TargetConfig {
  level: number
  percentage: number
  sellPercentage: number
}

export interface Settings {
  targets: TargetConfig[]

  currency: 'BRL' | 'USD'

  theme: 'light' | 'dark' | 'system'
}

export interface CoinGeckoPrice {
  [coinId: string]: {
    usd: number
    brl: number
    usd_24h_change?: number
    brl_24h_change?: number
  }
}

export interface CoinSearchResult {
  id: string
  symbol: string
  name: string
  thumb: string
  large: string
}

export interface PortfolioSummary {
  totalInvested: number
  positionValue: number
  cashBalance: number
  totalEquity: number
  realizedProfit: number
  unrealizedProfit: number
  totalProfit: number
  totalROI: number
  activeTrades: number
  currency: 'USD' | 'BRL'
}

export interface ExportedData {
  trades: Trade[]
  settings: Settings
  ledger: LedgerEntry[]
  exportedAt: string
}

export const DEFAULT_SETTINGS: Settings = {
  targets: [
    {
      level: 1,
      percentage: 7,
      sellPercentage: 30,
    },
    {
      level: 2,
      percentage: 14,
      sellPercentage: 30,
    },
    {
      level: 3,
      percentage: 21,
      sellPercentage: 40,
    },
  ],

  currency: 'USD',

  theme: 'dark',
}
