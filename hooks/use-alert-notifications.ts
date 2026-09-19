'use client'

import { useEffect, useRef } from 'react'
import type { CoinGeckoPrice, Settings, Trade } from '@/lib/types'
import { getTargetStatus, formatCurrency } from '@/lib/calculations'
import { computeRebuyAlerts } from '@/lib/rebuy'
import { notify } from '@/lib/notifications'

/**
 * Observa os trades ativos e dispara notificações do navegador para novas
 * oportunidades de target e recompra. Cada oportunidade é notificada uma
 * única vez por sessão de página (evita repetir a cada refresh de preço).
 */
export function useAlertNotifications(trades: Trade[], prices: CoinGeckoPrice, settings: Settings) {
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!settings.notificationsEnabled) return

    const currencyKey = settings.currency.toLowerCase() as 'usd' | 'brl'

    for (const trade of trades) {
      if (trade.status !== 'ATIVO') continue
      const currentPrice = prices[trade.coinId]?.[currencyKey]
      if (!currentPrice || currentPrice <= 0) continue

      const { targetsReached } = getTargetStatus(trade.entryPrice, currentPrice, settings.targets, trade.targetsHit)

      for (const level of targetsReached) {
        if (trade.targetsIgnored?.includes(level)) continue
        const key = `target:${trade.id}:${level}`
        if (notifiedRef.current.has(key)) continue
        notifiedRef.current.add(key)
        notify(
          `${trade.coinSymbol} atingiu T${level}`,
          `Preço atual ${formatCurrency(currentPrice, settings.currency)}. Considere realizar lucro.`,
          key,
        )
      }
    }

    const { alerts } = computeRebuyAlerts(trades, prices, settings.currency)
    for (const alert of alerts) {
      const key = `rebuy:${alert.trade.id}:${alert.realizationId}`
      if (notifiedRef.current.has(key)) continue
      notifiedRef.current.add(key)
      notify(
        `Oportunidade de recompra: ${alert.trade.coinSymbol}`,
        `Preço caiu para ${formatCurrency(alert.currentPrice, settings.currency)}, abaixo do gatilho de recompra.`,
        key,
      )
    }
  }, [trades, prices, settings])
}
