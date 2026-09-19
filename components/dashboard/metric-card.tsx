'use client'

import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, getColorClass } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  description: string
  icon: LucideIcon
  valueTone?: number
  descriptionIcon?: LucideIcon
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  valueTone = 0,
  descriptionIcon: DescriptionIcon,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', getColorClass(valueTone))}>
          {value}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {DescriptionIcon ? <DescriptionIcon className="size-3" aria-hidden="true" /> : null}
          <span>{description}</span>
        </div>
      </CardContent>
    </Card>
  )
}
