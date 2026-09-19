'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CoinGeckoPrice } from '@/lib/types'
import { getPrices } from '@/lib/coingecko'

const REFRESH_INTERVAL = 1200000 // 1200 segundos

export function usePrices(coinIds: string[]) {
  const [prices, setPrices] = useState<CoinGeckoPrice>({})
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchPrices = useCallback(async () => {
    if (coinIds.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const uniqueIds = [...new Set(coinIds)]
      const data = await getPrices(uniqueIds)
      setPrices(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError('Erro ao buscar preços')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [coinIds])

  useEffect(() => {
    fetchPrices()

    intervalRef.current = setInterval(fetchPrices, REFRESH_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchPrices])

  const getPrice = useCallback(
    (coinId: string, currency: 'usd' | 'brl' = 'usd') => {
      return prices[coinId]?.[currency] || 0
    },
    [prices]
  )

  const get24hChange = useCallback(
    (coinId: string, currency: 'usd' | 'brl' = 'usd') => {
      const key = `${currency}_24h_change` as 'usd_24h_change' | 'brl_24h_change'
      return prices[coinId]?.[key] || 0
    },
    [prices]
  )

  return {
    prices,
    isLoading,
    lastUpdated,
    error,
    refetch: fetchPrices,
    getPrice,
    get24hChange,
  }
}
