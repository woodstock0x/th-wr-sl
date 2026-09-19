'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  History,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  ChevronRight,
  CheckCircle,
  Clock,
  Target,
  ArrowUpRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTrades } from '@/hooks/use-trades'
import { useSettings } from '@/hooks/use-settings'
import {
  formatCurrency,
  formatPercentage,
  formatQuantity,
  calculateRealizationProfit,
} from '@/lib/calculations'

type StatusFilter = 'all' | 'ATIVO' | 'FINALIZADO'

export default function HistoryPage() {
  const { trades, isLoading: tradesLoading } = useTrades()
  const { settings, isLoading: settingsLoading } = useSettings()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<'date' | 'profit'>('date')

  /*
   * ============================================================
   * ÚLTIMAS REALIZAÇÕES
   * ============================================================
   *
   * Transforma todas as realizações dos trades em uma lista única,
   * mantendo a referência do trade de origem.
   */
  const latestRealizations = useMemo(() => {
    const realizations = trades.flatMap((trade) =>
      trade.realizations.map((realization) => ({
        ...realization,
        trade,
      }))
    )

    return realizations
      .sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
      )
      .slice(0, 10)
  }, [trades])

  const filteredTrades = useMemo(() => {
    let result = [...trades]

    // Filtro por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase()

      result = result.filter(
        (t) =>
          t.coinSymbol.toLowerCase().includes(query) ||
          t.coinName.toLowerCase().includes(query)
      )
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      result = result.filter(
        (t) => t.status === statusFilter
      )
    }

    // Ordenação
    result.sort((a, b) => {
      if (sortBy === 'date') {
        return (
          new Date(b.entryDate).getTime() -
          new Date(a.entryDate).getTime()
        )
      }

      if (sortBy === 'profit') {
        const profitA = a.realizations.reduce(
          (sum, r) =>
            sum + calculateRealizationProfit(r, a),
          0
        )

        const profitB = b.realizations.reduce(
          (sum, r) =>
            sum + calculateRealizationProfit(r, b),
          0
        )

        return profitB - profitA
      }

      return 0
    })

    return result
  }, [
    trades,
    searchQuery,
    statusFilter,
    sortBy,
  ])

  const stats = useMemo(() => {
    const total = trades.length

    const active = trades.filter(
      (t) => t.status === 'ATIVO'
    ).length

    const finished = trades.filter(
      (t) => t.status === 'FINALIZADO'
    ).length

    const totalProfit = Number(
      trades
        .reduce((sum, t) => {
          const tradeProfit = t.realizations.reduce(
            (s, r) =>
              s + calculateRealizationProfit(r, t),
            0
          )

          return sum + tradeProfit
        }, 0)
        .toFixed(2)
    )

    const profitableTrades = trades.filter((t) => {
      const tradeProfit = t.realizations.reduce(
        (s, r) =>
          s + calculateRealizationProfit(r, t),
        0
      )

      return tradeProfit > 0
    }).length

    return {
      total,
      active,
      finished,
      totalProfit,
      winRate:
        total > 0
          ? (profitableTrades / total) * 100
          : 0,
    }
  }, [trades])

  const isLoading =
    tradesLoading || settingsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />

        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton
              key={i}
              className="h-24"
            />
          ))}
        </div>

        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ========================================================
          HEADER
      ======================================================== */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Histórico
        </h1>

        <p className="text-muted-foreground">
          Visualize todos os seus trades e realizações
        </p>
      </div>

      {/* ========================================================
          STATS
      ======================================================== */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Trades
            </CardTitle>

            <History className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ativos / Finalizados
            </CardTitle>

            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {stats.active} / {stats.finished}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unrealized
            </CardTitle>

            {stats.totalProfit >= 0 ? (
              <TrendingUp className="size-4 text-chart-1" />
            ) : (
              <TrendingDown className="size-4 text-destructive" />
            )}
          </CardHeader>

          <CardContent>
            <div
              className={`text-2xl font-bold ${stats.totalProfit >= 0
                ? 'text-chart-1'
                : 'text-destructive'
                }`}
            >
              {formatCurrency(
                stats.totalProfit,
                settings.currency
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Acerto
            </CardTitle>

            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {stats.winRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>


      {/* ========================================================
          ÚLTIMAS REALIZAÇÕES
      ======================================================== */}
      {latestRealizations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                Últimas Realizações
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                As 10 realizações mais recentes
              </p>
            </div>

            <Target className="size-5 text-muted-foreground" />
          </CardHeader>

          <CardContent className="px-0 sm:px-6">
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">
                      Preço
                    </TableHead>
                    <TableHead className="text-right">
                      Quantidade
                    </TableHead>
                    <TableHead className="text-right">
                      Valor
                    </TableHead>
                    <TableHead className="text-right">
                      Lucro
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {latestRealizations.map(
                    (realization) => {

                      const profit = Number(
                        calculateRealizationProfit(
                          realization,
                          realization.trade
                        ).toFixed(2)
                      )


                      const targetLabel =
                        realization.targetLevel > 0
                          ? `T${realization.targetLevel}`
                          : 'Manual'

                      return (
                        <TableRow
                          key={`${realization.trade.id}-${realization.id}`}
                        >
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {format(
                                  new Date(
                                    realization.date
                                  ),
                                  'dd/MM/yyyy',
                                  {
                                    locale: ptBR,
                                  }
                                )}
                              </span>

                              <span className="text-xs text-muted-foreground">
                                {format(
                                  new Date(
                                    realization.date
                                  ),
                                  'HH:mm',
                                  {
                                    locale: ptBR,
                                  }
                                )}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Link
                              href={`/trades/${realization.trade.id}`}
                              className="flex items-center gap-2 hover:underline"
                            >
                              {realization.trade.coinImage ? (
                                <img
                                  src={
                                    realization.trade
                                      .coinImage
                                  }
                                  alt={
                                    realization.trade
                                      .coinSymbol
                                  }
                                  className="size-7 rounded-full"
                                />
                              ) : (
                                <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                                  {realization.trade.coinSymbol.slice(
                                    0,
                                    2
                                  )}
                                </div>
                              )}

                              <div>
                                <div className="font-medium">
                                  {
                                    realization.trade
                                      .coinSymbol
                                  }
                                </div>

                                <div className="text-xs text-muted-foreground">
                                  {
                                    realization.trade
                                      .coinName
                                  }
                                </div>
                              </div>
                            </Link>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                            >
                              {targetLabel}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right font-medium">
                            {formatCurrency(
                              realization.exitPrice,
                              settings.currency
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            {formatQuantity(
                              realization.quantity
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            {formatCurrency(
                              realization.exitPrice * realization.quantity,
                              settings.currency
                            )}
                          </TableCell>

                          <TableCell
                            className={`text-right font-medium ${profit >= 0
                              ? 'text-chart-1'
                              : 'text-destructive'
                              }`}
                          >
                            {formatCurrency(
                              profit,
                              settings.currency
                            )}
                          </TableCell>

                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <Link
                                href={`/trades/${realization.trade.id}`}
                              >
                                <ArrowUpRight className="size-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    }
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="space-y-2 px-4 md:hidden">
              {latestRealizations.map(
                (realization) => {

                  const profit = Number(
                    calculateRealizationProfit(
                      realization,
                      realization.trade
                    ).toFixed(2)
                  )

                  const targetLabel =
                    realization.targetLevel > 0
                      ? `T${realization.targetLevel}`
                      : 'Manual'

                  return (
                    <Link
                      key={`${realization.trade.id}-${realization.id}`}
                      href={`/trades/${realization.trade.id}`}
                      className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {realization.trade.coinImage ? (
                            <img
                              src={
                                realization.trade
                                  .coinImage
                              }
                              alt={
                                realization.trade
                                  .coinSymbol
                              }
                              className="size-8 shrink-0 rounded-full"
                            />
                          ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                              {realization.trade.coinSymbol.slice(
                                0,
                                2
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {
                                  realization.trade
                                    .coinSymbol
                                }
                              </span>

                              <Badge
                                variant="outline"
                                className="text-xs"
                              >
                                {targetLabel}
                              </Badge>
                            </div>

                            <p className="truncate text-xs text-muted-foreground">
                              {format(
                                new Date(
                                  realization.date
                                ),
                                "dd/MM/yyyy 'às' HH:mm",
                                {
                                  locale: ptBR,
                                }
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={`text-sm font-medium ${profit >= 0
                              ? 'text-chart-1'
                              : 'text-destructive'
                              }`}
                          >
                            {formatCurrency(
                              profit,
                              settings.currency
                            )}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Lucro
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Preço
                          </p>

                          <p className="text-sm font-medium">
                            {formatCurrency(
                              realization.exitPrice,
                              settings.currency
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Quantidade
                          </p>

                          <p className="text-sm font-medium">
                            {formatQuantity(
                              realization.quantity
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Valor
                          </p>

                          <p className="text-sm font-medium">
                            {formatCurrency(
                              realization.exitPrice * realization.quantity,
                              settings.currency
                            )}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                }
              )}
            </div>
          </CardContent>
        </Card>
      )}


      {/* ========================================================
          FILTERS
      ======================================================== */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                placeholder="Buscar por moeda..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(
                    v as StatusFilter
                  )
                }
              >
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 size-4" />

                  <SelectValue placeholder="Status" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">
                    Todos
                  </SelectItem>

                  <SelectItem value="ATIVO">
                    Ativos
                  </SelectItem>

                  <SelectItem value="FINALIZADO">
                    Finalizados
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortBy}
                onValueChange={(v) =>
                  setSortBy(
                    v as 'date' | 'profit'
                  )
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="date">
                    Data
                  </SelectItem>

                  <SelectItem value="profit">
                    Lucro
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* ========================================================
          TRADES TABLE
      ======================================================== */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>

        <CardContent className="px-4 pb-4 sm:px-6">
          {filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <History className="mb-4 size-12 text-muted-foreground" />

              <h3 className="mb-2 text-lg font-medium">
                Nenhum trade encontrado
              </h3>

              <p className="mb-4 text-sm text-muted-foreground">
                {searchQuery ||
                  statusFilter !== 'all'
                  ? 'Tente ajustar os filtros'
                  : 'Comece adicionando seu primeiro trade'}
              </p>

              {!searchQuery &&
                statusFilter === 'all' && (
                  <Button asChild>
                    <Link href="/trades/new">
                      Novo Trade
                    </Link>
                  </Button>
                )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTrades.map((trade) => {
                const profit = Number(
                  trade.realizations
                    .reduce(
                      (sum, r) =>
                        sum +
                        calculateRealizationProfit(
                          r,
                          trade
                        ),
                      0
                    )
                    .toFixed(2)
                )

                const remainingQuantity =
                  Number(
                    trade.remainingQuantity
                  ) || 0

                return (
                  <div
                    key={trade.id}
                    className="rounded-lg border bg-card p-3"
                  >
                    {/* Cabeçalho */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {trade.coinImage ? (
                          <img
                            src={trade.coinImage}
                            alt={trade.coinSymbol}
                            className="size-7 shrink-0 rounded-full"
                          />
                        ) : (
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                            {trade.coinSymbol.slice(
                              0,
                              2
                            )}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {trade.coinSymbol}
                            </span>

                            <Badge
                              variant="outline"
                              className={
                                trade.type ===
                                  'COMPRA'
                                  ? 'border-b-muted'
                                  : trade.type ===
                                    'RECOMPRA'
                                    ? 'border-orange-500 text-orange-500'
                                    : ''
                              }
                            >
                              {trade.type}
                            </Badge>
                          </div>

                          <p className="truncate text-xs text-muted-foreground">
                            {trade.coinName}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={
                            trade.status ===
                              'ATIVO'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {trade.status}
                        </Badge>

                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <Link
                            href={`/trades/${trade.id}`}
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>

                    {/* Informações */}
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Data
                        </p>

                        <p className="text-sm font-medium">
                          {format(
                            new Date(
                              trade.entryDate
                            ),
                            'dd/MM/yyyy',
                            {
                              locale: ptBR,
                            }
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          Entrada
                        </p>

                        <p className="text-sm font-medium">
                          {formatCurrency(
                            trade.entryPrice,
                            settings.currency
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          Quantidade
                        </p>

                        <p className="text-sm font-medium">
                          {formatQuantity(
                            trade.quantity
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          Remaining
                        </p>

                        <p
                          className={`text-sm font-medium ${remainingQuantity > 0
                            ? 'text-chart-1'
                            : 'text-muted-foreground'
                            }`}
                        >
                          {formatQuantity(
                            remainingQuantity
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          Lucro Realizado
                        </p>

                        <p
                          className={`text-sm font-medium ${profit >= 0
                            ? 'text-chart-1'
                            : 'text-destructive'
                            }`}
                        >
                          {formatCurrency(
                            profit,
                            settings.currency
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Notas */}
                    {trade.notes && (
                      <div className="mt-3 border-t pt-2">
                        <p className="text-xs text-muted-foreground">
                          Notas
                        </p>

                        <p className="mt-0.5 break-words text-sm">
                          {trade.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}