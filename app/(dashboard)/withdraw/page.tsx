import { WithdrawForm } from '@/components/withdraw/withdraw-form'

export default function NewTradePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Withdraw</h1>
        <p className="text-muted-foreground">
          Withdraw funds to your bank, crypto wallet, or exchange
        </p>
      </div>

      <WithdrawForm />
    </div>
  )
}
