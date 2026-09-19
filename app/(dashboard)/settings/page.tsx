'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Save, RotateCcw, Target, DollarSign, Palette, BellRing, History, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { useSettings } from '@/hooks/use-settings'
import { TargetConfig, DEFAULT_SETTINGS } from '@/lib/types'
import { type Backup, getBackups, restoreBackup } from '@/lib/storage'
import { requestNotificationPermission, getNotificationPermission } from '@/lib/notifications'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { settings, isLoading, updateSettings, resetToDefaults } = useSettings()

  const [targets, setTargets] = useState<TargetConfig[]>([])
  const [currency, setCurrency] = useState<'USD' | 'BRL'>('USD')
  const [hasChanges, setHasChanges] = useState(false)
  const [backups, setBackups] = useState<Backup[]>([])
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (!isLoading) {
      setTargets(settings.targets)
      setCurrency(settings.currency)
    }
  }, [settings, isLoading])

  useEffect(() => {
    setBackups(getBackups())
    setNotificationPermission(getNotificationPermission())
  }, [])

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const permission = await requestNotificationPermission()
      setNotificationPermission(permission)
      if (permission !== 'granted') {
        toast.error('Permissão de notificação negada pelo navegador.')
        updateSettings({ notificationsEnabled: false })
        return
      }
    }
    updateSettings({ notificationsEnabled: enabled })
    toast.success(enabled ? 'Notificações do navegador ativadas!' : 'Notificações do navegador desativadas.')
  }

  const handleRestoreBackup = (id: string) => {
    const restored = restoreBackup(id)
    if (!restored) {
      toast.error('Não foi possível restaurar este backup.')
      return
    }
    toast.success('Backup restaurado com sucesso! Recarregando...')
    setTimeout(() => window.location.reload(), 1000)
  }

  const handleTargetChange = (level: number, field: 'percentage' | 'sellPercentage', value: string) => {
    const numValue = parseFloat(value) || 0
    setTargets((prev) =>
      prev.map((t) => (t.level === level ? { ...t, [field]: numValue } : t))
    )
    setHasChanges(true)
  }

  const handleCurrencyChange = (value: 'USD' | 'BRL') => {
    setCurrency(value)
    setHasChanges(true)
  }

  const handleSave = () => {
    // Validar que a soma das porcentagens de venda seja 100%
    const totalSellPercentage = targets.reduce((sum, t) => sum + t.sellPercentage, 0)
    if (totalSellPercentage !== 100) {
      toast.error(`A soma das porcentagens de venda deve ser 100% (atual: ${totalSellPercentage}%)`)
      return
    }

    // Validar que os percentuais de target estao em ordem crescente
    for (let i = 1; i < targets.length; i++) {
      if (targets[i].percentage <= targets[i - 1].percentage) {
        toast.error('Os percentuais de target devem estar em ordem crescente')
        return
      }
    }

    updateSettings({ targets, currency })
    setHasChanges(false)
    toast.success('Configuracoes salvas com sucesso!')
  }

  const handleReset = () => {
    resetToDefaults()
    setTargets(DEFAULT_SETTINGS.targets)
    setCurrency(DEFAULT_SETTINGS.currency)
    setHasChanges(false)
    toast.success('Configuracoes restauradas para o padrao')
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  const totalSellPercentage = targets.reduce((sum, t) => sum + t.sellPercentage, 0)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuracoes</h1>
          <p className="text-muted-foreground">
            Personalize os targets e preferencias do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 size-4" />
            Restaurar Padrao
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="mr-2 size-4" />
            Salvar
          </Button>
        </div>
      </div>

      {/* Target Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="size-5 text-primary" />
            <CardTitle>Configuracao de Targets</CardTitle>
          </div>
          <CardDescription>
            Defina os 3 niveis de realizacao de lucro. Ao atingir T3, o trade e encerrado automaticamente.
            Qualquer saldo restante permanece no registro do trade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground">
              <span>Target</span>
              <span>Valorizacao (%)</span>
              <span>Vender (%)</span>
            </div>
            <Separator />
            
            {targets.map((target) => (
              <div key={target.level} className="grid grid-cols-3 items-center gap-4">
                <Label className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    T{target.level}
                  </div>
                  <span className="text-sm">
                    {target.level === targets.length ? '(Final)' : ''}
                  </span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={target.percentage}
                  onChange={(e) => handleTargetChange(target.level, 'percentage', e.target.value)}
                  className="text-center"
                />
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={target.sellPercentage}
                  onChange={(e) => handleTargetChange(target.level, 'sellPercentage', e.target.value)}
                  className="text-center"
                />
              </div>
            ))}

            <Separator />
            
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm font-medium">Total de Venda:</span>
              <span className={`font-bold ${totalSellPercentage === 100 ? 'text-chart-1' : 'text-destructive'}`}>
                {totalSellPercentage}%
              </span>
            </div>
            
            {totalSellPercentage !== 100 && (
              <p className="text-sm text-destructive">
                A soma deve ser exatamente 100%. Ajuste os valores acima.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Currency Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="size-5 text-primary" />
            <CardTitle>Moeda de Exibicao</CardTitle>
          </div>
          <CardDescription>
            Escolha a moeda padrao para exibir valores no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel>Moeda</FieldLabel>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">Dolar Americano (USD)</SelectItem>
                <SelectItem value="BRL">Real Brasileiro (BRL)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" />
            <CardTitle>Notificações do Navegador</CardTitle>
          </div>
          <CardDescription>
            Recebe um alerta do sistema operacional quando um target ou oportunidade de recompra for
            atingido, mesmo com a aba em segundo plano. Funciona apenas enquanto o navegador estiver
            aberto neste dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Ativar notificações</p>
              {notificationPermission === 'denied' && (
                <p className="text-xs text-destructive">
                  Permissão bloqueada no navegador. Ajuste nas configurações do site para reativar.
                </p>
              )}
              {notificationPermission === 'unsupported' && (
                <p className="text-xs text-muted-foreground">
                  Este navegador não suporta notificações.
                </p>
              )}
            </div>
            <Switch
              checked={!!settings.notificationsEnabled}
              disabled={notificationPermission === 'unsupported'}
              onCheckedChange={handleToggleNotifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Backups */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <CardTitle>Backups</CardTitle>
          </div>
          <CardDescription>
            Um backup é criado automaticamente antes de qualquer importação de dados. Restaurar
            substitui os dados atuais pelo conteúdo salvo no backup escolhido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum backup automático foi criado ainda.</p>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{backup.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(backup.savedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} ·{' '}
                      {backup.data.trades.length} trade(s)
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0 cursor-pointer">
                        <RefreshCcw className="mr-2 size-4" />
                        Restaurar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restaurar este backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Os trades, o ledger e as configurações atuais serão substituídos pelo
                          conteúdo deste backup. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button className="cursor-pointer" onClick={() => handleRestoreBackup(backup.id)}>
                            Restaurar Backup
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <Target className="size-5 text-primary" />
            </div>
            <div className="text-sm">
              <p className="font-medium">Como funcionam os targets?</p>
              <p className="mt-1 text-muted-foreground">
                Quando o ROI de um trade atinge o percentual definido, um alerta e exibido sugerindo
                que voce realize a porcentagem configurada do montante. Ao atingir T3 (o ultimo target),
                o trade e automaticamente finalizado, independente de haver saldo restante.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
