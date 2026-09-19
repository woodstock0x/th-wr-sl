'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  TrendingUp,
  BellRing,
  CheckCheck,
  Eye,
  BellOff,
  ShieldAlert,
} from 'lucide-react'

import { Input } from '@/components/ui/input'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import {
  Trade,
  TargetConfig,
  CoinGeckoPrice,
} from '@/lib/types'

import {
  getTargetStatus,
  formatPercentage,
  calculateSellQuantity,
  formatCurrency,
} from '@/lib/calculations'

interface TargetAlertsProps {
  trades: Trade[]
  prices: CoinGeckoPrice
  targets: TargetConfig[]
  currency: 'USD' | 'BRL'

  onDismissTarget: (
    tradeId: string,
    targetLevel: number
  ) => void

  onRestoreTarget: (
    tradeId: string,
    targetLevel: number
  ) => void

  setTargetStopLoss: (
    tradeId: string,
    targetLevel: number,
    price: number,
    quantity: number
  ) => void

  removeTargetStopLoss: (
    tradeId: string,
    targetLevel: number
  ) => void
}

interface TargetAlert {
  trade: Trade
  targetLevel: number
  currentROI: number
  targetPercentage: number
  sellQuantity: number
  sellPercentage: number
  currentPrice: number
  realizationValue: number
  expectedProfit: number
}

