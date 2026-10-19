import { Bell, Minus, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react'
import { Button as UIButton } from '@/components/ui/button'
import type { AppManifest, Button } from '@/lib/apps/manifest'

const PAD: { b: Button; label: string; icon: typeof Play }[] = [
  { b: 'prev', label: 'Prev', icon: SkipBack },
  { b: 'play', label: 'Play', icon: Play },
  { b: 'pause', label: 'Pause', icon: Pause },
  { b: 'next', label: 'Next', icon: SkipForward },
  { b: 'vol_down', label: 'Vol −', icon: Minus },
  { b: 'vol_up', label: 'Vol +', icon: Plus },
  { b: 'find_phone', label: 'Find phone', icon: Bell },
]

/** The watch's media controls, labelled with what the running app says they do. */
export function ButtonPad({ manifest, onPress, disabled }: { manifest?: AppManifest | null; onPress: (b: Button) => void; disabled?: boolean }) {
  const used = manifest?.buttons ?? {}
  const hasMap = Object.keys(used).length > 0
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PAD.map(({ b, label, icon: Icon }) => {
        const role = used[b]
        return (
          <UIButton
            key={b}
            variant={role ? 'secondary' : 'ghost'}
            disabled={disabled}
            onClick={() => onPress(b)}
            className={`h-auto flex-col items-start gap-0.5 py-2 text-left ${hasMap && !role ? 'opacity-50' : ''}`}
            title={role ?? 'Not used by this app'}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Icon className="size-3.5" /> {label}
            </span>
            <span className="line-clamp-1 w-full text-[11px] font-normal text-muted-foreground">{role ?? '—'}</span>
          </UIButton>
        )
      })}
    </div>
  )
}
