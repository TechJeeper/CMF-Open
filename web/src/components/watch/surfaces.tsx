import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, CloudSun, User } from 'lucide-react'
import type { Button } from '@/lib/apps/manifest'
import type { DisplayState } from '@/lib/display'
import type { Rgba } from '@/lib/watchface/photo'

export type Surface = 'clock' | 'music' | 'notification' | 'weather' | 'contacts' | 'dial'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function ClockSurface() {
  const now = useClock()
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-dot text-6xl font-bold tracking-tight text-white">{hhmm(now)}</span>
      <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
        {now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
    </div>
  )
}

export function MusicSurface({ s, onPress }: { s: DisplayState; onPress?: (b: Button) => void }) {
  const { track, artist, playing } = s.music
  const btn = 'grid size-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white'
  return (
    <div className="flex w-full flex-col items-center gap-3 px-10 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Now playing</span>
      <p className="line-clamp-2 text-lg leading-tight font-semibold text-white">{track || '—'}</p>
      <p className="line-clamp-1 text-xs text-white/60">{artist}</p>
      <div className="mt-1 flex items-center gap-2">
        <button aria-label="Previous" className={btn} onClick={() => onPress?.('prev')}>
          <SkipBack className="size-5" />
        </button>
        <button
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid size-12 place-items-center rounded-full bg-brand text-white transition hover:brightness-110"
          onClick={() => onPress?.(playing ? 'pause' : 'play')}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
        </button>
        <button aria-label="Next" className={btn} onClick={() => onPress?.('next')}>
          <SkipForward className="size-5" />
        </button>
      </div>
    </div>
  )
}

export function NotificationSurface({ s }: { s: DisplayState }) {
  const n = s.notifications[0]
  if (!n) return <p className="text-sm text-white/50">No notifications</p>
  return (
    <div className="flex w-full flex-col items-center gap-2 px-12 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand">Notification</span>
      <p className="line-clamp-2 text-base font-semibold text-white">{n.title}</p>
      <p className="line-clamp-4 text-xs leading-relaxed text-white/70">{n.body}</p>
      {s.notifications.length > 1 && (
        <span className="font-mono text-[10px] text-white/40">+{s.notifications.length - 1} earlier</span>
      )}
    </div>
  )
}

export function WeatherSurface({ s }: { s: DisplayState }) {
  return (
    <div className="flex w-full flex-col items-center gap-2 px-10 text-center">
      <CloudSun className="size-8 text-white/70" />
      <span className="font-dot text-4xl font-bold text-white">{s.weatherTemp}°</span>
      <p className="line-clamp-2 text-sm font-medium text-white/80">{s.weatherCity || '—'}</p>
    </div>
  )
}

export function ContactsSurface({ s }: { s: DisplayState }) {
  if (!s.contacts.length) return <p className="text-sm text-white/50">No contacts</p>
  return (
    <div className="h-full w-full overflow-y-auto px-14 py-14 [scrollbar-width:none]">
      <ul className="flex flex-col gap-1.5">
        {s.contacts.map((c, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-1.5">
            <User className="size-3.5 shrink-0 text-white/40" />
            <span className="min-w-0 flex-1 truncate text-xs text-white">{c.name}</span>
            {c.phone && <span className="font-mono text-[10px] text-white/50">{c.phone}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DialSurface({ dial }: { dial: Rgba }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const now = useClock()
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = dial.width
    c.height = dial.height
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(dial.data), dial.width, dial.height), 0, 0)
  }, [dial])
  return (
    <div className="relative size-full">
      <canvas ref={ref} className="size-full" />
      <span className="absolute top-[18%] left-[14%] font-dot text-4xl font-bold text-white drop-shadow">{hhmm(now)}</span>
    </div>
  )
}
