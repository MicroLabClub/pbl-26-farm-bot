import { cn } from '@/lib/utils'

type Variant = 'green' | 'yellow' | 'red' | 'blue' | 'gray'

const variants: Record<Variant, string> = {
  green:  'bg-[#2d5016]/8 text-[#2d5016] border-[#2d5016]/25',
  yellow: 'bg-[#c9a032]/10 text-[#8b6f47] border-[#c9a032]/35',
  red:    'bg-[#b34a3a]/8 text-[#b34a3a] border-[#b34a3a]/30',
  blue:   'bg-[#3a5a7c]/8 text-[#3a5a7c] border-[#3a5a7c]/30',
  gray:   'bg-[#4a5444]/8 text-[#4a5444] border-[#4a5444]/25',
}

interface BadgeProps {
  variant?: Variant
  className?: string
  children: React.ReactNode
}

export function Badge({ variant = 'gray', className, children }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] uppercase tracking-[0.1em] font-mono font-medium border',
      variants[variant], className,
    )}>
      {children}
    </span>
  )
}
