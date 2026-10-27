'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'

function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function decimalStringToCents(value: string): number {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  /** Valor decimal com ponto (ex: "105.88"), mesmo formato aceito por parseFloat. */
  value: string
  /** Chamado com o valor decimal atualizado (ex: "105.88"), ou "" se o campo ficar vazio. */
  onChange: (value: string) => void
}

/**
 * Input de dinheiro no estilo "calculadora de caixa": os dígitos digitados
 * preenchem da direita para a esquerda, com os 2 últimos sempre sendo os
 * centavos (10588 -> 105,88; 123456 -> 1.234,56). Usar apenas para campos em
 * moeda (preço, valor de saque, stop loss) — quantidades de cripto precisam
 * de mais de 2 casas decimais e não devem usar esta máscara.
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  ...props
}: CurrencyInputProps) {
  const display = value === '' ? '' : centsToDisplay(decimalStringToCents(value))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    onChange(digits ? (parseInt(digits, 10) / 100).toFixed(2) : '')
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
      {...props}
    />
  )
}
