import { Loader2, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonPad } from '@/components/watch/ButtonPad'
import { WatchPreview } from '@/components/watch/WatchPreview'
import type { InstalledApp } from '@/lib/store/installed'
import { useRunner } from '@/state/runner-context'
import { useWatch } from '@/state/watch-context'

/** Watch preview, run/stop and the button pad for one app. */
export function RunPanel({ app }: { app: InstalledApp }) {
  const r = useRunner()
  const w = useWatch()
  const isRunning = r.running?.id === app.manifest.id
  const other = r.running && !isRunning ? r.running : null

  return (
    <div className="flex flex-col gap-5 rounded-3xl border bg-card p-5">
      <WatchPreview onPress={isRunning ? r.press : undefined} />
      <div className="flex flex-col gap-2">
        {isRunning ? (
          <Button variant="secondary" onClick={() => void r.stop()}>
            <Square className="fill-current" /> Stop {app.manifest.name}
          </Button>
        ) : (
          <Button disabled={r.starting} onClick={() => void r.run(app)}>
            {r.starting ? <Loader2 className="animate-spin" /> : <Play />}
            {w.status === 'connected' ? `Run on ${w.mode === 'sim' ? 'simulator' : 'watch'}` : 'Connect & run'}
          </Button>
        )}
        {other && <p className="text-center text-xs text-muted-foreground">Starting this stops {other.name}.</p>}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {w.mode === 'sim'
            ? 'These buttons act as the watch: each press travels through the simulated Bluetooth link.'
            : 'Press the media controls on your watch, or use these buttons.'}
        </p>
        <ButtonPad manifest={app.manifest} onPress={r.press} disabled={!isRunning} />
      </div>
    </div>
  )
}
