import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface CoinIdentityProps {
  name: string
  symbol: string
  image?: string
  size?: 'sm' | 'md'
}

export function CoinIdentity({ name, symbol, image, size = 'md' }: CoinIdentityProps) {
  const avatarSize = size === 'sm' ? 'size-8' : 'size-10'
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className={avatarSize}>
        <AvatarImage src={image} alt={name} />
        <AvatarFallback>{symbol.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs uppercase text-muted-foreground">{symbol}</p>
      </div>
    </div>
  )
}
