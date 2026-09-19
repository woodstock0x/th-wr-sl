/**
 * Arredondamento consistente para evitar o acúmulo de erro de ponto flutuante
 * do IEEE-754 em quantidades de cripto (8 casas) e valores monetários (2 casas).
 * Sem isso, subtrações sucessivas (quantity - fee - realizations...) produzem
 * dízimas como 0.129550470805 que nunca chegam exatamente a zero.
 */
export const QUANTITY_DECIMALS = 8
export const CURRENCY_DECIMALS = 2

function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  // Number.EPSILON compensa erros de representação antes do arredondamento.
  return Math.round((value + Number.EPSILON * value) * factor) / factor
}

export function roundQuantity(value: number): number {
  return roundTo(value, QUANTITY_DECIMALS)
}

export function roundCurrency(value: number): number {
  return roundTo(value, CURRENCY_DECIMALS)
}

/** Trata valores muito próximos de zero (residuais de float) como zero. */
export function isEffectivelyZero(value: number, decimals: number = QUANTITY_DECIMALS): boolean {
  return Math.abs(value) < 10 ** -decimals / 2
}
