'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { exportData, importData } from '@/lib/storage'
import { onDataChanged } from '@/lib/data-change-events'
import {
  clearCachedToken,
  downloadBackup,
  getCachedAccessToken,
  getFolderName,
  getGoogleAccountEmail,
  isGoogleDriveConfigured,
  preloadGoogleIdentityServices,
  requestAccessToken,
  revokeAccessToken,
  TRADES_DRIVE_FOLDER_ID,
  uploadBackup,
} from '@/lib/google-drive'

const STATE_KEY = 'google-drive-integration'
const AUTO_SYNC_CHECK_INTERVAL = 60_000
const DATA_CHANGE_DEBOUNCE_MS = 2_000

interface DriveState {
  connected: boolean
  email: string | null
  folderName: string | null
  autoSync: boolean
  lastSyncAt: string | null
  lastSyncedContent: string | null
}

const DEFAULT_STATE: DriveState = {
  connected: false,
  email: null,
  folderName: null,
  autoSync: false,
  lastSyncAt: null,
  lastSyncedContent: null,
}

function readState(): DriveState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_STATE
  }
}

function writeState(state: DriveState): void {
  if (typeof window !== 'undefined') localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

/**
 * `exportData()` sempre inclui `exportedAt` com o timestamp da chamada,
 * então duas exportações nunca são string-idênticas mesmo sem nenhuma
 * mudança real — por isso a comparação de "dados mudaram desde o último
 * sync" ignora esse campo.
 */
function withoutTimestamp(json: string): string {
  try {
    const parsed = JSON.parse(json)
    delete parsed.exportedAt
    return JSON.stringify(parsed)
  } catch {
    return json
  }
}

export function useGoogleDrive() {
  const [state, setState] = useState<DriveState>(DEFAULT_STATE)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [autoSyncError, setAutoSyncError] = useState<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    setState(readState())
    if (isGoogleDriveConfigured()) preloadGoogleIdentityServices()
  }, [])

  const persist = useCallback((updates: Partial<DriveState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates }
      writeState(next)
      return next
    })
  }, [])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    try {
      const accessToken = await requestAccessToken('consent')
      const [email, folderName] = await Promise.all([
        getGoogleAccountEmail(accessToken),
        getFolderName(accessToken, TRADES_DRIVE_FOLDER_ID),
      ])
      persist({ connected: true, email, folderName })
      return true
    } finally {
      setIsConnecting(false)
    }
  }, [persist])

  const disconnect = useCallback(async () => {
    // Só revoga no Google se já tivermos um token válido em mãos — nunca
    // pedimos um novo aqui, porque isso poderia abrir o popup de login só
    // para desconectar. Sem token em cache, a desconexão é só local; o
    // pior caso é o usuário revogar manualmente em myaccount.google.com.
    const cachedToken = getCachedAccessToken()
    if (cachedToken) {
      try {
        await revokeAccessToken(cachedToken)
      } catch {
        // melhor esforço — segue com a limpeza local de qualquer forma.
      }
    }
    clearCachedToken()
    persist({ ...DEFAULT_STATE })
    setAutoSyncError(null)
  }, [persist])

  const syncNow = useCallback(async () => {
    const current = stateRef.current
    if (!current.connected) throw new Error('Google Drive não conectado')

    setIsSyncing(true)
    try {
      const accessToken = await requestAccessToken('')
      const content = exportData()
      await uploadBackup(accessToken, TRADES_DRIVE_FOLDER_ID, content)
      persist({ lastSyncAt: new Date().toISOString(), lastSyncedContent: content })
      setAutoSyncError(null)
    } finally {
      setIsSyncing(false)
    }
  }, [persist])

  const restoreFromDrive = useCallback(async () => {
    const current = stateRef.current
    if (!current.connected) throw new Error('Google Drive não conectado')

    const accessToken = await requestAccessToken('')
    const content = await downloadBackup(accessToken, TRADES_DRIVE_FOLDER_ID)
    if (!content) throw new Error('Nenhum backup encontrado na pasta do Google Drive')

    return importData(content)
  }, [])

  const setAutoSync = useCallback((enabled: boolean) => {
    persist({ autoSync: enabled })
    if (!enabled) setAutoSyncError(null)
  }, [persist])

  // Sincroniza quando os dados realmente mudam — reage ao evento disparado
  // por saveTrades/saveSettings/saveLedger, com um pequeno debounce (uma
  // mesma ação costuma gravar trades e ledger quase juntos). O intervalo
  // de 60s continua rodando como rede de segurança (ex: se o evento for
  // perdido por algum motivo), mas o evento é o que faz o sync parecer
  // imediato a cada interação, não só a cada minuto.
  useEffect(() => {
    if (!state.autoSync || !state.connected) return

    const check = async () => {
      if (document.hidden) return
      const previous = stateRef.current.lastSyncedContent
      const current = exportData()
      if (previous && withoutTimestamp(current) === withoutTimestamp(previous)) return
      try {
        await syncNow()
        setAutoSyncError(null)
      } catch (error) {
        console.error('Erro ao sincronizar com o Google Drive:', error)
        setAutoSyncError(error instanceof Error ? error.message : 'Erro ao sincronizar automaticamente')
      }
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleCheck = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(check, DATA_CHANGE_DEBOUNCE_MS)
    }

    check()
    const unsubscribe = onDataChanged(scheduleCheck)
    const interval = setInterval(check, AUTO_SYNC_CHECK_INTERVAL)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      unsubscribe()
      clearInterval(interval)
    }
  }, [state.autoSync, state.connected, syncNow])

  return {
    isConfigured: isGoogleDriveConfigured(),
    isConnected: state.connected,
    isConnecting,
    isSyncing,
    email: state.email,
    folderName: state.folderName,
    autoSync: state.autoSync,
    autoSyncError,
    lastSyncAt: state.lastSyncAt,
    connect,
    disconnect,
    syncNow,
    restoreFromDrive,
    setAutoSync,
  }
}
