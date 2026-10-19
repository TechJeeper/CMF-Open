import { useRef, useState, useEffect } from 'react'
import { Download, Loader2, Send, Upload, Watch } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import {
  buildStructuredDial,
  createAnalogHandImage,
  SOURCE_HOUR_ANGLE,
  SOURCE_MINUTE_ANGLE,
  SOURCE_SECOND_ANGLE,
  type HandConfig,
} from '@/lib/watchface/builder'
import type { Rgba } from '@/lib/watchface/photo'
import { useWatch } from '@/state/watch-context'

interface HandSettings {
  enabled: boolean
  color: string
  length: number
  width: number
}

const DEFAULT_HANDS: Record<string, HandSettings> = {
  hour: { enabled: true, color: '#ffffff', length: 100, width: 16 },
  minute: { enabled: true, color: '#ffffff', length: 150, width: 12 },
  second: { enabled: true, color: '#ff4444', length: 170, width: 4 },
}

export function DialBuilder() {
  const w = useWatch()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const [background, setBackground] = useState<Rgba | null>(null)
  const [bgColor, setBgColor] = useState('#1a1a2e')
  const [name, setName] = useState('Custom Dial')
  const [hands, setHands] = useState(DEFAULT_HANDS)
  const [progress, setProgress] = useState<number | null>(null)
  const [building, setBuilding] = useState(false)
  const [previewTime, setPreviewTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setPreviewTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    drawPreview()
  }, [background, bgColor, hands, previewTime])

  function drawPreview() {
    const canvas = previewRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = 466
    canvas.width = size
    canvas.height = size
    const cx = size / 2
    const cy = size / 2

    ctx.fillStyle = bgColor
    ctx.beginPath()
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
    ctx.fill()

    if (background) {
      const img = new ImageData(new Uint8ClampedArray(background.data), background.width, background.height)
      ctx.putImageData(img, 0, 0)
    }

    const h = previewTime.getHours() % 12
    const m = previewTime.getMinutes()
    const s = previewTime.getSeconds()

    const drawHand = (angle: number, length: number, width: number, color: string) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(-width / 2, -length, width, length + 10, width / 2)
      ctx.fill()
      ctx.restore()
    }

    if (hands.hour.enabled) {
      const hourAngle = ((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2 + Math.PI / 2
      drawHand(hourAngle, hands.hour.length, hands.hour.width, hands.hour.color)
    }
    if (hands.minute.enabled) {
      const minAngle = ((m + s / 60) / 60) * Math.PI * 2 - Math.PI / 2 + Math.PI / 2
      drawHand(minAngle, hands.minute.length, hands.minute.width, hands.minute.color)
    }
    if (hands.second.enabled) {
      const secAngle = (s / 60) * Math.PI * 2 - Math.PI / 2 + Math.PI / 2
      drawHand(secAngle, hands.second.length, hands.second.width, hands.second.color)
    }

    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.arc(cx, cy, 8, 0, Math.PI * 2)
    ctx.fill()
  }

  async function handleBackgroundUpload(file: File) {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await new Promise((resolve) => (img.onload = resolve))

    const canvas = document.createElement('canvas')
    canvas.width = 466
    canvas.height = 466
    const ctx = canvas.getContext('2d')!

    const scale = Math.max(466 / img.width, 466 / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (466 - w) / 2, (466 - h) / 2, w, h)

    const imageData = ctx.getImageData(0, 0, 466, 466)
    setBackground({ width: 466, height: 466, data: imageData.data })
    URL.revokeObjectURL(img.src)
  }

  function buildBackgroundFromColor(): Rgba {
    const canvas = document.createElement('canvas')
    canvas.width = 466
    canvas.height = 466
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, 466, 466)

    const imageData = ctx.getImageData(0, 0, 466, 466)
    return { width: 466, height: 466, data: imageData.data }
  }

  function buildHandImages(): HandConfig[] {
    const configs: HandConfig[] = []
    const canvas = canvasRef.current
    if (!canvas) return configs
    const ctx = canvas.getContext('2d')
    if (!ctx) return configs

    const handDefs: Array<{ key: string; sourceId: number }> = [
      { key: 'hour', sourceId: SOURCE_HOUR_ANGLE },
      { key: 'minute', sourceId: SOURCE_MINUTE_ANGLE },
      { key: 'second', sourceId: SOURCE_SECOND_ANGLE },
    ]

    for (const { key, sourceId } of handDefs) {
      const settings = hands[key]
      if (!settings.enabled) continue

      const width = settings.width * 3
      const height = settings.length + 30
      const pivotX = width / 2
      const pivotY = height - 15

      const handImage = createAnalogHandImage(ctx, width, height, settings.color)
      configs.push({ image: handImage, pivotX, pivotY, sourceId })
    }

    return configs
  }

  async function build(): Promise<Uint8Array> {
    setBuilding(true)
    try {
      const bg = background ?? buildBackgroundFromColor()
      const handConfigs = buildHandImages()
      const dialId = Math.floor(Math.random() * 0xffffffff)

      return buildStructuredDial({
        name: name.slice(0, 15),
        dialId,
        background: bg,
        hands: handConfigs,
      })
    } finally {
      setBuilding(false)
    }
  }

  async function download() {
    try {
      const data = await build()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>]))
      a.download = `${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.bin`
      a.click()
      toast.success('Downloaded watchface')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function install() {
    if (!w.session) return w.setConnectOpen(true)

    try {
      const dials = await w.session.listDials()
      if (dials.length === 0) {
        toast.error('No dials on watch to replace')
        return
      }

      const data = await build()
      setProgress(0)

      const targetId = dials[dials.length - 1].id
      const ok = await w.session.uploadStructuredDial(data, targetId, {
        progress: (d, t) => setProgress(Math.round((d / t) * 100)),
      })

      if (ok) {
        toast.success('Animated watchface installed!')
      } else {
        toast.error('Watch rejected the watchface')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setProgress(null)
    }
  }

  const setHandProp = (hand: string, prop: keyof HandSettings, value: HandSettings[keyof HandSettings]) => {
    setHands((h) => ({ ...h, [hand]: { ...h[hand], [prop]: value } }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Animated Dial Builder</h2>
        <p className="text-sm text-muted-foreground">
          Create watchfaces with firmware-animated rotating hands. These animate on the actual watch!
        </p>
      </div>

      <Alert className="border-emerald-800/50 bg-emerald-950/30">
        <Watch className="size-4 text-emerald-500" />
        <AlertDescription className="text-emerald-200/80">
          <strong>Real animation:</strong> Unlike photo dials, structured dials have hands that rotate smoothly on the watch firmware. The hour, minute, and second hands move in real-time.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dial-name">Watchface Name</Label>
            <Input id="dial-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={15} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border bg-transparent"
              />
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-foreground/50">
                <Upload className="size-4" />
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleBackgroundUpload(f)
                  }}
                />
              </label>
            </div>
          </div>

          {(['hour', 'minute', 'second'] as const).map((hand) => (
            <div key={hand} className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
              <div className="flex items-center justify-between">
                <Label className="capitalize">{hand} Hand</Label>
                <Switch checked={hands[hand].enabled} onCheckedChange={(c) => setHandProp(hand, 'enabled', c)} />
              </div>
              {hands[hand].enabled && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Label className="w-16 text-xs">Color</Label>
                    <input
                      type="color"
                      value={hands[hand].color}
                      onChange={(e) => setHandProp(hand, 'color', e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border bg-transparent"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="w-16 text-xs">Length</Label>
                    <input
                      type="range"
                      value={hands[hand].length}
                      onChange={(e) => setHandProp(hand, 'length', Number(e.target.value))}
                      min={50}
                      max={200}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-8 text-xs text-muted-foreground">{hands[hand].length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="w-16 text-xs">Width</Label>
                    <input
                      type="range"
                      value={hands[hand].width}
                      onChange={(e) => setHandProp(hand, 'width', Number(e.target.value))}
                      min={2}
                      max={24}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-8 text-xs text-muted-foreground">{hands[hand].width}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {progress !== null && <Progress value={progress} />}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void install()} disabled={building || progress !== null}>
              {progress !== null ? <Loader2 className="animate-spin" /> : <Send />}
              {w.session ? 'Install on watch' : 'Connect to install'}
            </Button>
            <Button variant="outline" onClick={() => void download()} disabled={building}>
              <Download /> Download .bin
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-sm rounded-full bg-gradient-to-b from-neutral-600 via-neutral-800 to-neutral-900 p-[5%] shadow-2xl shadow-black/60">
            <canvas ref={previewRef} className="size-full rounded-full" style={{ imageRendering: 'auto' }} />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Live preview — hands animate in real-time on the watch
          </p>
        </div>
      </div>

      <canvas ref={canvasRef} className="sr-only" />
    </div>
  )
}
