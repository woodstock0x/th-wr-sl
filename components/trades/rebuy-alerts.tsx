'use client'

import Link from 'next/link'
import { Bell, TrendingDown, RefreshCcw, CheckCheck, Eye, BellOff, BellRing, CircleX, Flame } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trade, CoinGeckoPrice } from '@/lib/types'
import { formatCurrency, getTradeCurrency } from '@/lib/calculations'
import { computeRebuyAlerts } from '@/lib/rebuy'


interface RebuyAlertsProps {
  trades: Trade[]
  prices: CoinGeckoPrice
  tradeId?: string
  currency: 'USD' | 'BRL'
  onDismissRebuy: (tradeId: string, realizationId: string) => void
  onRestoreRebuy: (tradeId: string, realizationId: string) => void
}

export function RebuyAlerts({
  trades,
  prices,
  currency,
  tradeId,
  onDismissRebuy,
  onRestoreRebuy,
}: RebuyAlertsProps) {

  const { alerts, dismissedAlerts } = computeRebuyAlerts(trades, prices, currency, tradeId)

  if (alerts.length === 0  && dismissedAlerts.length === 0) {
    return null
  }

  if (alerts.length === 0) { return null }

  const formatValue = (value: number, trade: Trade) => formatCurrency(value, getTradeCurrency(trade, currency))

  return (
    <Card className="border-chart-1/50 bg-chart-1/5">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-chart-1" />

          <CardTitle className="text-chart-1">
            Oportunidades de Recompra
          </CardTitle>
        </div>

        <Badge className="bg-chart-1 text-background">
          {alerts.length}
        </Badge>
      </CardHeader>

      <CardContent>
        <div
          className={`grid gap-4 md:grid-cols-2 ${alerts.length === 1
            ? 'lg:grid-cols-1'
            : alerts.length === 2
              ? 'lg:grid-cols-2'
              : 'lg:grid-cols-3'
            }`}
        >
          {alerts.map((alert) => {
            const currentDropPercentage =
              ((alert.currentPrice - alert.realizationPrice) /
                alert.realizationPrice) *
              100
            return (
              <div
                key={`${alert.trade.id}-${alert.realizationId}`}
                className={`rounded-lg border bg-background p-3 ${currentDropPercentage < -10
                  ? 'border-chart-1'
                  : 'border-chart-1/30'
                  }`}
              >
                {/* CABEÇALHO — 2 COLUNAS / 2 LINHAS */}
                <div className="grid grid-cols-[48px_1fr] gap-x-3">

                  {/* COLUNA 1 — IMAGEM, OCUPANDO AS 2 LINHAS */}
                  <div className="row-span-2 flex items-center justify-center">
                    {alert.trade.coinImage ? (
                      <div className="flex size-10 items-center justify-center rounded-full border border-chart-1/50 bg-chart-1/10">
                        <img
                          src={alert.trade.coinImage}
                          alt={alert.trade.coinSymbol}
                          className="size-7 rounded-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-full border border-chart-1/50 bg-chart-1/20">
                        <RefreshCcw className="size-4 text-chart-1" />
                      </div>
                    )}
                  </div>

                  {/* COLUNA 2 — LINHA 1 */}
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold">
                        {alert.trade.coinSymbol}
                      </span>

                      <Badge
                        className="border-0 text-xs text-secondary-foreground"
                        style={{
                          backgroundColor:
                            alert.targetLevel === 1
                              ? '#16A34A'
                              : alert.targetLevel === 2
                                ? '#2563EB'
                                : alert.targetLevel === 3
                                  ? '#FF8000'
                                  : '#64748b',
                        }}
                      >
                        T{alert.targetLevel}
                      </Badge>

                      <Link
                        href={`/trades/${alert.trade.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <Eye className="size-4" />
                      </Link>
                    </div>

                    {/* Botões */}
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground hover:text-chart-1"
                      >
                        <Link
                          href={`/trades/new?rebuy=true&tradeId=${alert.trade.id}&realizationId=${alert.realizationId}`}
                        >
                          <CheckCheck className="size-4" />
                        </Link>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground hover:text-destructive/80"
                        onClick={() =>
                          onDismissRebuy(
                            alert.trade.id,
                            alert.realizationId
                          )
                        }
                      >
                        <CircleX className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* COLUNA 2 — LINHA 2 */}
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingDown className="size-3 text-chart-1" />
                      <span className="font-medium text-chart-1">
                        {currentDropPercentage.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* DADOS — 2 COLUNAS */}
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
                  <div className="text-xs text-muted-foreground">
                    <div>Realizado</div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {formatValue(alert.realizationPrice, alert.trade)}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <div>Atual</div>
                    <div className="mt-0.5 font-medium text-chart-1">
                      {formatValue(alert.currentPrice, alert.trade)}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <div>Valor</div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {formatValue(alert.realizationValue, alert.trade)}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <div>Quantidade</div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {alert.suggestedQuantity.toFixed(8)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>


        {dismissedAlerts.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Oportunidades Ignoradas
              </span>

              <Badge variant="secondary">
                {dismissedAlerts.length}
              </Badge>
            </div>

            <div
              className={`grid gap-3 md:grid-cols-2 ${dismissedAlerts.length === 1
                ? 'lg:grid-cols-1'
                : dismissedAlerts.length === 2
                  ? 'lg:grid-cols-2'
                  : 'lg:grid-cols-3'
                }`}
            >
              {dismissedAlerts.map((alert) => {

                const currentDropPercentage =
                  ((alert.currentPrice - alert.realizationPrice) /
                    alert.realizationPrice) *
                  100

                return (
                  <div
                    key={`${alert.trade.id}-${alert.realizationId}`}
                    className={`rounded-lg border bg-background p-3 ${currentDropPercentage < -50
                      ? 'border-chart-1'
                      : 'border-chart-1/30'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {alert.trade.coinSymbol}
                        </span>

                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-xs"
                        >
                          T{alert.targetLevel}
                        </Badge>

                        <Link
                          href={`/trades/${alert.trade.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          <Eye className="size-4" />
                        </Link>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground hover:text-chart-1"
                        onClick={() =>
                          onRestoreRebuy(
                            alert.trade.id,
                            alert.realizationId
                          )
                        }
                      >
                        <BellRing className="size-4" />
                      </Button>
                    </div>

                    <div className="mt-1 grid grid-cols-2 gap-x-4 text-xs">
                      <div className="text-muted-foreground">
                        Realizado / Recompra
                      </div>

                      <div className="text-right font-medium text-chart-1">
                        {formatValue(alert.realizationValue, alert.trade)}
                      </div>

                      <div className="text-muted-foreground">
                        Gatilho
                      </div>

                      <div className="text-right font-medium text-foreground">
                        {formatValue(alert.triggerPrice, alert.trade)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
