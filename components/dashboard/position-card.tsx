import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CoinIdentity } from './coin-identity'
import { formatCurrency, formatPercentage, formatQuantity } from '@/lib/calculations'

interface PositionCardProps {
  position: {
    coinName?: string
    coinSymbol: string
    coinImage?: string
    roi: number
    count: number
    currentPrice: number
    avgEntryPrice: number
    quantity: number
    currentValue: number
    portfolioPercentage: number
  }
  currency: 'USD' | 'BRL'
}

export function PositionCard({ position, currency }: PositionCardProps) {
  const positive = position.roi >= 0
  return (
    <Card className="transition-colors hover:bg-accent/40">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <CoinIdentity name={position.coinName || position.coinSymbol} symbol={position.coinSymbol} image={position.coinImage} />
          <div className="flex items-center gap-2">
            {positive ? <ArrowUpRight className="size-4 text-chart-1" /> : <ArrowDownRight className="size-4 text-destructive" />}
            <span className={positive ? 'font-bold text-chart-1' : 'font-bold text-destructive'}>{formatPercentage(position.roi)}</span>
            <Badge variant={positive ? 'default' : 'destructive'}>{position.count}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col gap-3">
            <div><p>{formatCurrency(position.currentPrice, currency)}</p><p className="text-xs text-muted-foreground">Preço atual</p></div>
            <div><p>{formatCurrency(position.avgEntryPrice, currency)}</p><p className="text-xs text-muted-foreground">Preço médio</p></div>
          </div>
          <div className="flex flex-col gap-3 text-right">
            <div><p>{formatQuantity(position.quantity)} {position.coinSymbol}</p><p className="text-xs text-muted-foreground">Quantidade</p></div>
            <div><p className="font-medium">{formatCurrency(position.currentValue, currency)}</p><p className="text-xs text-muted-foreground">Valor</p></div>
          </div>
        </div>
        <div className="flex flex-col gap-1 border-t pt-3">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Portfólio</span><span>{formatPercentage(position.portfolioPercentage)}</span></div>
          <Progress value={position.portfolioPercentage} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  )
}
