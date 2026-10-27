'use client'

import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary'
import { ConsolidatedPositions } from '@/components/dashboard/consolidated-positions'
import { ActiveTradesList } from '@/components/dashboard/active-trades-list'
import { TargetAlerts } from '@/components/dashboard/target-alerts'
import { RebuyAlerts } from '@/components/trades/rebuy-alerts'
import { useTrades } from '@/hooks/use-trades'
import { usePrices } from '@/hooks/use-prices'
import { useSettings } from '@/hooks/use-settings'
import { useAlertNotifications } from '@/hooks/use-alert-notifications'
import { calculatePortfolioSummary } from '@/lib/calculations'
import { ledgerCashBalance } from '@/lib/ledger'

export default function DashboardPage() {
  const {
    trades,
    isLoading: tradesLoading,
    dismissRebuyOpportunity,
    restoreRebuyOpportunity,
    dismissTargetOpportunity,
    restoreTargetOpportunity,
    setTargetStopLoss,
    removeTargetStopLoss,
  } = useTrades()
  const { settings, isLoading: settingsLoading } = useSettings()

  const activeTrades = useMemo(
    () => trades.filter((t) => t.status === 'ATIVO'),
    [trades]
  )

  const coinIds = useMemo(
    () => [...new Set(trades.map((t) => t.coinId))],
    [trades]
  )

  const { prices, isLoading: pricesLoading, lastUpdated, refetch } = usePrices(coinIds)

  const summary = useMemo(
    () => calculatePortfolioSummary(trades, prices, settings.currency),
    [trades, prices, settings.currency]
  )

  useAlertNotifications(activeTrades, prices, settings)

  const cashBalance = summary.cashBalance

  const isLoading = tradesLoading || settingsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Target Hunter</h1>
          <p className="text-muted-foreground">
            Intelligent Trade Management & Tracking
          </p>
        </div>
        <div className="flex items-center gap-2">

          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {lastUpdated.toLocaleTimeString('pt-BR')}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={pricesLoading}
          >
            <RefreshCw className={`mr-2 size-4 ${pricesLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <PortfolioSummary summary={summary} />

      <TargetAlerts
        trades={activeTrades}
        prices={prices}
        targets={settings.targets}
        currency={settings.currency}
        onDismissTarget={dismissTargetOpportunity}
        onRestoreTarget={restoreTargetOpportunity}
        setTargetStopLoss={setTargetStopLoss}
        removeTargetStopLoss={removeTargetStopLoss}

      />

      <RebuyAlerts
        trades={activeTrades}
        prices={prices}
        currency={settings.currency}
        onDismissRebuy={dismissRebuyOpportunity}
        onRestoreRebuy={restoreRebuyOpportunity}
      />

      <ConsolidatedPositions
        trades={trades}
        prices={prices}
        currency={settings.currency}
      />

      <ActiveTradesList
        trades={activeTrades}
        prices={prices}
        targets={settings.targets}
        currency={settings.currency}
      />

    </div>
  )
}
