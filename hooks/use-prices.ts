'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { CoinGeckoPrice } from '@/lib/types'
import { getPrices } from '@/lib/coingecko'

const REFRESH_INTERVAL = 1200000 // 1200 segundos

export function usePrices(coinIds: string[]) {
  const [prices, setPrices] = useState<CoinGeckoPrice>({})
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const inFlightRef = useRef(false)

  // Chave estável: `coinIds` costuma chegar como um array novo a cada
  // render (ex.: `trades.map(...)` sem useMemo no chamador). Sem isso, o
  // efeito abaixo reexecuta a cada render, reiniciando o intervalo e
  // multiplicando chamadas à API pública do CoinGecko (que tem rate limit
  // agressivo) mesmo quando a lista de moedas não mudou de fato.
  const idsKey = useMemo(() => [...new Set(coinIds)].sort().join(','), [coinIds])

  const fetchPrices = useCallback(async () => {
    if (!idsKey) return
    if (inFlightRef.current) return
    inFlightRef.current = true

    setIsLoading(true)
    setError(null)

    try {
      const data = await getPrices(idsKey.split(','))
      setPrices(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError('Erro ao buscar preços')
      console.error(err)
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [idsKey])

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
