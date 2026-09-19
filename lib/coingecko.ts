import { CoinGeckoPrice, CoinSearchResult } from './types'

const BASE_URL = 'https://api.coingecko.com/api/v3'

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  if (!query || query.length < 2) return []

  try {
    const response = await fetch(`${BASE_URL}/search?query=${encodeURIComponent(query)}`)
    if (!response.ok) throw new Error('Erro ao buscar moedas')
    const data = await response.json()
    return data.coins?.slice(0, 10) || []
  } catch (error) {
    console.error('Erro ao buscar moedas:', error)
    return []
  }
}

export async function getPrices(coinIds: string[], currency: 'usd' | 'brl' = 'usd'): Promise<CoinGeckoPrice> {
  if (coinIds.length === 0) return {}

  try {
    const ids = coinIds.join(',')
    const response = await fetch(
      `${BASE_URL}/simple/price?ids=${ids}&vs_currencies=usd,brl&include_24hr_change=true`
    )
    if (!response.ok) throw new Error('Erro ao buscar preços')
    return await response.json()
  } catch (error) {
    console.error('Erro ao buscar preços:', error)
    return {}
  }
}

export async function getCoinData(coinId: string): Promise<{
  id: string
  symbol: string
  name: string
  image: string
  current_price: number

} | null> {
  try {
    const response = await fetch(`${BASE_URL}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`)
    if (!response.ok) throw new Error('Erro ao buscar dados da moeda')
    const data = await response.json()
    return {
      id: data.id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      image: data.image?.small || '',
      current_price: data.market_data?.current_price?.usd || 0,

    }
  } catch (error) {
    console.error('Erro ao buscar dados da moeda:', error)
    return null
  }
}