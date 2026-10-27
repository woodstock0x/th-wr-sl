'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useGoogleDrive } from '@/hooks/use-google-drive'

type GoogleDriveContextValue = ReturnType<typeof useGoogleDrive>

const GoogleDriveContext = createContext<GoogleDriveContextValue | null>(null)

/**
 * Mantém uma única instância do estado do Google Drive (conexão, token em
 * cache, intervalo de auto-sync) viva enquanto o usuário navega entre
 * páginas do dashboard. Sem isso, cada página que chamasse `useGoogleDrive`
 * diretamente criaria sua própria cópia do estado — e o `setInterval` do
 * auto-sync seria cancelado ao sair da página (ex: Configurações), porque
 * o componente desmonta junto.
 */
export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const value = useGoogleDrive()
  return <GoogleDriveContext.Provider value={value}>{children}</GoogleDriveContext.Provider>
}

export function useGoogleDriveContext(): GoogleDriveContextValue {
  const context = useContext(GoogleDriveContext)
  if (!context) throw new Error('useGoogleDriveContext deve ser usado dentro de GoogleDriveProvider')
  return context
}
