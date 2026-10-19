import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCode, Link2, Loader2, ShieldAlert, TriangleAlert, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppIcon } from '@/components/store/AppIcon'
import { inspectSource, save, type Inspected } from '@/lib/store/actions'
import { fetchModuleSource } from '@/lib/store/catalog'
import { getInstalled } from '@/lib/store/installed'

export function SideloadPage() {
  const nav = useNavigate()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<(Inspected & { from?: string }) | null>(null)
  const [drag, setDrag] = useState(false)

  async function check(load: () => Promise<string>, from?: string) {
    setBusy(true)
    setError(null)
    setFound(null)
    try {
      setFound({ ...(await inspectSource(await load())), from })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const fromFile = (f?: File) => f && void check(() => f.text())

  const existing = found && getInstalled(found.manifest.id)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sideload an app</h1>
        <p className="text-sm text-muted-foreground">
          Install an app that isn't in a store: a <code>.js</code> file from a friend, a GitHub raw URL, or your own build.
        </p>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          fromFile(e.dataTransfer.files[0])
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center transition hover:border-foreground/30 ${drag ? 'border-brand bg-brand/5' : ''}`}
      >
        <Upload className="size-6 text-muted-foreground" />
        <span className="font-medium">Drop an app file here, or click to choose</span>
        <span className="text-xs text-muted-foreground">One ES module (.js or .mjs) that exports a manifest</span>
        <input type="file" accept=".js,.mjs,text/javascript" className="sr-only" onChange={(e) => fromFile(e.target.files?.[0])} />
      </label>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (url.trim()) void check(() => fetchModuleSource(url.trim()), url.trim())
        }}
      >
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" type="url" placeholder="https://raw.githubusercontent.com/you/app/main/app.js" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <FileCode />} Check
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>This isn't a valid app</AlertTitle>
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

      {found && (
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <AppIcon icon={found.manifest.icon} name={found.manifest.name} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{found.manifest.name}</p>
              <p className="text-xs text-muted-foreground">
                {found.manifest.id} · v{found.manifest.version} · {found.manifest.author ?? 'unknown author'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{found.manifest.description}</p>
            </div>
          </div>
          {found.warnings.map((w) => (
            <p key={w} className="flex items-center gap-2 text-sm text-amber-300">
              <TriangleAlert className="size-4 shrink-0" /> {w}
            </p>
          ))}
          <p className="flex gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-4 shrink-0" />
            Apps run in a sandboxed worker. They can't reach your pairing key, other apps or this page, but they can use
            the internet. Only install code you trust.
          </p>
          <Button
            onClick={() => {
              const app = save(found.manifest, found.source, 'sideload', found.from)
              trackEvent(existing ? `app/sideload/replace/${app.manifest.id}` : `app/sideload/${app.manifest.id}`)
              toast.success(`${app.manifest.name} ${existing ? 'replaced' : 'installed'}`)
              nav(`/app/${app.manifest.id}`)
            }}
          >
            {existing ? `Replace installed v${existing.manifest.version}` : 'Install'}
          </Button>
        </div>
      )}
    </div>
  )
}
