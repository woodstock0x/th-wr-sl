import type { CoinGeckoPrice, Trade } from './types'
import { getTradeCurrency } from './calculations'

export interface RebuyAlert {
  trade: Trade
  realizationId: string
  targetLevel: number
  realizationPrice: number
  triggerPrice: number
  currentPrice: number
  realizationValue: number
  suggestedQuantity: number
}

export const REBUY_DROP_PERCENTAGE = 1

/**
 * Calcula oportunidades de recompra (ativas e descartadas) a partir dos trades.
 *
 * Extraído do componente RebuyAlerts para ser testável isoladamente: o
 * componente tinha um `continue` antecipado para realizações com
 * `rebuyStatus === 'DISMISSED'` que tornava o branch de "oportunidades
 * ignoradas" inatingível (nunca populado), quebrando o botão de restaurar.
 */
export function computeRebuyAlerts(
  trades: Trade[],
  prices: CoinGeckoPrice,
  currency: 'USD' | 'BRL',
  onlyTradeId?: string,
): { alerts: RebuyAlert[]; dismissedAlerts: RebuyAlert[] } {
  const alerts: RebuyAlert[] = []
  const dismissedAlerts: RebuyAlert[] = []

  const executedRebuys = new Set(
    trades
      .filter((trade) => trade.type === 'RECOMPRA' && trade.rebuySource)
      .map((trade) => trade.rebuySource!.realizationId),
  )

  for (const trade of trades) {
    if (onlyTradeId && trade.id !== onlyTradeId) continue
    // Numa VENDA, a própria realização já é a recompra (fechar a posição
    // vendida) — não faz sentido sugerir uma segunda recompra em cima dela.
    if (trade.type === 'VENDA') continue

    for (const realization of trade.realizations) {
      if (realization.targetLevel <= 0) continue
      if (executedRebuys.has(realization.id)) continue

      const tradeCurrencyKey = getTradeCurrency(trade, currency).toLowerCase() as 'usd' | 'brl'
      const currentPrice = prices[trade.coinId]?.[tradeCurrencyKey]
      if (!currentPrice || currentPrice <= 0) continue

      const triggerPrice = realization.exitPrice * (1 - REBUY_DROP_PERCENTAGE / 100)
      const realizationValue = realization.exitPrice * realization.quantity
      const suggestedQuantity = realizationValue / currentPrice

      const alert: RebuyAlert = {
        trade,
        realizationId: realization.id,
        targetLevel: realization.targetLevel,
        realizationPrice: realization.exitPrice,
        triggerPrice,
        currentPrice,
        realizationValue,
        suggestedQuantity,
      }

      if (realization.rebuyStatus === 'DISMISSED') {
        // Continua listada como "ignorada" independentemente do preço atual,
        // para que o usuário sempre consiga restaurá-la.
        dismissedAlerts.push(alert)
        continue
      }

      // Só vira alerta ativo quando o preço realmente caiu o suficiente.
      if (currentPrice > triggerPrice) continue

      alerts.push(alert)
    }
  }

  return { alerts, dismissedAlerts }
}
