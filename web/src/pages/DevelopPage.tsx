import { useState } from 'react'
import { BookOpen, Download, Loader2, Play, RotateCcw, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiReference } from '@/components/apps/ApiReference'
import { LogPanel } from '@/components/apps/LogPanel'
import { DialInspector } from '@/components/dials/DialInspector'
import { ButtonPad } from '@/components/watch/ButtonPad'
import { WatchPreview } from '@/components/watch/WatchPreview'
import { TEMPLATE } from '@/lib/apps/template'
import { inspectSource, save } from '@/lib/store/actions'
import { useRunner } from '@/state/runner-context'

const DRAFT_KEY = 'cmf.playground.v1'
const REPO = import.meta.env.VITE_REPO_URL as string | undefined

export function DevelopPage() {
  const r = useRunner()
  const [code, setCode] = useState(() => localStorage.getItem(DRAFT_KEY) ?? TEMPLATE)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [appId, setAppId] = useState<string | null>(null)

  const edit = (v: string) => {
    setCode(v)
    localStorage.setItem(DRAFT_KEY, v)
  }

  async function runIt() {
    setBusy(true)
    setError(null)
    try {
      const found = await inspectSource(code)
      setWarnings(found.warnings)
      const app = save(found.manifest, found.source, 'playground')
      setAppId(app.manifest.id)
      await r.run(app, { simulateIfDisconnected: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function download() {
    const id = /id:\s*['"]([\w-]+)['"]/.exec(code)?.[1] ?? 'app'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    a.download = `${id}.js`
    a.click()
  }

  const isRunning = !!appId && r.running?.id === appId

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Develop</h1>
        <p className="text-sm text-muted-foreground">
          Write apps, inspect structured watchfaces, and test on the simulator or your real watch.
        </p>
      </div>

      <Tabs defaultValue="apps" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="apps">App Playground</TabsTrigger>
          <TabsTrigger value="dials">Dial Inspector</TabsTrigger>
        </TabsList>

        <TabsContent value="apps">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,21rem)]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runIt()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />} {isRunning ? 'Restart' : 'Run'}
            </Button>
            <Button variant="outline" onClick={download}>
              <Download /> Download .js
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                edit(TEMPLATE)
                toast.message('Template restored')
              }}
            >
              <RotateCcw /> Template
            </Button>
          </div>
          <textarea
            aria-label="App source code"
            spellCheck={false}
            value={code}
            onChange={(e) => edit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return
              e.preventDefault()
              const t = e.currentTarget
              const { selectionStart: s, selectionEnd: end } = t
              edit(code.slice(0, s) + '  ' + code.slice(end))
              requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2))
            }}
            className="min-h-[28rem] w-full resize-y rounded-2xl border bg-black/50 p-4 font-mono text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:min-h-[38rem]"
          />
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Can't run this yet</AlertTitle>
              <AlertDescription className="font-mono text-xs whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}
          {warnings.map((w) => (
            <p key={w} className="flex items-center gap-2 text-sm text-amber-300">
              <TriangleAlert className="size-4 shrink-0" /> {w}
            </p>
          ))}
          <LogPanel />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
            <WatchPreview onPress={isRunning ? r.press : undefined} />
            <ButtonPad manifest={isRunning ? r.running : null} onPress={r.press} disabled={!isRunning} />
          </div>
          <div className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <BookOpen className="size-4" /> API
            </h2>
            <ApiReference />
            <p className="text-xs text-muted-foreground">
              Strings are UTF-8 and cut to the byte budget. Apps run in a Web Worker, so <code>fetch</code>, timers and
              <code> crypto</code> work but the DOM doesn't.
              {REPO && (
                <>
                  {' '}
                  <a className="underline" href={`${REPO}/blob/main/docs/07-web-app-store.md`} target="_blank" rel="noreferrer">
                    Full developer guide
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="dials">
          <DialInspector />
        </TabsContent>
      </Tabs>
    </div>
  )
}
