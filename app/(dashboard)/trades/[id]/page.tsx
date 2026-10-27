'use client'

import { use, useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getColorClass } from '@/lib/utils'
import { RebuyAlerts } from '@/components/trades/rebuy-alerts'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  Trash2,
  Edit,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  TrendingUpDown,
  Split,
  ShieldAlert,
  BellRing,
  BellOff

} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/currency-input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { RealizationForm } from '@/components/trades/realization-form'
import { useTrades } from '@/hooks/use-trades'
import { usePrices } from '@/hooks/use-prices'
import { useSettings } from '@/hooks/use-settings'
import {
  formatCurrency,
  formatPercentage,
  formatQuantity,
  getTargetStatus,
  getTradeCurrentPrice,
  calculateAdjustedEntryPrice,
  calculateRealizationProfit,
  calculateROI,
  calculateTotalRealized,
} from '@/lib/calculations'
import { toast } from 'sonner'
import { getLedger } from '@/lib/ledger'

export default function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {

  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()

  const {
    trades,
    isLoading: tradesLoading,
    deleteTrade,
    updateTrade,
    getTradeById,
    deleteRealization,
    addRealization,
    setTargetStopLoss,
    removeTargetStopLoss,

    restoreRebuyOpportunity,
    dismissRebuyOpportunity,
  } = useTrades()

  const { settings, isLoading: settingsLoading } = useSettings()

  const trade = useMemo(() => getTradeById(id), [getTradeById, id])

  const coinIds = useMemo(() => (trade ? [trade.coinId] : []), [trade])
  const { prices, get24hChange } = usePrices(coinIds)

  const [showRealizationForm, setShowRealizationForm] = useState(false)
  const [suggestedTargetLevel, setSuggestedTargetLevel] = useState<number | undefined>()

  const [showStopLossDialog, setShowStopLossDialog] = useState(false)

  const [selectedStopLoss, setSelectedStopLoss] = useState<{
    tradeId: string
    targetLevel: number
    entryPrice: number
  } | null>(null)

  const [stopLossPrice, setStopLossPrice] = useState('')
  const [stopLossQuantity, setStopLossQuantity] = useState('')

  const [showNotesDialog, setShowNotesDialog] = useState(false)
  const [editedNotes, setEditedNotes] = useState('')

  // Verificar se deve abrir o form de realização
  useEffect(() => {
    const realize = searchParams.get('realize')
    const target = searchParams.get('target')

    if (realize === 'true') {
      setShowRealizationForm(true)
      if (target) {
        setSuggestedTargetLevel(Number.parseInt(target, 10))
      }
    }
  }, [searchParams])

  const handleEditNotes = () => {
    if (!trade) return

    setEditedNotes(trade.notes || '')
    setShowNotesDialog(true)
  }

  const handleSaveNotes = () => {
    if (!trade) return

    updateTrade(trade.id, {
      notes: editedNotes.trim(),
    })

    setShowNotesDialog(false)

    toast.success(
      editedNotes.trim()
        ? 'Nota atualizada com sucesso!'
        : 'Nota removida com sucesso!'
    )
  }

  const handleSaveStopLoss = () => {
    if (!trade || !selectedStopLoss) return

    const price = Number(
      stopLossPrice.replace(',', '.')
    )

    const quantity = Number(
      stopLossQuantity.replace(',', '.')
    )

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      toast.error(
        'Informe preço e quantidade válidos.'
      )
      return
    }

    const existingStopLoss =
      trade.stopLosses?.find(
        (stopLoss) =>
          stopLoss.targetLevel ===
          selectedStopLoss.targetLevel
      )

    if (existingStopLoss) {
      setTargetStopLoss(
        selectedStopLoss.tradeId,
        selectedStopLoss.targetLevel,
        price,
        quantity
      )

      toast.success(
        'Stop Loss atualizado com sucesso!'
      )
    } else {
      setTargetStopLoss(
        selectedStopLoss.tradeId,
        selectedStopLoss.targetLevel,
        price,
        quantity
      )

      toast.success(
        'Stop Loss criado com sucesso!'
      )
    }

    setShowStopLossDialog(false)
    setSelectedStopLoss(null)
    setStopLossPrice('')
    setStopLossQuantity('')
  }

  const handleRemoveStopLoss = () => {
    if (!selectedStopLoss) return

    removeTargetStopLoss(
      selectedStopLoss.tradeId,
      selectedStopLoss.targetLevel
    )

    toast.success('Stop Loss removido com sucesso!')

    setShowStopLossDialog(false)
    setSelectedStopLoss(null)
    setStopLossPrice('')
    setStopLossQuantity('')
  }

  const handleDismissRebuy = (
    tradeId: string,
    realizationId: string
  ) => {
    dismissRebuyOpportunity(
      tradeId,
      realizationId
    )
  }

  const handleRestoreRebuy = (
    tradeId: string,
    realizationId: string
  ) => {
    restoreRebuyOpportunity(
      tradeId,
      realizationId
    )
  }


  const isLoading = tradesLoading || settingsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!trade) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="mb-2 text-xl font-semibold">Trade nao encontrado</h2>
        <p className="mb-4 text-muted-foreground">O trade solicitado nao existe ou foi removido.</p>
        <Button asChild>
          <Link href="/">Voltar ao Dashboard</Link>
        </Button>
      </div>
    )
  }

  const isShort = trade.type === 'VENDA'
  const tradeCurrency = trade.currency || settings.currency
  const currencyKey = tradeCurrency.toLowerCase() as 'usd' | 'brl'
  const currentPrice = getTradeCurrentPrice(trade, prices, settings.currency)
  const change24h = get24hChange(trade.coinId, currencyKey)

  const { nextTarget, targetsReached } = getTargetStatus(
    trade.entryPrice,
    currentPrice,
    settings.targets,
    trade.targetsHit,
    isShort
  )

  const totalInvested = trade.entryPrice * trade.quantity
  const currentValue = currentPrice * trade.remainingQuantity
  const totalRealized = calculateTotalRealized(trade)
  const usdValue = trade.realizations.reduce((sum, r) => sum + r.usdValue, 0)
  const rawUnrealizedProfit = (currentPrice - trade.entryPrice) * trade.remainingQuantity
  const unrealizedProfit = isShort ? -rawUnrealizedProfit : rawUnrealizedProfit
  const roiRealized = totalRealized / totalInvested * 100

  const roi = (unrealizedProfit + totalRealized) / totalInvested * 100
  const isPositive = roi >= 0

  const progressToNextTarget = nextTarget
    ? Math.min((roi / nextTarget.percentage) * 100, 100)
    : 100

  const handleDelete = () => {
    deleteTrade(trade.id)
    toast.success('Trade removido com sucesso!')
    router.push('/')
  }

  const handleDismissTarget = (targetLevel: number) => {
    const currentIgnored = trade.targetsIgnored ?? []

    if (currentIgnored.includes(targetLevel)) return

    updateTrade(trade.id, {
      targetsIgnored: [...currentIgnored, targetLevel],
    })

    toast.success(`Target T${targetLevel} ignorado!`)
  }

  const handleRestoreTarget = (targetLevel: number) => {
    const currentIgnored = trade.targetsIgnored ?? []

    updateTrade(trade.id, {
      targetsIgnored: currentIgnored.filter(
        (level) => level !== targetLevel
      ),
    })

    toast.success(`Target T${targetLevel} restaurado!`)
  }



  const handleRealize = (targetLevel?: number) => {
    setSuggestedTargetLevel(targetLevel)
    setShowRealizationForm(true)
  }

  const handleOpenStopLoss = (
    tradeId: string,
    targetLevel: number,
    currentStopLoss?: {
      price: number
      quantity: number
    }
  ) => {
    setSelectedStopLoss({
      tradeId,
      targetLevel,
      entryPrice: trade?.entryPrice ?? 0,
    })

    setStopLossPrice(
      currentStopLoss
        ? currentStopLoss.price.toString()
        : ''
    )

    setStopLossQuantity(
      currentStopLoss
        ? currentStopLoss.quantity.toString()
        : ''
    )

    setShowStopLossDialog(true)
  }

  const adjustedEntryPrice = calculateAdjustedEntryPrice(trade)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <div className="grid grid-cols-[2rem_1fr] grid-rows-2 gap-x-3">

            {/* Imagem — ocupa as duas linhas */}
            <div className="row-span-2 flex items-center justify-center">
              <img
                src={trade.coinImage}
                className="h-8 w-8"
                alt={trade.coinName}
              />
            </div>

            {/* Linha 1 — Status e Tipo */}
            <div className="flex items-center gap-2">
              <Badge
                variant={trade.status === 'ATIVO' ? 'default' : 'secondary'}
              >
                {trade.status}
              </Badge>

              <Badge
                variant="outline"
                className={
                  trade.type === 'COMPRA'
                    ? 'border-b-muted'
                    : trade.type === 'RECOMPRA'
                      ? 'border-orange-500 text-orange-500'
                      : 'border-destructive text-destructive'
                }
              >
                {trade.type}
              </Badge>


            </div>

            {/* Linha 2 — Informações */}
            <div className="flex items-center gap-3">

              {/* Nome + símbolo */}
              <div className="flex flex-col">
                <h1 className="text-1xl font-bold">
                  {trade.coinName}
                </h1>
                <span className="text-xs text-muted-foreground">
                  {trade.coinSymbol}
                </span>
              </div>

              {/* Preço */}
              <div className="ml-[15px] flex flex-col">
                <span className="text-1xl">
                  {formatCurrency(currentPrice, tradeCurrency)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Price
                </span>
              </div>

              {/* Variação */}
              <div className="mr-[15px] flex flex-col items-start">
                <span
                  className={`text-1xl ${change24h >= 0
                    ? 'text-chart-1'
                    : 'text-destructive'
                    }`}
                >
                  {change24h >= 0 ? '+' : ''}
                  {change24h.toFixed(2)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  var 24h
                </span>
              </div>

            </div>
          </div>
        </div>

        <div className="ml-auto flex w-full items-center justify-center gap-2 md:w-auto md:justify-end">
          {trade.type === 'RECOMPRA' && trade.rebuySource?.tradeId && (
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer bg-secondary text-xs text-secondary-foreground hover:text-orange-500"
              asChild
            >
              <Link href={`/trades/${trade.rebuySource.tradeId}`}>
                <Split className="size-4" />
              </Link>
            </Button>
          )}

          {trade.status === 'ATIVO' && (
            <Button
              onClick={() => handleRealize()}
              className="cursor-pointer"
            >
              <DollarSign className="mr-2 size-4" />
              {isShort ? 'Recomprar' : 'Realizar Lucro'}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                className="cursor-pointer bg-destructive text-white hover:bg-red-800"
              >
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir trade?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acao nao pode ser desfeita. O trade e todas as realizacoes
                  associadas serao permanentemente excluidos.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">
                  Cancelar
                </AlertDialogCancel>

                <AlertDialogAction asChild>
                  <Button
                    variant="destructive"
                    className="cursor-pointer text-white"
                    onClick={handleDelete}
                  >
                    Excluir Trade
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ROI Total
            </CardTitle>
            {roi > 0 ? (
              <TrendingUp className={`size-4 font-bold ${getColorClass(roi)}`} />
            ) : (
              <TrendingDown className={`size-4 font-bold ${getColorClass(roi)}`} />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorClass(roi)}`}>
              {formatPercentage(roi)}
            </div>
            {/*
            <p className="text-xs text-muted-foreground">
              Preco atual: {formatCurrency(currentPrice, tradeCurrency)}
            </p>
            */}

            <p className="text-xs text-muted-foreground">
              PM Ajustado <span className="text-foreground">{formatCurrency(adjustedEntryPrice, tradeCurrency)}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor em Carteira
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getColorClass(
                isShort ? -(currentValue - totalInvested + usdValue) : currentValue - totalInvested + usdValue
              )}`}
            >
              {formatCurrency(currentValue, tradeCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatQuantity(trade.remainingQuantity)} {trade.coinSymbol}
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ROI Realized
            </CardTitle>
            {roiRealized > 0 ? (
              <TrendingUp className={`size-4 font-bold ${getColorClass(roiRealized)}`} />
            ) : (
              <TrendingDown className={`size-4 font-bold ${getColorClass(roiRealized)}`} />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorClass(roiRealized)}`}>
              {formatPercentage(roiRealized)}
            </div>
            <p className="text-xs text-muted-foreground">
              {trade.realizations.length} realizacoes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Realized
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorClass(totalRealized)}`}>
              {formatCurrency(totalRealized, tradeCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {trade.realizations.length} realizacoes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unrealized
            </CardTitle>
            <Target className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorClass(unrealizedProfit)}`}>
              {formatCurrency(unrealizedProfit, tradeCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Posicao aberta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Targets Progress */}
      {
        trade.status === 'ATIVO' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-5" />
                Progresso dos Targets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    ROI Atual: <span className={isPositive ? 'text-chart-1' : 'text-destructive'}>{formatPercentage(roi)}</span>
                  </span>
                  {nextTarget && (
                    <span className="text-muted-foreground">
                      Proximo: T{nextTarget.level} ({nextTarget.percentage}%)
                    </span>
                  )}
                </div>
                <Progress value={progressToNextTarget} className="h-3" />

                <div className="grid gap-3 md:grid-cols-3">
                  {settings.targets.map((target) => {
                    const isHit = trade.targetsHit.includes(target.level)
                    const isReached = targetsReached.includes(target.level)

                    const isIgnored =
                      trade.targetsIgnored?.includes(target.level) ?? false

                    const realization = trade.realizations.find(
                      r => r.targetLevel === target.level
                    )

                    const stopLoss = trade.stopLosses?.find(
                      stop => stop.targetLevel === target.level
                    )

                    const stopLossTriggered =
                      !!stopLoss &&
                      currentPrice <= stopLoss.price

                    return (
                      <div
                        key={target.level}
                        className={`rounded-lg border p-3 ${isHit
                          ? 'border-chart-1 bg-chart-1/10'
                          : isIgnored
                            ? 'border-muted-foreground/30 bg-muted/20'
                            : isReached
                              ? 'border-chart-3 bg-chart-3/10'
                              : 'border-border'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            T{target.level}
                          </span>

                          <div className="flex items-center justify-between">

                            <div className="flex items-center gap-2">

                              {/* TARGET REALIZADO */}
                              {isHit && (
                                <CheckCircle className="size-4 text-chart-1" />
                              )}

                              {/* TARGET IGNORADO */}
                              {isIgnored && !isHit && (
                                <>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Ignorado
                                  </Badge>

                                  {/* STOP LOSS */}
                                  {isIgnored && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className={`h-7 cursor-pointer bg-secondary px-2 ${stopLossTriggered
                                        ? 'hover:text-destructive'
                                        : stopLoss
                                          ? 'hover:text-chart-1'
                                          : 'hover:text-destructive'
                                        }`}
                                      onClick={() =>
                                        handleOpenStopLoss(
                                          trade.id,
                                          target.level,
                                          stopLoss
                                            ? {
                                              price: stopLoss.price,
                                              quantity: stopLoss.quantity,
                                            }
                                            : undefined
                                        )
                                      }
                                    >
                                      <ShieldAlert
                                        className={`size-4 ${stopLossTriggered
                                          ? 'text-destructive'
                                          : stopLoss
                                            ? 'text-chart-1'
                                            : ''
                                          }`}
                                      />
                                    </Button>
                                  )}
                                </>
                              )}

                              {/* TARGET ATINGIDO E NÃO IGNORADO */}
                              {isReached && !isHit && !isIgnored && (
                                <>
                                  <Badge className="bg-chart-3 text-xs text-background">
                                    Atingido!
                                  </Badge>

                                  {/* STOP LOSS */}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className={`h-7 cursor-pointer bg-secondary px-2 ${stopLossTriggered
                                      ? 'hover:text-destructive'
                                      : stopLoss
                                        ? 'hover:text-chart-1'
                                        : 'hover:text-destructive'
                                      }`}
                                    onClick={() =>
                                      handleOpenStopLoss(
                                        trade.id,
                                        target.level,
                                        stopLoss
                                          ? {
                                            price: stopLoss.price,
                                            quantity: stopLoss.quantity,
                                          }
                                          : undefined
                                      )
                                    }
                                  >
                                    <ShieldAlert
                                      className={`size-4 ${stopLossTriggered
                                        ? 'text-destructive'
                                        : stopLoss
                                          ? 'text-chart-1'
                                          : ''
                                        }`}
                                    />
                                  </Button>
                                </>
                              )}

                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          +{target.percentage}% | Vender {target.sellPercentage}%
                        </p>
                        {isHit && realization ? (
                          <div className="mt-2 space-y-1 border-t border-chart-1/30 pt-2 text-xs">

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Data:
                              </span>

                              <span>
                                {format(
                                  new Date(realization.date),
                                  'dd/MM/yy'
                                )}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Saida:
                              </span>

                              <span>
                                {formatCurrency(
                                  realization.exitPrice,
                                  tradeCurrency
                                )}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                ROI:
                              </span>

                              <span
                                className={
                                  calculateROI(trade.entryPrice, realization.exitPrice, isShort) >= 0
                                    ? 'text-chart-1'
                                    : 'text-destructive'
                                }
                              >
                                {formatPercentage(
                                  calculateROI(trade.entryPrice, realization.exitPrice, isShort)
                                )}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Lucro:
                              </span>

                              <span
                                className={
                                  calculateRealizationProfit(
                                    realization,
                                    trade
                                  ) >= 0
                                    ? 'text-chart-1'
                                    : 'text-destructive'
                                }
                              >
                                {formatCurrency(
                                  calculateRealizationProfit(
                                    realization,
                                    trade
                                  ),
                                  tradeCurrency
                                )}
                              </span>
                            </div>

                          </div>

                        ) : isIgnored ? (

                          <Button
                            size="sm"
                            className="mt-2 w-full cursor-pointer"
                            onClick={() =>
                              handleRestoreTarget(target.level)
                            }
                          >
                            <BellRing className="mr-2 size-4" />
                            Restaurar Alerta
                          </Button>

                        ) : isReached && !isHit ? (

                          <div className="mt-2 flex gap-2">

                            <Button
                              size="sm"
                              className="flex-1 cursor-pointer"
                              onClick={() =>
                                handleRealize(target.level)
                              }
                            >
                              Realizar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() =>
                                handleDismissTarget(target.level)
                              }
                            >
                              <BellOff className="size-4" />
                            </Button>

                          </div>

                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      }

      {/* Stop Losses */}
      {
        trade.stopLosses && trade.stopLosses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="size-5" />
                Stop Loss
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {trade.stopLosses.map((stopLoss) => {
                  const saleValue =
                    stopLoss.price * stopLoss.quantity

                  const expectedProfit =
                    (stopLoss.price - trade.entryPrice) *
                    stopLoss.quantity

                  const isExecuted =
                    stopLoss.status === 'EXECUTADO'

                  const isClosed =
                    stopLoss.status === 'ENCERRADO'

                  const isActive =
                    stopLoss.status === 'ATIVO'

                  // PREÇO DO STOP LOSS FOI ATINGIDO
                  const stopLossTriggered =
                    currentPrice <= stopLoss.price

                  return (
                    <div
                      key={`stop-loss-${trade.id}-${stopLoss.targetLevel}`}
                      className={`rounded-lg border p-3 ${isExecuted || stopLossTriggered
                        ? 'border-destructive/50 bg-destructive/5'
                        : isClosed
                          ? 'border-muted-foreground/30 bg-muted/30'
                          : 'border-border bg-card'
                        }`}
                    >
                      {/* CABEÇALHO */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert
                            className={`size-4 ${isExecuted
                              ? 'text-destructive'
                              : isClosed
                                ? 'text-muted-foreground'
                                : 'text-chart-1'
                              }`}
                          />

                          <span className="font-medium">
                            T{stopLoss.targetLevel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* STATUS */}
                          <Badge
                            variant={
                              isExecuted
                                ? 'destructive'
                                : isClosed
                                  ? 'outline'
                                  : 'secondary'
                            }
                          >
                            {isExecuted
                              ? 'Executado'
                              : isClosed
                                ? 'Encerrado'
                                : 'Ativo'}
                          </Badge>

                          {/* EDITAR */}
                          {isActive && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 cursor-pointer"
                              onClick={() =>
                                handleOpenStopLoss(
                                  trade.id,
                                  stopLoss.targetLevel,
                                  {
                                    price: stopLoss.price,
                                    quantity: stopLoss.quantity,
                                  }
                                )
                              }
                            >
                              <Edit className="size-4" />
                            </Button>
                          )}

                          {/* EXCLUIR */}
                          {isActive && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 cursor-pointer text-destructive"
                              onClick={() => {
                                removeTargetStopLoss(
                                  trade.id,
                                  stopLoss.targetLevel
                                )

                                toast.success(
                                  'Stop Loss removido com sucesso!'
                                )
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* DADOS */}
                      <div className="mt-3 space-y-2 border-t pt-3 text-sm">

                        {/* PREÇO */}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Preço
                          </span>

                          <span
                            className={`font-medium ${currentPrice < stopLoss.price
                              ? 'text-destructive'
                              : ''
                              }`}
                          >
                            {formatCurrency(
                              stopLoss.price,
                              tradeCurrency
                            )}
                          </span>
                        </div>

                        {/* QUANTIDADE */}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Quantidade
                          </span>

                          <span className="font-medium">
                            {formatQuantity(
                              stopLoss.quantity
                            )}{' '}
                            {trade.coinSymbol}
                          </span>
                        </div>

                        {/* VALOR DA VENDA */}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Valor da venda
                          </span>

                          <span className="font-medium">
                            {formatCurrency(
                              saleValue,
                              tradeCurrency
                            )}
                          </span>
                        </div>

                        {/* LUCRO */}
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-muted-foreground">
                            {isExecuted
                              ? 'Lucro realizado'
                              : 'Lucro previsto'}
                          </span>

                          <span
                            className={`font-medium ${expectedProfit >= 0
                              ? 'text-chart-1'
                              : 'text-destructive'
                              }`}
                          >
                            {formatCurrency(
                              expectedProfit,
                              tradeCurrency
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      }

      <RebuyAlerts
        trades={trades}
        prices={prices}
        tradeId={trade.id}
        currency={tradeCurrency}
        onDismissRebuy={handleDismissRebuy}
        onRestoreRebuy={handleRestoreRebuy}
      />

      {/* Trade Info & History */}
      <div className="grid gap-6 lg:grid-cols-2">


        {/* Realizations History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="size-5" />
              Historico de Realizacoes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trade.realizations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  Nenhuma realizacao registrada
                </p>
              </div>
            ) : (
              trade.realizations.map((r) => {
                const profit = calculateRealizationProfit(r, trade)

                const ledger = getLedger()
                const ledgerEntry = ledger.find((l) => l.id === r.ledgerId)
                const usdValue = ledgerEntry?.amount ?? 0

                const rebuyTrade = trades.find(
                  (t) =>
                    t.type === 'RECOMPRA' &&
                    t.rebuySource?.tradeId === trade.id &&
                    t.rebuySource?.realizationId === r.id
                )

                const rebuyDismissed =
                  r.targetLevel > 0 &&
                  r.rebuyStatus === 'DISMISSED' &&
                  !rebuyTrade

                return (
                  <div
                    key={r.id}
                    className="rounded-lg border bg-card p-3"
                  >
                    {/* Linha 1 */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Data</div>
                        <div className="text-sm font-medium">
                          {format(new Date(r.date), 'dd/MM/yy')}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="mt-1 flex justify-center gap-2 p-2 text-sm">
                          {r.targetLevel > 0 ? (
                            <Badge variant="outline" className="text-sm">
                              T{r.targetLevel}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Manual
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="mt-1">
                          {(() => {
                            const rebuyTrade = trades.find(
                              (t) =>
                                t.type === 'RECOMPRA' &&
                                t.rebuySource?.tradeId === trade.id &&
                                t.rebuySource?.realizationId === r.id
                            )

                            const rebuyDismissed =
                              r.targetLevel > 0 &&
                              r.rebuyStatus === 'DISMISSED' &&
                              !rebuyTrade

                            return (
                              <>
                                {/* RECOMPRA JÁ REALIZADA */}
                                {rebuyTrade && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="mr-2 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground hover:text-orange-500"
                                    asChild
                                  >
                                    <Link href={`/trades/${rebuyTrade.id}`}>
                                      <Split className="size-4" />
                                    </Link>
                                  </Button>
                                )}

                                {/* REATIVAR OPORTUNIDADE DE RECOMPRA */}
                                {rebuyDismissed && (
                                  <Button
                                    type="button"
                                    className="mr-2 cursor-pointer px-2 text-xs"
                                    onClick={() => {
                                      restoreRebuyOpportunity(
                                        trade.id,
                                        r.id
                                      )

                                      toast.success(
                                        'Oportunidade de recompra reativada!'
                                      )
                                    }}
                                  >
                                    <BellRing className="size-4" />
                                  </Button>
                                )}

                                {/* EXCLUIR REALIZAÇÃO */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="icon"
                                      className="cursor-pointer bg-secondary text-white hover:bg-red-800"
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </AlertDialogTrigger>

                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Excluir realização?
                                      </AlertDialogTitle>

                                      <AlertDialogDescription>
                                        Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>

                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="cursor-pointer">
                                        Cancelar
                                      </AlertDialogCancel>

                                      <AlertDialogAction asChild>
                                        <Button
                                          variant="destructive"
                                          className="text-white cursor-pointer"
                                          onClick={() => {
                                            deleteRealization(
                                              trade.id,
                                              r.id
                                            )

                                            toast.success(
                                              'Realização excluída com sucesso!'
                                            )
                                          }}
                                        >
                                          Excluir Realização
                                        </Button>
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Linha 2 */}
                    <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Exit Price
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(r.exitPrice, tradeCurrency)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">
                          Qtd
                        </div>
                        <div className="text-sm font-medium">
                          {formatQuantity(r.quantity)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          USD Value
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(
                            Number(usdValue.toFixed(2)),
                            tradeCurrency
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lucro */}
                    <div className="mt-3 border-t pt-3">
                      <div className="text-xs text-muted-foreground">
                        Lucro
                      </div>
                      <div
                        className={`text-xl font-bold ${getColorClass(profit)}`}
                      >
                        {formatCurrency(
                          Number(profit.toFixed(2)),
                          tradeCurrency
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Trade Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Informacoes do Trade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de entrada</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {format(new Date(trade.entryDate), 'PPP', { locale: ptBR })}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preco de entrada</span>
                <span className="font-medium">{formatCurrency(trade.entryPrice, tradeCurrency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantidade inicial</span>
                <span className="font-medium">{formatQuantity(trade.quantity)} {trade.coinSymbol}</span>
              </div>

              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantidade restante</span>
                <span className="font-medium">{formatQuantity(trade.remainingQuantity)} {trade.coinSymbol}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isShort ? 'Valor vendido' : 'Total investido'}</span>
                <span className="font-medium">{formatCurrency(totalInvested, tradeCurrency)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fonte dos recursos</span>
                <Badge
                  variant="outline"
                  className={
                    isShort
                      ? 'border-chart-2 text-chart-2'
                      : trade.fundingSource === 'CASH'
                        ? 'border-chart-1 text-chart-1'
                        : 'border-chart-3 text-chart-3'
                  }
                >
                  {isShort ? 'Venda a Descoberto' : trade.fundingSource === 'CASH' ? 'Saldo em Caixa' : 'Novo Aporte'}
                </Badge>
              </div>
              <Separator />

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Notas
                  </span>

                  <Dialog
                    open={showNotesDialog}
                    onOpenChange={setShowNotesDialog}
                  >
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 cursor-pointer"
                        onClick={handleEditNotes}
                      >
                        <Edit className="size-4" />
                      </Button>
                    </DialogTrigger>

                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar notas</DialogTitle>
                        <DialogDescription>
                          Adicione ou altere uma observação sobre este trade.
                        </DialogDescription>
                      </DialogHeader>

                      <Textarea
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        placeholder="Digite uma observação..."
                        className="min-h-32"
                        autoFocus
                      />

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => setShowNotesDialog(false)}
                        >
                          Cancelar
                        </Button>

                        <Button
                          type="button"
                          className="cursor-pointer"
                          onClick={handleSaveNotes}
                        >
                          Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {trade.notes ? (
                  <p className="mt-1 rounded bg-muted p-2">
                    {trade.notes}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhuma nota adicionada.
                  </p>
                )}
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fees</span>
                <span className="font-medium text-destructive">{formatQuantity(trade.fee)} {trade.coinSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"></span>
                <span className="font-medium text-destructive">{formatCurrency(trade.fee * trade.entryPrice, tradeCurrency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Realization Form Dialog */}
      <Dialog
        open={showStopLossDialog}
        onOpenChange={setShowStopLossDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStopLoss
                ? 'Editar Stop Loss'
                : 'Criar Stop Loss'}
            </DialogTitle>

            <DialogDescription>
              Configure o preço e a quantidade que
              serão vendidos caso o Stop Loss seja
              atingido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Preço do Stop Loss
            </label>

            <CurrencyInput
              value={stopLossPrice}
              onChange={setStopLossPrice}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Quantidade a vender
            </label>

            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00000000"
              value={stopLossQuantity}
              onChange={(e) =>
                setStopLossQuantity(e.target.value)
              }
            />
          </div>

          {Number(
            stopLossPrice.replace(',', '.')
          ) > 0 &&
            Number(
              stopLossQuantity.replace(',', '.')
            ) > 0 && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">

                  <span className="text-muted-foreground">
                    Preço
                  </span>

                  <span className="text-right font-medium">
                    {formatCurrency(
                      Number(
                        stopLossPrice.replace(',', '.')
                      ),
                      tradeCurrency
                    )}
                  </span>

                  <span className="text-muted-foreground">
                    Quantidade
                  </span>

                  <span className="text-right font-medium">
                    {formatQuantity(
                      Number(
                        stopLossQuantity.replace(',', '.')
                      )
                    )}
                  </span>

                  <span className="text-muted-foreground">
                    Valor da venda
                  </span>

                  <span className="text-right font-medium">
                    {formatCurrency(
                      Number(
                        stopLossPrice.replace(',', '.')
                      ) *
                      Number(
                        stopLossQuantity.replace(',', '.')
                      ),
                      tradeCurrency
                    )}
                  </span>

                </div>
              </div>
            )}

          <DialogFooter>

            {stopLossPrice && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={handleRemoveStopLoss}
              >
                Remover Stop Loss
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setShowStopLossDialog(false)
              }
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handleSaveStopLoss}
              disabled={
                !stopLossPrice ||
                !stopLossQuantity ||
                Number(
                  stopLossPrice.replace(',', '.')
                ) <= 0 ||
                Number(
                  stopLossQuantity.replace(',', '.')
                ) <= 0
              }
            >
              Salvar Stop Loss
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RealizationForm
        trade={trade}
        targets={settings.targets}
        currentPrice={currentPrice}
        suggestedTargetLevel={suggestedTargetLevel}
        open={showRealizationForm}
        onOpenChange={setShowRealizationForm}
        currency={tradeCurrency}
        addRealization={addRealization}
      />
    </div >
  )
}
