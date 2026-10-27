import { z } from 'zod'

/**
 * Validação de fronteira para tudo que entra vindo de fora do processo React
 * (localStorage e arquivos importados). Sem isso, um JSON corrompido ou de
 * uma versão antiga entra direto em `trades`/`ledger` e só quebra a UI mais
 * tarde, de forma difícil de depurar (ex.: `entry.amount` como string,
 * `ledgerId` truncado, `realizations` ausente).
 */

const finiteNumber = z.number().finite()

export const rebuySourceSchema = z.object({
  tradeId: z.string().min(1),
  realizationId: z.string().min(1),
  targetLevel: finiteNumber,
})

export const targetStopLossSchema = z.object({
  targetLevel: finiteNumber,
  price: finiteNumber,
  quantity: finiteNumber,
  status: z.enum(['ATIVO', 'EXECUTADO', 'ENCERRADO']),
})

export const realizationSchema = z.object({
  id: z.string().min(1),
  tradeId: z.string().min(1),
  targetLevel: finiteNumber,
  exitPrice: finiteNumber,
  quantity: finiteNumber,
  date: z.string().min(1),
  profit: finiteNumber.catch(0),
  usdValue: finiteNumber.catch(0),
  ledgerId: z.string().min(1),
  rebuyStatus: z.enum(['PENDING', 'DISMISSED', 'EXECUTED']).optional(),
})

export const tradeSchema = z.object({
  id: z.string().min(1),
  coinId: z.string().min(1),
  coinSymbol: z.string().min(1),
  coinName: z.string().min(1),
  coinImage: z.string().optional(),
  stopLosses: z.array(targetStopLossSchema).optional(),
  type: z.enum(['COMPRA', 'RECOMPRA', 'VENDA']),
  fundingSource: z.enum(['CASH', 'EXTERNAL']).optional(),
  currency: z.enum(['USD', 'BRL']).optional(),
  entryPrice: finiteNumber,
  quantity: finiteNumber,
  fee: finiteNumber.catch(0),
  remainingQuantity: finiteNumber,
  entryDate: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(['ATIVO', 'FINALIZADO']),
  realizations: z.array(realizationSchema),
  targetsHit: z.array(finiteNumber),
  targetsIgnored: z.array(finiteNumber).optional(),
  rebuySource: rebuySourceSchema.optional(),
  ledgerEntryIds: z.array(z.string()).optional(),
  createdAt: z.string().min(1),
})

export const ledgerEntrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(['REALIZATION', 'TRADE_ENTRY', 'WITHDRAW']),
  amount: finiteNumber,
  tradeId: z.string().min(1).nullable(),
  date: z.string().min(1),
  metadata: z
    .object({
      method: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
})

export const targetConfigSchema = z.object({
  level: finiteNumber,
  percentage: finiteNumber,
  sellPercentage: finiteNumber,
})

export const settingsSchema = z.object({
  targets: z.array(targetConfigSchema),
  currency: z.enum(['BRL', 'USD']),
  theme: z.enum(['light', 'dark', 'system']),
  notificationsEnabled: z.boolean().optional(),
})

export const exportedDataSchema = z.object({
  schemaVersion: finiteNumber.optional(),
  trades: z.array(tradeSchema),
  settings: settingsSchema,
  ledger: z.array(ledgerEntrySchema),
  exportedAt: z.string().min(1),
})

export type ValidatedExportedData = z.infer<typeof exportedDataSchema>

export interface ImportValidationResult {
  success: boolean
  data?: ValidatedExportedData
  errors: string[]
}

/**
 * Valida um payload de importação sem lançar exceção. Trades/entradas de
 * ledger inválidas são reportadas (não silenciosamente descartadas) para que
 * o usuário saiba exatamente o que está quebrado no arquivo antes de decidir
 * prosseguir.
 */
export function validateExportedData(raw: unknown): ImportValidationResult {
  const result = exportedDataSchema.safeParse(raw)
  if (result.success) {
    return { success: true, data: result.data, errors: [] }
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })

  return { success: false, errors }
}
