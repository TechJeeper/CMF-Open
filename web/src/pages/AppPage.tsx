import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Globe, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogPanel } from '@/components/apps/LogPanel'
import { RunPanel } from '@/components/apps/RunPanel'
import { SettingsForm } from '@/components/apps/SettingsForm'
import { AppIcon } from '@/components/store/AppIcon'
import { useCatalogs, useInstalled } from '@/hooks/useStore'
import { installFromCatalog } from '@/lib/store/actions'
import { uninstall } from '@/lib/store/installed'
import { useRunner } from '@/state/runner-context'

const BUTTON_LABEL: Record<string, string> = {
  play: 'Play',
  pause: 'Pause',
  next: 'Next',
  prev: 'Previous',
  vol_up: 'Volume up',
  vol_down: 'Volume down',
  find_phone: 'Find phone',
}

export function AppPage() {
  const { id = '' } = useParams()
  const installed = useInstalled()[id]
  const { catalogs, loading } = useCatalogs()
  const entry = catalogs.flatMap((c) => c.apps).find((a) => a.id === id)
  const runner = useRunner()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  const m = installed?.manifest ?? entry
  if (!m) {
    return loading ? (
      <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
    ) : (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-medium">App not found</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/">Back to the store</Link>
        </Button>
      </div>
    )
  }
  const manifest = installed?.manifest

  async function get() {
    if (!entry) return
    setBusy(true)
    try {
      await installFromCatalog(entry)
      toast.success(`${entry.name} installed`)
    } catch (e) {
      toast.error('Install failed', { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Store
      </Link>
      <div className="flex items-start gap-4">
        <AppIcon icon={m.icon} name={m.name} className="size-16 text-3xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{m.name}</h1>
          <p className="text-sm text-muted-foreground">
            {m.author ?? 'Unknown author'} · v{m.version}
            {installed && installed.origin !== 'store' && ` · ${installed.origin === 'sideload' ? 'sideloaded' : 'from playground'}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {m.tags?.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
            {manifest?.permissions?.includes('network') && (
              <Badge variant="outline" className="gap-1 font-normal">
                <Globe className="size-3" /> uses the internet
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          {installed ? (
            <RunPanel app={installed} />
          ) : (
            <div className="flex flex-col gap-3 rounded-3xl border bg-card p-6">
              <p className="text-sm text-muted-foreground">Install the app to run it on your watch or the simulator.</p>
              <Button disabled={busy} onClick={() => void get()}>
                {busy ? <Loader2 className="animate-spin" /> : <Download />} Get {m.name}
              </Button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <h2 className="mb-2 font-semibold">About</h2>
            <p className="text-muted-foreground">{m.description}</p>
          </section>

          {manifest?.buttons && Object.keys(manifest.buttons).length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Controls</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                {Object.entries(manifest.buttons).map(([b, what]) => (
                  <div key={b} className="contents">
                    <dt className="font-mono text-xs leading-5 text-muted-foreground uppercase">{BUTTON_LABEL[b] ?? b}</dt>
                    <dd>{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {manifest && (
            <section>
              <h2 className="mb-3 font-semibold">Settings</h2>
              <SettingsForm key={manifest.id + manifest.version} manifest={manifest} />
            </section>
          )}

          {installed && (
            <section>
              <LogPanel />
            </section>
          )}

          {installed && (
            <section className="flex flex-wrap gap-2 border-t pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([installed.source], { type: 'text/javascript' })
                  window.open(URL.createObjectURL(blob), '_blank')
                }}
              >
                View source
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={async () => {
                  if (runner.running?.id === id) await runner.stop()
                  uninstall(id)
                  toast.message(`${m.name} removed`)
                  nav('/library')
                }}
              >
                <Trash2 /> Uninstall
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
