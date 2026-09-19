'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarIcon, Loader2, Trash2 } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/calculations'
import { deleteLedgerEntry, getLedger, saveLedgerEntry } from '@/lib/ledger'
import { getSettings } from '@/lib/storage'
import type { LedgerEntry } from '@/lib/types'

const methodLabels: Record<string, string> = {
  BANK: 'PIX',
  EXCHANGE: 'Exchange',
  WALLET: 'Wallet',
}

export function WithdrawForm() {
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ledger, setLedger] = useState<LedgerEntry[]>(() => getLedger())
  const currency = getSettings().currency

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'BANK' | 'EXCHANGE' | 'WALLET'>('BANK')
  const [date, setDate] = useState<Date>(new Date())
  const [note, setNote] = useState('')

  const withdrawals = useMemo(
    () => ledger
      .filter((entry) => entry.type === 'WITHDRAW')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [ledger]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const parsedAmount = parseFloat(amount)

    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Informe um valor válido')
      return
    }

    setIsSubmitting(true)

    try {
      const entry: LedgerEntry = {
        id: crypto.randomUUID(),
        type: 'WITHDRAW',
        amount: -Math.abs(parsedAmount),
        tradeId: null,
        date: date.toISOString(),
        metadata: {
          method,
          note: note || undefined,
        },
      }

      saveLedgerEntry(entry)
      setLedger(getLedger())
      setAmount('')
      setNote('')
      toast.success('Withdraw registrado com sucesso!')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao registrar withdraw')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (entry: LedgerEntry) => {
    deleteLedgerEntry(entry.id)
    setLedger(getLedger())
    toast.success('Withdraw excluído. O valor voltou para o caixa.')
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Withdraw</CardTitle>
          </CardHeader>

          <CardContent>
            <FieldGroup className="gap-6">
              <Field>
                <FieldLabel>Valor</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSubmitting}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Método</FieldLabel>
                  <Select
                    value={method}
                    onValueChange={(value) => setMethod(value as typeof method)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANK">PIX</SelectItem>
                      <SelectItem value="EXCHANGE">Exchange</SelectItem>
                      <SelectItem value="WALLET">Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Data</FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !date && 'text-muted-foreground'
                        )}
                        disabled={isSubmitting}
                      >
                        <CalendarIcon data-icon="inline-start" />
                        {date ? format(date, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(selectedDate) => selectedDate && setDate(selectedDate)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
              </div>

              <Field>
                <FieldLabel>Observação (opcional)</FieldLabel>
                <Textarea
                  placeholder="Ex: retirada de lucro parcial"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                />
              </Field>

              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="text-lg font-semibold">
                    -{formatCurrency(amount ? parseFloat(amount) : 0, currency)}
                  </span>
                </div>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Registrar Withdraw
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de withdraws</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum withdraw registrado.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {withdrawals.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{formatCurrency(Math.abs(entry.amount), currency)}</span>
                      <span className="text-sm text-muted-foreground">
                        {methodLabels[entry.metadata?.method ?? ''] ?? 'Não informado'}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(entry.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {entry.metadata?.note && (
                      <span className="text-sm text-muted-foreground">{entry.metadata.note}</span>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        className="cursor-pointer bg-destructive text-white hover:bg-red-800"
                        aria-label={`Excluir withdraw de ${formatCurrency(Math.abs(entry.amount), currency)}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir withdraw?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acao nao pode ser desfeita. O withdraw será excluído permanentemente e o valor retornará ao caixa.
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
                            onClick={() => handleDelete(entry)}
                          >
                            Excluir Withdraw
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
