import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppCard } from '@/components/store/AppCard'
import { StoreSources } from '@/components/store/StoreSources'
import { useCatalogs, useInstalled } from '@/hooks/useStore'
import { cn } from '@/lib/utils'

const STEPS = [
  ['Connect', 'Pair your CMF Watch 3 Pro over Web Bluetooth, or start the simulator.'],
  ['Get an app', 'Apps are small JavaScript files. They install into this browser.'],
  ['Use your wrist', 'The app draws on the music, alert, weather and list screens. You control it with the media buttons.'],
]

export function StorePage() {
  const { catalogs, errors, loading, reload } = useCatalogs()
  const installed = useInstalled()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const apps = useMemo(() => {
    const seen = new Set<string>()
    return catalogs.flatMap((c) => c.apps).filter((a) => !seen.has(a.id) && seen.add(a.id))
  }, [catalogs])
  const tags = useMemo(() => [...new Set(apps.flatMap((a) => a.tags ?? []))].sort(), [apps])
  const shown = apps.filter((a) => {
    const text = `${a.name} ${a.description} ${a.author} ${a.tags?.join(' ')}`.toLowerCase()
    return (!q || text.includes(q.toLowerCase())) && (!tag || a.tags?.includes(tag))
  })

  return (
    <div className="flex flex-col gap-10">
      <section className="dot-grid relative overflow-hidden rounded-3xl border p-6 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">CMF Watch 3 Pro</p>
        <h1 className="mt-3 max-w-2xl font-dot text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Apps for a watch that doesn't do apps.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          The stock firmware has no app runtime, so these apps run in your browser and drive the screens the watch
          already has. Nothing gets flashed and nothing can brick it.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="font-dot text-2xl font-bold text-brand">{i + 1}</span>
              <span>
                <span className="block font-medium">{title}</span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <h2 className="text-xl font-semibold">All apps</h2>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search apps" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <StoreSources onChange={reload} />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[null, ...tags].map((t) => (
              <button
                key={t ?? 'all'}
                onClick={() => setTag(t)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs capitalize text-muted-foreground transition hover:text-foreground',
                  tag === t && 'border-foreground/40 bg-secondary text-foreground',
                )}
              >
                {t ?? 'All'}
              </button>
            ))}
          </div>
        )}

        {errors.map((e) => (
          <Alert key={e.source} variant="destructive">
            <TriangleAlert />
            <AlertTitle>Couldn't load a store</AlertTitle>
            <AlertDescription>
              {e.source}: {e.message}
            </AlertDescription>
          </Alert>
        ))}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border bg-card" />
            ))}
          </div>
        ) : shown.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((a) => (
              <AppCard key={a.id} entry={a} installed={installed[a.id]} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
            <p className="font-medium">No apps match</p>
            <p className="text-sm text-muted-foreground">Try another search, or build your own app.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/develop">Open the playground</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
