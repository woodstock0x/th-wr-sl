'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, ArrowUpDown, ArrowUp, ArrowDown, Target, CandlestickChart, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trade, TargetConfig, CoinGeckoPrice } from '@/lib/types'
import { calculateROI, formatCurrency, formatPercentage, formatQuantity, getTargetStatus, getTradeCurrentPrice } from '@/lib/calculations'
import { useMemo, useState } from 'react'

interface ActiveTradesListProps {
  trades: Trade[]
  prices: CoinGeckoPrice
  targets: TargetConfig[]
  currency: 'USD' | 'BRL'
}

type SortOption = 'roi' | 'date' | 'invested'

const sortLabels: Record<SortOption, string> = {
  roi: 'Valorização',
  date: 'Data de criação',
  invested: 'Valor investido',
}

export function ActiveTradesList({ trades, prices, targets, currency }: ActiveTradesListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('roi')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const { positiveCount, negativeCount } = useMemo(() => {
    return trades.reduce(
      (acc, trade) => {
        const currentPrice = getTradeCurrentPrice(trade, prices, currency)
        const roi = calculateROI(trade.entryPrice, currentPrice, trade.type === 'VENDA')
        if (roi >= 0) acc.positiveCount++
        else acc.negativeCount++
        return acc
      },
      { positiveCount: 0, negativeCount: 0 },
    )
  }, [trades, prices, currency])

  const sortedTrades = useMemo(() => {
    const directionMultiplier = sortDirection === 'asc' ? -1 : 1

    return [...trades].sort((a, b) => {
      let comparison: number

      if (sortBy === 'date') {
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      } else if (sortBy === 'invested') {
        comparison = b.entryPrice * b.quantity - a.entryPrice * a.quantity
      } else {
        const priceA = getTradeCurrentPrice(a, prices, currency)
        const priceB = getTradeCurrentPrice(b, prices, currency)
        comparison =
          calculateROI(b.entryPrice, priceB, b.type === 'VENDA') -
          calculateROI(a.entryPrice, priceA, a.type === 'VENDA')
      }

      return comparison * directionMultiplier
    })
  }, [trades, prices, currency, sortBy, sortDirection])

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
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CandlestickChart className="size-5" />

          <CardTitle>
            Trades Ativos
          </CardTitle>
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger size="sm" className="gap-1.5 text-xs">
              <ArrowUpDown className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                <SelectItem key={option} value={option}>
                  {sortLabels[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 cursor-pointer"
            onClick={() => setSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'))}
            title={sortDirection === 'desc' ? 'Decrescente' : 'Crescente'}
          >
            {sortDirection === 'desc' ? (
              <ArrowDown className="size-3.5" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </Button>

          <span className="text-xs font-medium text-chart-1">+{positiveCount}</span>
          <span className="text-xs font-medium text-chart-2">-{negativeCount}</span>

          <Badge variant="secondary">{trades.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedTrades.map((trade) => {
            const tradeCurrency = trade.currency || currency
            const currentPrice = getTradeCurrentPrice(trade, prices, currency)
            const isShort = trade.type === 'VENDA'
            const roi = calculateROI(trade.entryPrice, currentPrice, isShort)
            const isPositive = roi >= 0
            const currentValue = currentPrice * trade.remainingQuantity
            const { nextTarget, targetsReached } = getTargetStatus(
              trade.entryPrice,
              currentPrice,
              targets,
              trade.targetsHit,
              isShort
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
                <div className="flex items-center">
                  <div className="flex w-[15%] shrink-0 items-center">
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
                  </div>

                  <div className="flex w-[15%] shrink-0 items-center overflow-hidden">
                    <span className="truncate font-semibold">{trade.coinSymbol}</span>
                  </div>

                  <div className="flex w-[10%] shrink-0 items-center">
                    {trade.type === 'RECOMPRA' && (
                      <Badge
                        variant="outline"
                        className="border-0 bg-chart-3 text-white"
                      >
                        R
                      </Badge>
                    )}
                    {trade.type === 'VENDA' && (
                      <Badge
                        variant="outline"
                        className="border-0 bg-chart-2 text-white"
                      >
                        V
                      </Badge>
                    )}
                  </div>

                  <div className="flex w-[10%] shrink-0 items-center">
                    {trade.fundingSource === 'CASH' && (
                      <Wallet
                        className="size-3.5 text-chart-1"
                        aria-label="Saldo em Caixa"
                      >
                        <title>Saldo em Caixa</title>
                      </Wallet>
                    )}
                  </div>

                  <div className="flex w-[50%] shrink-0 items-center justify-end gap-2">
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

                <div className="mt-2 space-y-2">

                  <div className="flex items-center justify-between">
                    <span className='text-sm'>
                      {formatQuantity(trade.remainingQuantity)} {trade.coinSymbol}
                    </span>

                    <div className="flex items-center gap-2">
                      {targetsReached.length > 0 && (
                        <div className="flex gap-1">
                          {targetsReached.map((level) => {
                            const targetTextColors: Record<number, string> = {
                              1: 'text-chart-1',
                              2: 'text-chart-3',
                              3: 'text-chart-4',
                            }

                            return (
                              <Badge
                                key={level}
                                className={`border-0 bg-muted text-xs ${targetTextColors[level] || 'text-muted-foreground'}`}
                              >
                                T{level}
                              </Badge>
                            )
                          })}
                        </div>
                      )}

                      <span className={isPositive ? 'text-chart-1' : 'text-chart-2'}>
                        {formatCurrency(currentValue, tradeCurrency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Entrada: {formatCurrency(trade.entryPrice, tradeCurrency)}
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
