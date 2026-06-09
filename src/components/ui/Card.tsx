import { cn } from '@/lib/utils'

interface PanelProps {
  className?: string
  children: React.ReactNode
}

/**
 * Panel — flat, paper-style container.
 * No drop shadows, no rounded corners — uses crisp 1px borders.
 */
export function Panel({ className, children }: PanelProps) {
  return (
    <div className={cn(
      'bg-white/40 border border-[#d4cdb8] rounded-sm',
      className,
    )}>
      {children}
    </div>
  )
}

interface PanelHeaderProps {
  label: string
  meta?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function PanelHeader({ label, meta, className }: PanelHeaderProps) {
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2 border-b border-[#d4cdb8] bg-[#ebe5d4]/30',
      className,
    )}>
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#4a5444] font-mono font-medium">
        {label}
      </span>
      {meta && <div className="text-[10px] uppercase tracking-wider text-[#8b6f47] font-mono">{meta}</div>}
    </div>
  )
}

export function PanelBody({ className, children }: PanelProps) {
  return <div className={cn('p-4', className)}>{children}</div>
}

/* Backwards-compatible aliases (used in some pages) */
export const Card = Panel
export const CardHeader = ({ children, className }: PanelProps) => (
  <div className={cn('flex items-center justify-between px-4 py-2 border-b border-[#d4cdb8] bg-[#ebe5d4]/30', className)}>
    {children}
  </div>
)
export const CardTitle = ({ children, className }: PanelProps) => (
  <span className={cn('text-[10px] uppercase tracking-[0.18em] text-[#4a5444] font-mono font-medium', className)}>
    {children}
  </span>
)
