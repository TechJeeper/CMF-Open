import { cn } from '@/lib/utils'

export function AppIcon({ icon, name, className }: { icon?: string; name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-secondary to-background text-2xl ring-1 ring-border',
        className,
      )}
    >
      {icon || <span className="font-dot text-lg font-bold">{name.slice(0, 1).toUpperCase()}</span>}
    </span>
  )
}
