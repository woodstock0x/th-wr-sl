import { Suspense } from 'react'
import { TradeForm } from '@/components/trades/trade-form'

function TradeFormFallback() {
  return (
    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
      Carregando formulário...
    </div>
  )
}

export default function NewTradePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Novo Trade</h1>
        <p className="text-muted-foreground">
          Adicione um novo trade ao seu portfolio
        </p>
      </div>

      <Suspense fallback={<TradeFormFallback />}>
        <TradeForm />
      </Suspense>
    </div>
  )
}
