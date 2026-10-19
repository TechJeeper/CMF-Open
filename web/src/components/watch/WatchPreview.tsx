import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Button } from '@/lib/apps/manifest'
import { useDisplay } from '@/state/watch-context'
import {
  ClockSurface,
  ContactsSurface,
  DialSurface,
  MusicSurface,
  NotificationSurface,
  WeatherSurface,
  type Surface,
} from './surfaces'

const TABS: { id: Surface; label: string }[] = [
  { id: 'clock', label: 'Clock' },
  { id: 'music', label: 'Music' },
  { id: 'notification', label: 'Alerts' },
  { id: 'weather', label: 'Weather' },
  { id: 'contacts', label: 'List' },
]

/** A 1:1 sketch of the round 466 px panel showing the surfaces apps draw on. */
export function WatchPreview({ onPress, className }: { onPress?: (b: Button) => void; className?: string }) {
  const s = useDisplay()
  const [surface, setSurface] = useState<Surface>('clock')
  const [shake, setShake] = useState(false)
  const lastBuzz = useRef(s.buzzes)
  const lastAlert = useRef(s.notifications[0])
  const alertAt = useRef(0)

  // Follow the app when it moves to another surface or raises an alert, like the real
  // watch does. Redraws of the same surface (e.g. a ticking timer) leave a picked tab alone,
  // and an alert holds the screen briefly even if the app redraws right after sending it.
  useEffect(() => {
    if (s.notifications[0] === lastAlert.current) return
    lastAlert.current = s.notifications[0]
    alertAt.current = Date.now()
    setSurface('notification')
  }, [s.notifications])

  useEffect(() => {
    if (!s.lastSurface || s.lastSurface === 'notification') return
    if (Date.now() - alertAt.current < 3000) return
    setSurface(s.lastSurface === 'dial' ? 'clock' : s.lastSurface)
  }, [s.lastSurface])

  useEffect(() => {
    if (s.buzzes === lastBuzz.current) return
    lastBuzz.current = s.buzzes
    setShake(true)
    const t = setTimeout(() => setShake(false), 450)
    return () => clearTimeout(t)
  }, [s.buzzes])

  const body =
    surface === 'music' ? (
      <MusicSurface s={s} onPress={onPress} />
    ) : surface === 'notification' ? (
      <NotificationSurface s={s} />
    ) : surface === 'weather' ? (
      <WeatherSurface s={s} />
    ) : surface === 'contacts' ? (
      <ContactsSurface s={s} />
    ) : s.dial ? (
      <DialSurface dial={s.dial} clock={s.dialClock} />
    ) : (
      <ClockSurface />
    )

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div
        className={cn(
          'relative aspect-square w-full max-w-[19rem] rounded-full bg-gradient-to-b from-neutral-600 via-neutral-800 to-neutral-900 p-[5%] shadow-2xl shadow-black/60',
          shake && 'animate-[buzz_0.45s_ease-in-out]',
        )}
      >
        <div className="absolute top-1/2 -right-[3%] h-[14%] w-[4%] -translate-y-1/2 rounded-r-md bg-neutral-700" />
        <div
          className="relative grid size-full place-items-center overflow-hidden rounded-full bg-black ring-1 ring-white/10"
          data-testid="watch-screen"
        >
          {body}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1" role="tablist" aria-label="Watch screen">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={surface === t.id}
            onClick={() => setSurface(t.id)}
            className={cn(
              'rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition hover:text-foreground',
              surface === t.id && 'bg-secondary text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
