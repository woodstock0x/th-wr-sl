'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CoinSearchResult } from '@/lib/types'
import { searchCoins } from '@/lib/coingecko'
import { cn } from '@/lib/utils'

interface CoinSelectorProps {
  value: CoinSearchResult | null
  onChange: (coin: CoinSearchResult | null) => void
  disabled?: boolean
}

export function CoinSelector({ value, onChange, disabled }: CoinSelectorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CoinSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length >= 2) {
        setIsLoading(true)
        const coins = await searchCoins(query)
        setResults(coins)
        setIsLoading(false)
        setIsOpen(true)
      } else {
        setResults([])
        setIsOpen(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  const handleSelect = (coin: CoinSearchResult) => {
    onChange(coin)
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    inputRef.current?.focus()
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        <img
          src={value.thumb}
          alt={value.name}
          className="size-6 rounded-full"
        />
        <div className="flex-1">
          <span className="font-medium">{value.symbol.toUpperCase()}</span>
          <span className="ml-2 text-sm text-muted-foreground">{value.name}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={handleClear}
          disabled={disabled}
        >
          <X className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar moeda (ex: Bitcoin, ETH)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-10"
          disabled={disabled}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {results.map((coin) => (
              <li key={coin.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                    'hover:bg-accent focus:bg-accent focus:outline-none'
                  )}
                  onClick={() => handleSelect(coin)}
                >
                  <img
                    src={coin.thumb}
                    alt={coin.name}
                    className="size-8 rounded-full"
                  />
                  <div>
                    <span className="font-medium">{coin.symbol.toUpperCase()}</span>
                    <p className="text-sm text-muted-foreground">{coin.name}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-4 text-center shadow-lg">
          <p className="text-sm text-muted-foreground">
            Nenhuma moeda encontrada para &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  )
}
