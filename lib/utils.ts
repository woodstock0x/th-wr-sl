import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getColorClass(value: number): string {
  if (value > 0) return 'text-chart-1'
  if (value < 0) return 'text-destructive'
  return 'text-muted-foreground'
}