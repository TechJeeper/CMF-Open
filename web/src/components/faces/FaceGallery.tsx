import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, RotateCcw, Send, Sparkles, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/analytics'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { ClockOverlay, type ClockSpec } from '@/components/watch/surfaces'
import { WatchPreview } from '@/components/watch/WatchPreview'
import { fetchFaces, loadFaceSettings, renderFace, saveFaceSettings } from '@/lib/faces/render'
import { faceDefaults, type FaceEntry, type FaceValues } from '@/lib/faces/types'
import { build, fromRgb565, toRgb565, type Rgba } from '@/lib/watchface/photo'
import { hexTo565 } from '@/lib/watchface/render'
import { cn } from '@/lib/utils'
import { useWatch } from '@/state/watch-context'

const CLOCK_KEY = '__clock'

type Rendered = { full: Rgba; thumb: Rgba }

function clockFor(face: FaceEntry, values: FaceValues): ClockSpec {
  try {
    return { ...face.clock, ...(JSON.parse(String(values[CLOCK_KEY] ?? '{}')) as Partial<ClockSpec>) }
  } catch {
    return face.clock
  }
}

/** A rendered face with an approximation of the watch's clock on top. */
function FaceView({ image, clock, exact, className }: { image: Rgba | null; clock: ClockSpec; exact?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !image) return
    // `exact` shows the RGB565 colours and round mask the watch will really display.
    const shown = exact ? fromRgb565(toRgb565(image), image.width, image.height) : image
    c.width = shown.width
    c.height = shown.height
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(shown.data), shown.width, shown.height), 0, 0)
  }, [image, exact])
  return (
    <div className={cn('relative aspect-square overflow-hidden rounded-full bg-neutral-900 [container-type:size]', className)}>
      {image ? (
        <>
          <canvas ref={ref} className="size-full" />
          <ClockOverlay clock={clock} />
        </>
      ) : (
        <div className="grid size-full place-items-center">
          <Loader2 className="size-5 animate-spin text-white/40" />
        </div>
      )}
    </div>
  )
}

