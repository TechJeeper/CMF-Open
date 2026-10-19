import { Link } from 'react-router-dom'
import { Play, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppIcon } from '@/components/store/AppIcon'
import { useInstalled } from '@/hooks/useStore'
import { useRunner } from '@/state/runner-context'

const ORIGIN = { store: 'Store', sideload: 'Sideloaded', playground: 'Playground' }

export function LibraryPage() {
  const apps = Object.values(useInstalled()).sort((a, b) => b.installedAt - a.installedAt)
  const r = useRunner()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My apps</h1>
        <p className="text-sm text-muted-foreground">Installed in this browser. Each app's settings and saved data stay here too.</p>
      </div>
      {apps.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {apps.map((app) => {
            const m = app.manifest
            const running = r.running?.id === m.id
            return (
              <li key={m.id} className="flex items-center gap-3 p-4">
                <AppIcon icon={m.icon} name={m.name} className="size-10 text-xl" />
                <Link to={`/app/${m.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium hover:underline">{m.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    v{m.version} · {m.description}
                  </span>
                </Link>
                <Badge variant="outline" className="hidden font-normal sm:inline-flex">
                  {ORIGIN[app.origin]}
                </Badge>
                {running ? (
                  <Button size="sm" variant="secondary" onClick={() => void r.stop()}>
                    <Square className="fill-current" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void r.run(app)}>
                    <Play /> Run
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <p className="font-medium">No apps yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Get one from the store, sideload a file, or write one in the playground.</p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link to="/">Browse the store</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/sideload">Sideload</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
