'use client'

import { Activity, DollarSign, Target, TrendingUp, Wallet } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/metric-card'
import type { PortfolioSummary as PortfolioSummaryType } from '@/lib/types'
import { formatCurrency, formatPercentage } from '@/lib/calculations'

interface PortfolioSummaryProps {
  summary: PortfolioSummaryType
}

export function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <MetricCard
        title="Total Investido"
        value={formatCurrency(summary.totalInvested, summary.currency)}
        description={`${summary.activeTrades} trades ativos`}
        icon={DollarSign}
        valueTone={summary.totalInvested}
      />
      <MetricCard
        title="Posições"
        value={formatCurrency(summary.positionValue, summary.currency)}
        description="Posições abertas"
        icon={DollarSign}
        valueTone={summary.positionValue}
      />
      <MetricCard
        title="Patrimônio"
        value={formatCurrency(summary.totalEquity, summary.currency)}
        description="Posições + caixa"
        icon={Wallet}
        valueTone={summary.totalProfit}
      />
      <MetricCard
        title="ROI Global"
        value={formatPercentage(summary.totalROI)}
        description="Performance geral"
        icon={Target}
        descriptionIcon={Activity}
        valueTone={summary.totalROI}
      />
      <MetricCard
        title="PnL"
        value={formatCurrency(summary.totalProfit, summary.currency)}
        description={`Realizado: ${formatCurrency(summary.realizedProfit, summary.currency)}`}
        icon={TrendingUp}
        valueTone={summary.totalProfit}
      />
    </div>
  )
}
