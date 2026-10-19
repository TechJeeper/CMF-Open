import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Download, Loader2, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'
import { installFromCatalog } from '@/lib/store/actions'
import type { CatalogEntry } from '@/lib/store/catalog'
import { compareVersions, type InstalledApp } from '@/lib/store/installed'
import { useRunner } from '@/state/runner-context'
import { AppIcon } from './AppIcon'

export function AppCard({ entry, installed }: { entry: CatalogEntry; installed?: InstalledApp }) {
  const runner = useRunner()
  const [busy, setBusy] = useState(false)
  const update = installed && compareVersions(entry.version, installed.manifest.version) > 0
  const isRunning = runner.running?.id === entry.id

  async function get() {
    setBusy(true)
    try {
      const app = await installFromCatalog(entry)
      trackEvent(update ? `app/update/${entry.id}` : `app/install/${entry.id}`)
      toast.success(`${app.manifest.name} ${update ? 'updated' : 'installed'}`)
    } catch (e) {
      trackEvent(`app/install/${entry.id}/error`)
      toast.error(`Couldn't install ${entry.name}`, { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border bg-card p-4 transition hover:border-foreground/20">
      <div className="flex items-start gap-3">
        <AppIcon icon={entry.icon} name={entry.name} />
        <div className="min-w-0 flex-1">
          <Link to={`/app/${entry.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">
            {entry.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {entry.author ?? 'Unknown'} · v{entry.version}
          </p>
        </div>
      </div>
      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{entry.description}</p>
      <div className="mt-auto flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {entry.tags?.slice(0, 2).map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
        </div>
        <div className="relative z-10 flex gap-1.5">
          {installed && !update ? (
            <Button size="sm" variant={isRunning ? 'secondary' : 'default'} onClick={() => void runner.run(installed)}>
              {isRunning ? <Check /> : <Play />} {isRunning ? 'Running' : 'Run'}
            </Button>
          ) : (
            <Button size="sm" variant={update ? 'secondary' : 'default'} disabled={busy} onClick={() => void get()}>
              {busy ? <Loader2 className="animate-spin" /> : update ? <RefreshCw /> : <Download />}
              {update ? 'Update' : 'Get'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
