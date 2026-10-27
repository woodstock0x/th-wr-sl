'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarIcon, Loader2, RefreshCcw } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { CoinSelector } from '@/components/trades/coin-selector'
import { CurrencyInput } from '@/components/currency-input'
import { CoinSearchResult, Trade } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'
import { useTrades } from '@/hooks/use-trades'
import { usePrices } from '@/hooks/use-prices'
import { useSettings } from '@/hooks/use-settings'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function TradeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings } = useSettings()

  const { trades, addTrade, isLoading: tradesLoading } = useTrades()

  const rebuy = searchParams.get('rebuy') === 'true'
  const tradeId = searchParams.get('tradeId')
  const realizationId = searchParams.get('realizationId')
  const realize = searchParams.get('realize') === 'true'
  const targetLevel = Number(searchParams.get('target'))

  const sourceTrade = (rebuy || realize) && tradeId
    ? trades.find((trade) => trade.id === tradeId)
    : undefined

  const sourceRealization = sourceTrade && realizationId
    ? sourceTrade.realizations.find(
      (realization) => realization.id === realizationId
    )
    : undefined

  const priceCoinIds = useMemo(
    () => (sourceTrade ? [sourceTrade.coinId] : []),
    [sourceTrade?.coinId]
  )

  const { prices, isLoading: pricesLoading } = usePrices(priceCoinIds)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCoin, setSelectedCoin] = useState<CoinSearchResult | null>(null)
  const [type, setType] = useState<'COMPRA' | 'RECOMPRA' | 'VENDA'>(
    rebuy ? 'RECOMPRA' : 'COMPRA'
  )
  const [fundingSource, setFundingSource] = useState<'EXTERNAL' | 'CASH'>(
    rebuy ? 'CASH' : 'EXTERNAL'
  )
  const [priceCurrency, setPriceCurrency] = useState<'USD' | 'BRL'>('USD')
  const [entryPrice, setEntryPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState<Date>(new Date())
  const [notes, setNotes] = useState('')

  const sourceTradeCurrency = sourceTrade ? sourceTrade.currency || settings.currency : settings.currency
  const currentPrice = sourceTrade
    ? prices[sourceTrade.coinId]?.[sourceTradeCurrency.toLowerCase() as 'usd' | 'brl']
    : undefined

  // Parte do padrão global (Configurações → Moeda de Exibição) assim que
  // carrega, mas sem travar o usuário nele — dá pra trocar manualmente no
  // formulário (ex: um trade cujo preço só faz sentido numa moeda
  // específica, independente do que estiver selecionado globalmente).
  useEffect(() => {
    setPriceCurrency(settings.currency)
  }, [settings.currency])

  useEffect(() => {
    if (!rebuy || !sourceTrade || !sourceRealization || !currentPrice) {
      return
    }

    const realizationValue =
      sourceRealization.exitPrice * sourceRealization.quantity

    const suggestedQuantity = realizationValue / currentPrice

    setEntryPrice(currentPrice.toString())
    setQuantity(suggestedQuantity.toString())
    setType('RECOMPRA')
    setFundingSource('CASH')
    setPriceCurrency(sourceTradeCurrency)

    setSelectedCoin({
      id: sourceTrade.coinId,
      symbol: sourceTrade.coinSymbol,
      name: sourceTrade.coinName,
      thumb: sourceTrade.coinImage || '',
      large: sourceTrade.coinImage || '',
    })
  }, [
    rebuy,
    sourceTrade,
    sourceRealization,
    currentPrice,
    sourceTradeCurrency,
  ])

  useEffect(() => {
    if (!realize || !sourceTrade || !currentPrice) {
      return
    }

    setEntryPrice(currentPrice.toString())
    setPriceCurrency(sourceTradeCurrency)

    setSelectedCoin({
      id: sourceTrade.coinId,
      symbol: sourceTrade.coinSymbol,
      name: sourceTrade.coinName,
      thumb: sourceTrade.coinImage || '',
      large: sourceTrade.coinImage || '',
    })
  }, [
    realize,
    sourceTrade,
    currentPrice,
    sourceTradeCurrency,
  ])

  useEffect(() => {
    if (!rebuy || tradesLoading) return

    if (!tradeId || !realizationId) {
      toast.error('Dados da recompra inválidos')
      router.replace('/trades/new')
      return
    }

    if (!sourceTrade) {
      toast.error('Trade de origem não encontrado')
      router.replace('/trades/new')
      return
    }

    if (!sourceRealization) {
      toast.error('Realização de origem não encontrada')
      router.replace('/trades/new')
      return
    }
  }, [
    rebuy,
    tradesLoading,
    tradeId,
    realizationId,
    sourceTrade,
    sourceRealization,
    trades,
    router,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCoin) {
      toast.error('Selecione uma moeda')
      return
    }

    if (!entryPrice || parseFloat(entryPrice) <= 0) {
      toast.error('Informe um preco de entrada valido')
      return
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Informe uma quantidade valida')
      return
    }

    if (rebuy && (!sourceTrade || !sourceRealization)) {
      toast.error('Origem da recompra inválida')
      return
    }

    // NOVO
    if (rebuy && realizationId) {
      const alreadyRebought = trades.some(
        (trade) =>
          trade.type === 'RECOMPRA' &&
          trade.rebuySource?.realizationId === realizationId
      )

      if (alreadyRebought) {
        toast.error('Esta realização já possui uma recompra')
        return
      }
    }

    setIsSubmitting(true)

    try {
      addTrade({
        coinId: selectedCoin.id,
        coinSymbol: selectedCoin.symbol.toUpperCase(),
        coinName: selectedCoin.name,
        coinImage: selectedCoin.thumb,

        type: rebuy ? 'RECOMPRA' : type,

        fundingSource: rebuy ? 'CASH' : type === 'VENDA' ? undefined : fundingSource,

        currency: rebuy ? sourceTradeCurrency : priceCurrency,

        entryPrice: parseFloat(entryPrice),
        quantity: parseFloat(quantity),
        fee: fee ? parseFloat(fee) : 0,

        entryDate: date.toISOString(),
        notes: notes || undefined,

        ...(rebuy &&
          sourceTrade &&
          sourceRealization && {
          rebuySource: {
            tradeId: sourceTrade.id,
            realizationId: sourceRealization.id,
            targetLevel: sourceRealization.targetLevel,
          },
        }),
      }, prices)

      toast.success(
        rebuy
          ? 'Recompra realizada com sucesso!'
          : 'Trade adicionado com sucesso!'
      )

      router.push('/')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao adicionar trade'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const parsedQuantity = quantity ? parseFloat(quantity) : 0
  const parsedFee = fee ? parseFloat(fee) : 0
  const parsedPrice = entryPrice ? parseFloat(entryPrice) : 0

  const netQuantity = parsedQuantity - parsedFee

  const totalValue = (parsedPrice * parsedQuantity).toFixed(2)
  const feeValue = (parsedPrice * parsedFee).toFixed(2)

  const isRebuyLoading =
    rebuy &&
    (!sourceTrade ||
      !sourceRealization ||
      pricesLoading ||
      !currentPrice)

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {rebuy && <RefreshCcw className="size-5" />}
            {rebuy ? 'Nova Recompra' : 'Informacoes do Trade'}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <FieldGroup className="gap-6">

            {rebuy && sourceRealization && (
              <div className="rounded-lg border border-chart-1/30 bg-chart-1/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <RefreshCcw className="size-4 text-chart-1" />

                  <span className="font-semibold text-chart-1">
                    Recompra do T{sourceRealization.targetLevel}
                  </span>
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">
                      Realizado em
                    </span>

                    <div className="font-medium">
                      {formatCurrency(sourceRealization.exitPrice, sourceTradeCurrency)}
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground">
                      Queda de gatilho
                    </span>

              <div className="font-medium">
                1%
              </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground">
                      Valor a reutilizar
                    </span>

                    <div className="font-medium">
                      {formatCurrency(
                        sourceRealization.exitPrice * sourceRealization.quantity,
                        sourceTradeCurrency
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Field>
              <FieldLabel>Moeda</FieldLabel>

              <CoinSelector
                value={selectedCoin}
                onChange={setSelectedCoin}
                disabled={isSubmitting || rebuy}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-3">

              <Field>
                <FieldLabel>Tipo de Operacao</FieldLabel>

                <Select
                  value={type}
                  onValueChange={(v) =>
                    setType(v as 'COMPRA' | 'RECOMPRA' | 'VENDA')
                  }
                  disabled={isSubmitting || rebuy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="COMPRA">
                      Compra
                    </SelectItem>

                    <SelectItem value="RECOMPRA">
                      Recompra
                    </SelectItem>

                    <SelectItem value="VENDA">
                      Venda (a descoberto)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {type === 'VENDA' ? (
                <Field>
                  <FieldLabel>Fonte</FieldLabel>

                  <div className="flex h-9 items-center text-sm text-muted-foreground">
                    Gera saldo em caixa
                  </div>
                </Field>
              ) : (
                <Field>
                  <FieldLabel>Fonte</FieldLabel>

                  <Select
                    value={fundingSource}
                    onValueChange={(v) =>
                      setFundingSource(v as 'CASH' | 'EXTERNAL')
                    }
                    disabled={isSubmitting || rebuy}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="EXTERNAL">
                        NOVO Aporte
                      </SelectItem>

                      <SelectItem value="CASH">
                        LEDGER Cash Balance
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field>
                <FieldLabel>Data da Operacao</FieldLabel>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                      disabled={isSubmitting}
                    >
                      <CalendarIcon className="mr-2 size-4" />

                      {date
                        ? format(date, 'PPP', { locale: ptBR })
                        : 'Selecione uma data'}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-auto p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">

              <Field>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel>
                    {realize || type === 'VENDA' ? 'Preço de Venda' : 'Preço de Entrada'}
                  </FieldLabel>

                  <Select
                    value={priceCurrency}
                    onValueChange={(v) => setPriceCurrency(v as 'USD' | 'BRL')}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger size="sm" className="h-6 w-auto gap-1 border-0 bg-transparent px-1 text-xs text-muted-foreground shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="BRL">BRL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <CurrencyInput
                  value={entryPrice}
                  onChange={setEntryPrice}
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel>Quantidade</FieldLabel>

                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00000000"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value)
                  }
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <FieldLabel>
                  Taxa ({selectedCoin?.symbol.toUpperCase() || 'moeda'})
                </FieldLabel>

                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00000000"
                  value={fee}
                  onChange={(e) =>
                    setFee(e.target.value)
                  }
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Valor Total
                </span>

                <span className="text-lg font-semibold">
                  {formatCurrency(Number(totalValue), priceCurrency)}
                </span>
              </div>

              {parsedFee > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Taxa
                    </span>

                    <span className="text-destructive">
                      -{formatCurrency(Number(feeValue), priceCurrency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm text-muted-foreground">
                      Saldo Liquido
                    </span>

                    <div className="text-right">
                      <span className="text-xl font-bold">
                        {netQuantity.toFixed(8)}{' '}
                        {selectedCoin?.symbol.toUpperCase() || ''}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <Field>
              <FieldLabel>
                Notas (opcional)
              </FieldLabel>

              <Textarea
                placeholder="Adicione observacoes sobre este trade..."
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                disabled={isSubmitting}
                rows={3}
              />
            </Field>

          </FieldGroup>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-4">

        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="cursor-pointer"
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          disabled={isSubmitting || isRebuyLoading}
          className="cursor-pointer"
        >
          {isSubmitting && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}

          {isRebuyLoading && !isSubmitting && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}

          {rebuy ? 'Confirmar Recompra' : 'Adicionar Trade'}
        </Button>

      </div>
    </form>
  )
}
