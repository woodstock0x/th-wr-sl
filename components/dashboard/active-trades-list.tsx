'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Target, ChevronRight, CandlestickChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Trade, TargetConfig, CoinGeckoPrice } from '@/lib/types'
import { calculateROI, formatCurrency, formatPercentage, formatQuantity, getTargetStatus } from '@/lib/calculations'
import { useMemo } from 'react'

interface ActiveTradesListProps {
  trades: Trade[]
  prices: CoinGeckoPrice
  targets: TargetConfig[]
  currency: 'USD' | 'BRL'
}

export function ActiveTradesList({ trades, prices, targets, currency }: ActiveTradesListProps) {
  const currencyKey = currency.toLowerCase() as 'usd' | 'brl'

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const priceA = prices[a.coinId]?.[currencyKey] || a.entryPrice
      const priceB = prices[b.coinId]?.[currencyKey] || b.entryPrice

      const roiA = calculateROI(a.entryPrice, priceA)
      const roiB = calculateROI(b.entryPrice, priceB)

      const valueA = priceA * a.remainingQuantity
      const valueB = priceB * b.remainingQuantity

      const scoreA = (roiA / 100) * valueA
      const scoreB = (roiB / 100) * valueB

      return scoreB - scoreA
    })
  }, [trades, prices, currencyKey])

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trades Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">Nenhum trade ativo</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Comece adicionando seu primeiro trade
            </p>
            <Button asChild>
              <Link href="/trades/new">Novo Trade</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CandlestickChart className="size-5" />

          <CardTitle>
            Trades Ativos
          </CardTitle>
        </div>
        <Badge variant="secondary">{trades.length}</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedTrades.map((trade) => {
            const currentPrice = prices[trade.coinId]?.[currencyKey] || trade.entryPrice
            const roi = calculateROI(trade.entryPrice, currentPrice)
            const isPositive = roi >= 0
            const currentValue = currentPrice * trade.remainingQuantity
            const { nextTarget, targetsReached } = getTargetStatus(
              trade.entryPrice,
              currentPrice,
              targets,
              trade.targetsHit
            )

            const progressToNextTarget = nextTarget
              ? Math.min((roi / nextTarget.percentage) * 100, 100)
              : 100

            return (
              <Link
                key={trade.id}
                href={`/trades/${trade.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {trade.coinImage ? (
                      <div className="flex size-10 items-center justify-center rounded-full border border-secondary/50 bg-secondary/10">
                        <img
                          src={trade.coinImage}
                          alt={trade.coinSymbol}
                          className="size-7 rounded-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-full border border-secondary/50 bg-secondary text-sm font-bold">
                        {trade.coinSymbol.slice(0, 2)}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{trade.coinSymbol}</span>

                        <Badge
                          variant="outline"
                          className={
                            trade.type === 'COMPRA'
                              ? 'border-b-muted'
                              : trade.type === 'RECOMPRA'
                                ? 'border-orange-500 text-orange-500'
                                : ''
                          }
                        >
                          {trade.type}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {trade.coinName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">


                        {isPositive ? (
                          <ArrowUpRight className="text-chart-1 size-4" />
                        ) : (
                          <ArrowDownRight className="text-destructive size-4" />
                        )}
                        <span className={`text-ms font-light ${isPositive ? 'text-chart-1' : 'text-destructive'}`}>
                          {formatPercentage(roi)}
                        </span>

                      </div>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="mt-2 space-y-2">

                  <div className="flex items-center justify-between">
                    <span>
                      {formatQuantity(trade.remainingQuantity)} {trade.coinSymbol}
                    </span>

                    <div className="flex items-center gap-2">
                      <span>
                        {formatCurrency(currentValue, currency)}
                      </span>

                      {targetsReached.length > 0 && (
                        <div className="flex gap-1">
                          {targetsReached.map((level) => {
                            const targetColors: Record<number, string> = {
                              1: '#16A34A',
                              2: '#2563EB',
                              3: '#FF8000',
                            }

                            return (
                              <Badge
                                key={level}
                                className="border-0 text-xs text-secondary-foreground"
                                style={{
                                  backgroundColor: targetColors[level] || '#64748b',
                                }}
                              >
                                T{level}
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Entrada: {formatCurrency(trade.entryPrice, currency)}
                    </span>

                    <span className="text-muted-foreground">
                      Targets: {trade.targetsHit.length}/{targets.length}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