export function TargetAlerts({
  trades,
  prices,
  targets,
  currency,
  onDismissTarget,
  onRestoreTarget,
  setTargetStopLoss,
  removeTargetStopLoss,
}: TargetAlertsProps) {
  const currencyKey = currency.toLowerCase() as 'usd' | 'brl'

  const alerts: TargetAlert[] = []
  const ignoredAlerts: TargetAlert[] = []

  // --------------------------------------------------
  // STOP LOSS
  // --------------------------------------------------

  const [showStopLossDialog, setShowStopLossDialog] =
    useState(false)

  const [stopLossPrice, setStopLossPrice] =
    useState('')

  const [stopLossQuantity, setStopLossQuantity] =
    useState('')

  const [selectedStopLoss, setSelectedStopLoss] =
    useState<{
      tradeId: string
      targetLevel: number
      entryPrice: number
    } | null>(null)

  // --------------------------------------------------
  // ABRIR DIALOG STOP LOSS
  // --------------------------------------------------

  const handleOpenStopLoss = (
    tradeId: string,
    targetLevel: number,
    currentStopLoss?: {
      price: number
      quantity: number
    }
  ) => {
    const trade = trades.find(
      (t) => t.id === tradeId
    )

    if (!trade) return

    setSelectedStopLoss({
      tradeId,
      targetLevel,
      entryPrice: trade.entryPrice,
    })

    setStopLossPrice(
      currentStopLoss?.price !== undefined
        ? currentStopLoss.price.toString()
        : ''
    )

    setStopLossQuantity(
      currentStopLoss?.quantity !== undefined
        ? currentStopLoss.quantity.toString()
        : ''
    )

    setShowStopLossDialog(true)
  }

  const handleCloseStopLossDialog = () => {
    setShowStopLossDialog(false)
    setSelectedStopLoss(null)
    setStopLossPrice('')
    setStopLossQuantity('')
  }

  const handleSaveStopLoss = () => {
    if (!selectedStopLoss) return

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
      return
    }

    setTargetStopLoss(
      selectedStopLoss.tradeId,
      selectedStopLoss.targetLevel,
      price,
      quantity
    )

    handleCloseStopLossDialog()
  }

  const handleRemoveStopLoss = () => {
    if (!selectedStopLoss) return

    removeTargetStopLoss(
      selectedStopLoss.tradeId,
      selectedStopLoss.targetLevel
    )

    handleCloseStopLossDialog()
  }

  for (const trade of trades) {
    if (trade.status !== 'ATIVO') continue

    const currentPrice =
      prices[trade.coinId]?.[currencyKey] ||
      trade.entryPrice

    if (!currentPrice || currentPrice <= 0) continue

    const {
      targetsReached,
      currentROI,
    } = getTargetStatus(
      trade.entryPrice,
      currentPrice,
      targets,
      trade.targetsHit
    )

    for (const targetLevel of targetsReached) {
      const target = targets.find(
        (t) => t.level === targetLevel
      )

      if (!target) continue

      const isLastTarget =
        targetLevel === targets.length

      const sellQuantity = calculateSellQuantity(
        trade.remainingQuantity,
        target.sellPercentage,
        isLastTarget
      )

      if (!sellQuantity || sellQuantity <= 0) continue

      const realizationValue =
        currentPrice * sellQuantity

      const expectedProfit =
        (currentPrice - trade.entryPrice) *
        sellQuantity

      const alert: TargetAlert = {
        trade,
        targetLevel,
        currentROI,
        targetPercentage: target.percentage,
        sellQuantity,
        sellPercentage: target.sellPercentage,
        currentPrice,
        realizationValue,
        expectedProfit,
      }

      if (
        trade.targetsIgnored?.includes(
          targetLevel
        )
      ) {
        ignoredAlerts.push(alert)
      } else {
        alerts.push(alert)
      }
    }

    // STOP LOSSES ATIVOS
    for (const stopLoss of trade.stopLosses ?? []) {
      if (stopLoss.status !== 'ATIVO') continue

      const alreadyExists = alerts.some(
        (alert) =>
          alert.trade.id === trade.id &&
          alert.targetLevel === stopLoss.targetLevel
      )

      const alreadyIgnored = ignoredAlerts.some(
        (alert) =>
          alert.trade.id === trade.id &&
          alert.targetLevel === stopLoss.targetLevel
      )

      if (alreadyExists || alreadyIgnored) continue

      const target = targets.find(
        (target) => target.level === stopLoss.targetLevel
      )

      if (!target) continue

      const alert: TargetAlert = {
        trade,
        targetLevel: stopLoss.targetLevel,
        currentROI,
        targetPercentage: target.percentage,
        sellQuantity: 0,
        sellPercentage: target.sellPercentage,
        currentPrice,
        realizationValue: 0,
        expectedProfit: 0,
      }

      // Target ignorado, mas possui Stop Loss ativo:
      // mantém o alerta na seção "Ignorados"
      if (
        trade.targetsIgnored?.includes(
          stopLoss.targetLevel
        )
      ) {
        ignoredAlerts.push(alert)
      } else {
        alerts.push(alert)
      }
    }

  }

  if (
    alerts.length === 0 &&
    ignoredAlerts.length === 0
  ) {
    return null
  }

  const renderTargetCard = (
    alert: TargetAlert,
    index: number
  ) => {
    const stopLoss =
      alert.trade.stopLosses?.find(
        (stop) =>
          stop.targetLevel ===
          alert.targetLevel
      )

    const stopLossTriggered =
      !!stopLoss &&
      alert.currentPrice <= stopLoss.price

    const stopLossSaleValue =
      stopLoss
        ? stopLoss.price * stopLoss.quantity
        : 0

    const stopLossExpectedProfit =
      stopLoss
        ? (
          stopLoss.price -
          alert.trade.entryPrice
        ) * stopLoss.quantity
        : 0


    return (
      <div
        key={`${alert.trade.id}-${alert.targetLevel}-${index}`}
        className={`roun ded-lg border bg-background p-3 ${stopLossTriggered
          ? 'border-destructive'
          : 'border-chart-3/30'
          } rounded-lg`}
      >

        <div className="grid grid-cols-[48px_1fr] gap-x-4">

          {/* IMAGEM */}

          <div className="row-span-2 flex items-center justify-center">
            <div className="flex size-10 items-center justify-center rounded-full border border-chart-3/50 bg-chart-3/10">

              {alert.trade.coinImage ? (
                <img
                  src={alert.trade.coinImage}
                  alt={alert.trade.coinSymbol}
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-chart-3">
                  {alert.trade.coinSymbol.slice(0, 2)}
                </span>
              )}

            </div>
          </div>

          {/* LINHA 1 */}

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

            <div className="flex shrink-0 items-center gap-1">

              {/* STOP LOSS */}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`h-7 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground ${stopLossTriggered
                  ? 'hover:text-destructive'
                  : stopLoss
                    ? 'hover:text-chart-1'
                    : 'hover:text-destructive'
                  }`}
                onClick={() =>
                  handleOpenStopLoss(
                    alert.trade.id,
                    alert.targetLevel,
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

              {/* REALIZAR */}

              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground hover:text-chart-3"
              >
                <Link
                  href={`/trades/${alert.trade.id}?realize=true&target=${alert.targetLevel}`}
                >
                  <CheckCheck className="size-4" />
                </Link>
              </Button>

              {/* IGNORAR */}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground hover:text-destructive"
                onClick={() =>
                  onDismissTarget(
                    alert.trade.id,
                    alert.targetLevel
                  )
                }
              >
                <BellOff className="size-4" />
              </Button>

            </div>
          </div>

          {/* LINHA 2 */}

          <div className="mt-1 flex items-center gap-3">

            <div className="flex items-center gap-1 text-sm">

              <TrendingUp className="size-3 text-chart-1" />

              <span className="font-medium text-chart-1">
                {formatPercentage(
                  alert.currentROI
                )}
              </span>

            </div>

          </div>

        </div>

        {stopLoss && (
          <div className="mt-2 flex flex-col items-center gap-1 text-xs">

            <div className="flex flex-wrap items-center justify-center gap-2">

              <ShieldAlert
                className={`size-3 ${stopLossTriggered
                  ? 'text-destructive'
                  : 'text-chart-1'
                  }`}
              />

              <span className="text-muted-foreground">
                Stop Loss
              </span>

              <span
                className={`font-medium ${stopLossTriggered
                  ? 'text-destructive'
                  : 'text-chart-1'
                  }`}
              >
                {formatCurrency(
                  stopLoss.price,
                  currency
                )}
              </span>

              <span className="">
                ×{stopLoss.quantity}
              </span>

              <span className="text-muted-foreground">
                =
              </span>

              <span className="font-medium text-chart-1">
                {formatCurrency(
                  stopLossSaleValue,
                  currency
                )}
              </span>

            </div>

            {/* STATUS */}
            {/*
            {stopLossTriggered && (
              <span className="font-semibold text-destructive">
                STOP LOSS ATINGIDO
              </span>
            )}
            */}

            {/* LUCRO PREVISTO */}

            <div className="text-muted-foreground">

              Lucro previsto:{' '}

              <span
                className={
                  stopLossExpectedProfit >= 0
                    ? 'font-medium text-chart-1'
                    : 'font-medium text-destructive'
                }
              >
                {formatCurrency(
                  stopLossExpectedProfit,
                  currency
                )}
              </span>

            </div>

          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3">

          {/* LUCRO PREVISTO */}

          <div className="text-xs text-muted-foreground">

            <div>
              Lucro previsto
            </div>

            <div
              className={`mt-0.5 font-medium ${alert.expectedProfit >= 0
                ? 'text-chart-1'
                : 'text-destructive'
                }`}
            >
              {formatCurrency(
                alert.expectedProfit,
                currency
              )}
            </div>

          </div>

          {/* REALIZAÇÃO */}

          <div className="text-xs text-muted-foreground">

            <div>
              Realização
            </div>

            <div className="mt-0.5 font-medium text-foreground">
              {formatCurrency(
                alert.realizationValue,
                currency
              )}
            </div>

          </div>

        </div>

      </div>
    )
  }

  const ignoredAlertsWithStopLoss = ignoredAlerts.filter(
    (alert) =>
      alert.trade.stopLosses?.some(
        (stop) =>
          stop.targetLevel === alert.targetLevel
      )
  )

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <>
      {(alerts.length > 0 || ignoredAlertsWithStopLoss.length > 0) && (
        <Card className="border-chart-3/50 bg-chart-3/5">

          {/* ================================================== */}
          {/* CABEÇALHO */}
          {/* ================================================== */}

          <CardHeader className="flex flex-row items-center justify-between pb-2">

            <div className="flex items-center gap-2">

              <Bell className="size-5 text-chart-3" />

              <CardTitle className="text-chart-3">
                Alertas de Target
              </CardTitle>

            </div>

            <Badge className="bg-chart-3 text-background">
              {alerts.length}
            </Badge>

          </CardHeader>

          <CardContent>

            {/* ================================================== */}
            {/* ALERTAS ATIVOS */}
            {/* ================================================== */}

            {alerts.length > 0 && (
              <div
                className={`grid gap-4 md:grid-cols-2 ${alerts.length === 1
                  ? 'lg:grid-cols-1'
                  : alerts.length === 2
                    ? 'lg:grid-cols-2'
                    : 'lg:grid-cols-3'
                  }`}
              >

                {alerts.map(
                  (alert, index) =>
                    renderTargetCard(
                      alert,
                      index
                    )
                )}

              </div>
            )}

            {/* ================================================== */}
            {/* TARGETS IGNORADOS */}
            {/* ================================================== */}

            {ignoredAlerts.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">

                <div className="mb-3 flex items-center gap-2">

                  <span className="text-sm font-semibold text-muted-foreground">
                    Targets Ignorados
                  </span>

                  <Badge variant="secondary">
                    {ignoredAlerts.length}
                  </Badge>

                </div>

                <div
                  className={`grid gap-3 md:grid-cols-2 ${ignoredAlerts.length === 1
                    ? 'lg:grid-cols-1'
                    : ignoredAlerts.length === 2
                      ? 'lg:grid-cols-2'
                      : 'lg:grid-cols-3'
                    }`}
                >

                  {ignoredAlerts.map(
                    (alert) => {

                      const stopLoss =
                        alert.trade.stopLosses?.find(
                          (stop) =>
                            stop.targetLevel ===
                            alert.targetLevel
                        )

                      const stopLossTriggered =
                        !!stopLoss &&
                        alert.currentPrice <=
                        stopLoss.price

                      const stopLossSaleValue =
                        stopLoss
                          ? stopLoss.price *
                          stopLoss.quantity
                          : 0

                      const stopLossExpectedProfit =
                        stopLoss
                          ? (
                            stopLoss.price -
                            alert.trade.entryPrice
                          ) *
                          stopLoss.quantity
                          : 0

                      return (
                        <div
                          key={`${alert.trade.id}-${alert.targetLevel}`}
                          className={`rounded-lg border px-3 py-2 ${stopLossTriggered
                            ? 'border-destructive bg-destructive/5'
                            : 'border-border bg-muted/20'
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

                            {/* AÇÕES — ALINHADAS À DIREITA */}
                            <div className="flex items-center gap-1">
                              {/* STOP LOSS */}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className={`h-7 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground ${stopLossTriggered
                                  ? 'hover:text-destructive'
                                  : stopLoss
                                    ? 'hover:text-chart-1'
                                    : 'hover:text-destructive'
                                  }`}
                                onClick={() =>
                                  handleOpenStopLoss(
                                    alert.trade.id,
                                    alert.targetLevel,
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

                              {/* RESTAURAR */}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 cursor-pointer bg-secondary px-2 text-xs text-secondary-foreground hover:text-chart-1"
                                onClick={() =>
                                  onRestoreTarget(
                                    alert.trade.id,
                                    alert.targetLevel
                                  )
                                }
                              >
                                <BellRing className="size-4" />
                              </Button>

                            </div>

                          </div>

                          {/* STOP LOSS */}
                          {stopLoss && (
                            <div className="mt-2 flex flex-col items-center gap-1 text-xs">

                              <div className="flex flex-wrap items-center justify-center gap-2">

                                <ShieldAlert
                                  className={`size-3 ${stopLossTriggered
                                    ? 'text-destructive'
                                    : 'text-chart-1'
                                    }`}
                                />

                                <span className="text-muted-foreground">
                                  Stop Loss
                                </span>

                                <span
                                  className={`font-medium ${stopLossTriggered
                                    ? 'text-destructive'
                                    : 'text-chart-1'
                                    }`}
                                >
                                  {formatCurrency(
                                    stopLoss.price,
                                    currency
                                  )}
                                </span>

                                <span>
                                  ×{stopLoss.quantity}
                                </span>

                                <span className="text-muted-foreground">
                                  =
                                </span>

                                <span className="font-medium text-chart-1">
                                  {formatCurrency(
                                    stopLossSaleValue,
                                    currency
                                  )}
                                </span>

                              </div>

                              {/*
                              {stopLossTriggered && (
                                <span className="font-semibold text-destructive">
                                  STOP LOSS ATINGIDO
                                </span>
                              )}
                              */}

                              <div className="text-muted-foreground">

                                Lucro previsto:{' '}

                                <span
                                  className={
                                    stopLossExpectedProfit >= 0
                                      ? 'font-medium text-chart-1'
                                      : 'font-medium text-destructive'
                                  }
                                >
                                  {formatCurrency(
                                    stopLossExpectedProfit,
                                    currency
                                  )}
                                </span>

                              </div>

                            </div>
                          )}

                          {/* DADOS */}

                          <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs">

                            <div className="text-muted-foreground">
                              Lucro previsto
                            </div>

                            <div
                              className={`text-right font-medium ${alert.expectedProfit >= 0
                                ? 'text-chart-1'
                                : 'text-destructive'
                                }`}
                            >
                              {formatCurrency(
                                alert.expectedProfit,
                                currency
                              )}
                            </div>

                            <div className="text-muted-foreground">
                              Realização
                            </div>

                            <div className="text-right font-medium text-foreground">
                              {formatCurrency(
                                alert.realizationValue,
                                currency
                              )}
                            </div>

                          </div>

                        </div>
                      )
                    }
                  )}

                </div>
              </div>
            )}

          </CardContent>

        </Card>
      )}

      {/* ================================================== */}
      {/* STOP LOSS DIALOG */}
      {/* ================================================== */}

      <Dialog
        open={showStopLossDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseStopLossDialog()
          }
        }}
      >

        <DialogContent>

          <DialogHeader>

            <DialogTitle>
              {stopLossPrice
                ? 'Editar Stop Loss'
                : 'Criar Stop Loss'}
            </DialogTitle>

            <DialogDescription>
              Configure o preço e a quantidade que
              serão vendidos caso o Stop Loss seja
              atingido.
            </DialogDescription>

          </DialogHeader>

          {/* PREÇO */}

          <div className="space-y-2">

            <label className="text-sm font-medium">
              Preço do Stop Loss
            </label>

            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={stopLossPrice}
              onChange={(e) =>
                setStopLossPrice(e.target.value)
              }
              autoFocus
            />

          </div>

          {/* QUANTIDADE */}

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

          {/* RESUMO */}

          {Number(stopLossPrice.replace(',', '.')) > 0 &&
            Number(stopLossQuantity.replace(',', '.')) > 0 && (

              <div className="rounded-md border bg-muted/30 p-3 text-sm">

                <div className="grid grid-cols-2 gap-x-4 gap-y-1">

                  {/* PREÇO */}

                  <span className="text-muted-foreground">
                    Preço
                  </span>

                  <span className="text-right font-medium">
                    {formatCurrency(
                      Number(
                        stopLossPrice.replace(',', '.')
                      ),
                      currency
                    )}
                  </span>

                  {/* QUANTIDADE */}

                  <span className="text-muted-foreground">
                    Quantidade
                  </span>

                  <span className="text-right font-medium">
                    {Number(
                      stopLossQuantity.replace(',', '.')
                    )}
                  </span>

                  {/* VALOR DA VENDA */}

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
                      currency
                    )}
                  </span>

                  {/* LUCRO PREVISTO */}

                  <span className="text-muted-foreground">
                    Lucro previsto
                  </span>

                  <span
                    className={`text-right font-medium ${(
                      Number(
                        stopLossPrice.replace(',', '.')
                      ) -
                      (selectedStopLoss?.entryPrice ?? 0)
                    ) *
                      Number(
                        stopLossQuantity.replace(',', '.')
                      ) >= 0
                      ? 'text-chart-1'
                      : 'text-destructive'
                      }`}
                  >
                    {formatCurrency(
                      (
                        Number(
                          stopLossPrice.replace(',', '.')
                        ) -
                        (selectedStopLoss?.entryPrice ?? 0)
                      ) *
                      Number(
                        stopLossQuantity.replace(',', '.')
                      ),
                      currency
                    )}
                  </span>

                </div>

              </div>
            )}

          {/* FOOTER */}

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
              onClick={handleCloseStopLossDialog}
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
    </>
  )
}