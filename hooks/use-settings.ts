'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, TargetConfig, DEFAULT_SETTINGS } from '@/lib/types'
import { getSettings, saveSettings } from '@/lib/storage'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSettings(getSettings())
    setIsLoading(false)
  }, [])

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates }
    saveSettings(newSettings)
    setSettings(newSettings)
  }, [settings])

  const updateTargets = useCallback((targets: TargetConfig[]) => {
    updateSettings({ targets })
  }, [updateSettings])

  const updateCurrency = useCallback((currency: 'BRL' | 'USD') => {
    updateSettings({ currency })
  }, [updateSettings])

  const updateTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme })
  }, [updateSettings])

  const resetToDefaults = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS)
    setSettings(DEFAULT_SETTINGS)
  }, [])

  const importSettings = useCallback((newSettings: Settings) => {
    saveSettings(newSettings)
    setSettings(newSettings)
  }, [])

  return {
    settings,
    isLoading,
    updateSettings,
    updateTargets,
    updateCurrency,
    updateTheme,
    resetToDefaults,
    importSettings,
  }
}