function FaceCard({ face, onOpen }: { face: FaceEntry; onOpen: () => void }) {
  const [img, setImg] = useState<Rgba | null>(null)
  const [error, setError] = useState<string | null>(null)
  const values = useMemo(() => loadFaceSettings(face.id, faceDefaults(face)), [face])
  useEffect(() => {
    let live = true
    renderFace(face.url, values)
      .then((r) => live && setImg(r.full))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [face, values])
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-foreground/30 hover:bg-secondary/40"
    >
      <div className="relative mx-auto w-full max-w-[13rem] rounded-full bg-gradient-to-b from-neutral-600 to-neutral-900 p-[5%] shadow-xl shadow-black/40 transition group-hover:scale-[1.02]">
        {error ? (
          <div className="grid aspect-square place-items-center rounded-full bg-neutral-900 p-6 text-center text-xs text-red-300">{error}</div>
        ) : (
          <FaceView image={img} clock={clockFor(face, values)} />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{face.name}</span>
          {face.live && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Sparkles className="size-3" /> Live
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{face.description}</p>
      </div>
    </button>
  )
}

function FaceEditor({ face, onBack }: { face: FaceEntry; onBack: () => void }) {
  const w = useWatch()
  const [values, setValues] = useState<FaceValues>(() => loadFaceSettings(face.id, faceDefaults(face)))
  const [rendered, setRendered] = useState<Rendered | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const clock = clockFor(face, values)

  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      renderFace(face.url, values)
        .then((r) => {
          if (!live) return
          setRendered(r)
          setError(null)
        })
        .catch((e: Error) => live && setError(e.message))
    }, 150)
    saveFaceSettings(face.id, values)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [face, values])

  const set = (k: string, v: string | number | boolean) => setValues((s) => ({ ...s, [k]: v }))
  const setClock = (patch: Partial<ClockSpec>) => set(CLOCK_KEY, JSON.stringify({ ...clock, ...patch }))

  // Live faces are redrawn at install time so "today" really is today.
  async function freshBlob() {
    const r = face.live ? await renderFace(face.url, values) : rendered
    if (!r) throw new Error('the face has not rendered yet')
    return build(r.full, r.thumb)
  }

  async function install() {
    if (!w.session) return w.setConnectOpen(true)
    setProgress(0)
    try {
      const ok = await w.session.uploadPhotoDial(await freshBlob(), {
        style: clock.style,
        x: clock.x,
        y: clock.y,
        color565: hexTo565(clock.color),
        progress: (d, t) => setProgress(Math.round((d / t) * 100)),
      })
      if (ok) {
        trackEvent(`watchface/install/${face.id}`)
        toast.success(`${face.name} installed`, face.live ? { description: 'Reinstall it to refresh its live data.' } : undefined)
      } else {
        trackEvent('watchface/install/rejected')
        toast.error('The watch rejected the watchface')
      }
    } catch (e) {
      trackEvent('watchface/install/error')
      toast.error('Upload failed', { description: (e as Error).message })
    } finally {
      setProgress(null)
    }
  }

  async function download() {
    try {
      const data = await freshBlob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>]))
      a.download = `${face.id}.bin`
      a.click()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        <ArrowLeft /> All watchfaces
      </Button>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card p-5">
          <div className="w-full max-w-sm rounded-full bg-gradient-to-b from-neutral-600 via-neutral-800 to-neutral-900 p-[5%] shadow-2xl shadow-black/60">
            <FaceView image={rendered?.full ?? null} clock={clock} exact />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Exact colours as the watch shows them. The clock is an approximation of the watch's own style {clock.style + 1}.
          </p>
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>This face failed to draw</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex flex-col gap-5 rounded-3xl border bg-card p-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{face.name}</h2>
              {face.live && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="size-3" /> Live
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{face.description}</p>
            {face.live && <p className="text-xs text-muted-foreground">Uses: {face.live}. Reinstall to refresh it.</p>}
          </div>

          {(face.settings ?? []).map((s) => {
            const id = `face-${s.key}`
            const v = values[s.key]
            return (
              <div key={s.key} className="flex flex-col gap-1.5">
                {s.type === 'boolean' ? (
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={id}>{s.label}</Label>
                    <Switch id={id} checked={Boolean(v)} onCheckedChange={(c) => set(s.key, c)} />
                  </div>
                ) : s.type === 'color' ? (
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={id}>{s.label}</Label>
                    <input
                      id={id}
                      type="color"
                      value={String(v)}
                      onChange={(e) => set(s.key, e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border bg-transparent"
                    />
                  </div>
                ) : (
                  <>
                    <Label htmlFor={id}>{s.label}</Label>
                    <Input
                      id={id}
                      type={s.type === 'number' ? 'number' : 'text'}
                      step="any"
                      value={String(v ?? '')}
                      onChange={(e) => set(s.key, s.type === 'number' ? Number(e.target.value) : e.target.value)}
                    />
                  </>
                )}
                {s.help && <p className="text-xs text-muted-foreground">{s.help}</p>}
              </div>
            )
          })}

          <div className="flex flex-col gap-3 border-t pt-4">
            <Label>Watch clock</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((st) => (
                <Button key={st} size="sm" variant={clock.style === st ? 'default' : 'outline'} onClick={() => setClock({ style: st })}>
                  {st + 1}
                </Button>
              ))}
              <input
                aria-label="Clock colour"
                type="color"
                value={clock.color}
                onChange={(e) => setClock({ color: e.target.value })}
                className="ml-2 h-8 w-12 cursor-pointer rounded border bg-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['x', 'y'] as const).map((k) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <Label htmlFor={`clock-${k}`}>Clock {k.toUpperCase()} (0-466)</Label>
                  <Input
                    id={`clock-${k}`}
                    type="number"
                    min={0}
                    max={466}
                    value={clock[k]}
                    onChange={(e) => setClock({ [k]: Math.max(0, Math.min(466, Number(e.target.value) || 0)) })}
                  />
                </div>
              ))}
            </div>
          </div>

          {progress !== null && <Progress value={progress} />}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!rendered || progress !== null} onClick={() => void install()}>
              {progress !== null ? <Loader2 className="animate-spin" /> : <Send />}
              {w.session ? `Install on ${w.mode === 'sim' ? 'simulator' : 'watch'}` : 'Connect to install'}
            </Button>
            <Button variant="outline" disabled={!rendered} onClick={() => void download()}>
              <Download /> Download .bin
            </Button>
            <Button variant="ghost" onClick={() => setValues(faceDefaults(face))}>
              <RotateCcw /> Reset
            </Button>
          </div>
          {w.mode === 'sim' && <WatchPreview />}
        </div>
      </div>
    </div>
  )
}

export function FaceGallery() {
  const [faces, setFaces] = useState<FaceEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const openId = params.get('face')

  useEffect(() => {
    fetchFaces()
      .then(setFaces)
      .catch((e: Error) => setError(e.message))
  }, [])

  const tags = useMemo(() => [...new Set((faces ?? []).flatMap((f) => f.tags ?? []))].sort(), [faces])
  const open = faces?.find((f) => f.id === openId)
  const select = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('face', id)
    else next.delete('face')
    setParams(next)
    window.scrollTo({ top: 0 })
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Couldn't load the watchface gallery</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  if (open) return <FaceEditor key={open.id} face={open} onBack={() => select(null)} />

  const shown = (faces ?? []).filter((f) => !tag || f.tags?.includes(tag))
  return (
    <div className="flex flex-col gap-5">
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
      {faces === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border bg-card" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((f) => (
            <FaceCard key={f.id} face={f} onOpen={() => select(f.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
