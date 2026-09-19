'use client'

import { LayoutDashboard, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PositionCard } from './position-card'
import { Trade, CoinGeckoPrice } from '@/lib/types'
import { calculateConsolidatedPositions } from '@/lib/calculations'

interface Props {
  trades: Trade[]
  prices: CoinGeckoPrice
  currency: 'USD' | 'BRL'
}

export function ConsolidatedPositions({ trades, prices, currency }: Props) {
  const positions = useMemo(() => calculateConsolidatedPositions(trades, prices, currency), [trades, prices, currency])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2"><LayoutDashboard className="size-5" /><CardTitle>Posições Consolidadas</CardTitle></div>
        <Badge variant="secondary">{positions.length}</Badge>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center"><Wallet className="size-10 text-muted-foreground" /><p className="text-muted-foreground">Nenhuma posição</p></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {positions.map((position) => <PositionCard key={position.coinId} position={position} currency={currency} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
