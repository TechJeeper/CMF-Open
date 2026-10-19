import { useEffect, useRef, useState } from 'react'
import { Download, ImageUp, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { WatchPreview } from '@/components/watch/WatchPreview'
import { build, SCREEN, THUMB, toRgb565, fromRgb565 } from '@/lib/watchface/photo'
import { hexTo565, renderCrop, type Crop } from '@/lib/watchface/render'
import { useWatch } from '@/state/watch-context'
import { FaceGallery } from '@/components/faces/FaceGallery'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function PhotoFace() {
  const w = useWatch()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 })
  const [style, setStyle] = useState(0)
  const [color, setColor] = useState('#ffffff')
  const [progress, setProgress] = useState<number | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c || !img) return
    const full = renderCrop(img, SCREEN, crop)
    // Show what the watch will actually display: RGB565 with the round mask applied.
    const shown = fromRgb565(toRgb565(full), SCREEN, SCREEN)
    c.width = c.height = SCREEN
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(shown.data), SCREEN, SCREEN), 0, 0)
  }, [img, crop])

  function load(file?: File) {
    if (!file) return
    const i = new Image()
    i.onload = () => {
      setImg(i)
      setCrop({ zoom: 1, x: 0, y: 0 })
    }
    i.onerror = () => toast.error("That file isn't an image the browser can read")
    i.src = URL.createObjectURL(file)
  }

  const blob = () => (img ? build(renderCrop(img, SCREEN, crop), renderCrop(img, THUMB, crop)) : null)

  async function install() {
    const data = blob()
    if (!data || !w.session) return
    setProgress(0)
    try {
      const ok = await w.session.uploadPhotoDial(data, {
        style,
        color565: hexTo565(color),
        progress: (d, t) => setProgress(Math.round((d / t) * 100)),
      })
      if (ok) toast.success('Watchface installed')
      else toast.error('The watch rejected the watchface')
    } catch (e) {
      toast.error('Upload failed', { description: (e as Error).message })
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Any image becomes a 466 × 466 watchface. The watch draws its own clock on top. Encoding happens in your browser.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
          {img ? (
            <canvas
              ref={canvas}
              className="mx-auto aspect-square w-full max-w-sm cursor-grab touch-none rounded-full active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y }
              }}
              onPointerMove={(e) => {
                const d = drag.current
                if (!d) return
                const size = e.currentTarget.clientWidth
                setCrop((c) => ({ ...c, x: d.cx + (e.clientX - d.x) / size, y: d.cy + (e.clientY - d.y) / size }))
              }}
              onPointerUp={() => (drag.current = null)}
            />
          ) : (
            <label className="mx-auto flex aspect-square w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-2 rounded-full border border-dashed text-center transition hover:border-foreground/30">
              <ImageUp className="size-7 text-muted-foreground" />
              <span className="font-medium">Choose a photo</span>
              <span className="text-xs text-muted-foreground">JPG, PNG, WebP…</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
            </label>
          )}
          {img && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="zoom">Zoom (drag the image to move it)</Label>
                <input id="zoom" type="range" min={1} max={4} step={0.01} value={crop.zoom}
                  onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))} className="accent-[var(--brand)]" />
              </div>
              <label className="w-fit cursor-pointer text-sm text-muted-foreground underline">
                Choose another photo
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
              </label>
            </>
          )}
        </div>

        <div className="flex flex-col gap-5 rounded-3xl border bg-card p-5">
          <div className="flex flex-col gap-2">
            <Label>Built-in clock style</Label>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((s) => (
                <Button key={s} size="sm" variant={style === s ? 'default' : 'outline'} onClick={() => setStyle(s)}>
                  {s + 1}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="clock-color">Clock colour</Label>
            <input id="clock-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded border bg-transparent" />
          </div>
          {progress !== null && <Progress value={progress} />}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!img || progress !== null} onClick={() => (w.session ? void install() : w.setConnectOpen(true))}>
              {progress !== null ? <Loader2 className="animate-spin" /> : <Send />}
              {w.session ? `Install on ${w.mode === 'sim' ? 'simulator' : 'watch'}` : 'Connect to install'}
            </Button>
            <Button
              variant="outline"
              disabled={!img}
              onClick={() => {
                const data = blob()
                if (!data) return
                const a = document.createElement('a')
                a.href = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>]))
                a.download = 'watchface.bin'
                a.click()
              }}
            >
              <Download /> Download .bin
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The <code>.bin</code> also works with <code>cmfkit watchface install</code>. On the simulator, the face shows
            on the Clock tab below.
          </p>
          {w.mode === 'sim' && <WatchPreview />}
        </div>
      </div>
    </div>
  )
}

export function WatchfacesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Watchfaces</h1>
        <p className="text-sm text-muted-foreground">
          Generative and live faces drawn in your browser, or any photo. Customise one, then install it over Bluetooth.
        </p>
      </div>
      <Tabs defaultValue="gallery">
        <TabsList>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="photo">From a photo</TabsTrigger>
        </TabsList>
        <TabsContent value="gallery" className="pt-4">
          <FaceGallery />
        </TabsContent>
        <TabsContent value="photo" className="pt-4">
          <PhotoFace />
        </TabsContent>
      </Tabs>
    </div>
  )
}
