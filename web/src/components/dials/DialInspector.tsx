import { useState } from 'react'
import { ChevronRight, Clock, FileQuestion, Heart, Battery, Footprints, Thermometer, Gauge, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getDataSources,
  getHands,
  getProgressArcs,
  isStructuredDial,
  parseStructuredDial,
  summarizeDial,
  type StructuredDial,
  type Widget,
} from '@/lib/watchface/structured'

const SOURCE_ICONS: Record<string, typeof Heart> = {
  heart_rate: Heart,
  steps: Footprints,
  steps_alt: Footprints,
  battery: Battery,
  battery_pct: Battery,
  temperature: Thermometer,
  temperature_alt: Thermometer,
}

function WidgetNode({ widget, depth = 0 }: { widget: Widget; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = widget.children && widget.children.length > 0

  const Icon = widget.sourceName ? SOURCE_ICONS[widget.sourceName] ?? Gauge : undefined

  return (
    <div className="text-sm">
      <button
        className={cn(
          'flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-muted/50',
          hasChildren && 'cursor-pointer',
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (
          <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
        ) : (
          <span className="w-3.5" />
        )}
        <span className={cn('font-mono', widget.tag <= 0x22 ? 'text-blue-400' : 'text-muted-foreground')}>
          {widget.tagName}
        </span>
        {widget.x !== undefined && widget.y !== undefined && (
          <span className="text-xs text-muted-foreground">
            ({widget.x}, {widget.y})
          </span>
        )}
        {widget.sourceName && (
          <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">
            {Icon && <Icon className="size-3" />}
            {widget.sourceName.replace(/_/g, ' ')}
          </span>
        )}
        {widget.pivot && (
          <span className="text-xs text-amber-400">
            pivot({widget.pivot.x}, {widget.pivot.y})
          </span>
        )}
        {widget.arc && (
          <span className="text-xs text-purple-400">
            arc {widget.arc.min}–{widget.arc.max}
          </span>
        )}
      </button>
      {open && hasChildren && widget.children!.map((c, i) => <WidgetNode key={i} widget={c} depth={depth + 1} />)}
    </div>
  )
}

function DialSummary({ dial }: { dial: StructuredDial }) {
  const sources = getDataSources(dial)
  const hands = getHands(dial)
  const arcs = getProgressArcs(dial)

  const liveData = sources.filter((s) =>
    ['heart_rate', 'steps', 'steps_alt', 'battery', 'battery_pct', 'calories', 'temperature'].includes(s.name),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">{dial.header.name || 'Unnamed Dial'}</h3>
        <p className="text-sm text-muted-foreground">{summarizeDial(dial)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-2xl font-bold">{hands.length}</div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" /> Analog hands
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-2xl font-bold">{liveData.length}</div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Heart className="size-4" /> Live data bindings
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-2xl font-bold">{arcs.length}</div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Gauge className="size-4" /> Progress arcs
          </div>
        </div>
      </div>

      {liveData.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Live data sources</h4>
          <div className="flex flex-wrap gap-2">
            {liveData.map((s, i) => {
              const Icon = SOURCE_ICONS[s.name] ?? Gauge
              return (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-400"
                >
                  <Icon className="size-4" />
                  {s.name.replace(/_/g, ' ')}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Resources</h4>
        <p className="text-sm text-muted-foreground">
          {dial.resources.length} images, {dial.resources.filter((r) => r.format === 5).length} with alpha
        </p>
      </div>
    </div>
  )
}

export function DialInspector() {
  const [dial, setDial] = useState<StructuredDial | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'summary' | 'tree'>('summary')

  async function handleFile(file: File) {
    setError(null)
    setDial(null)
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      if (!isStructuredDial(data)) {
        setError('This is not a structured dial file (version mismatch or photo dial).')
        return
      }
      const parsed = parseStructuredDial(data)
      setDial(parsed)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Inspect Structured Dial</h2>
        <p className="text-sm text-muted-foreground">
          Drop a <code>.bin</code> watchface file to see its widget tree, live data bindings, and resources.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-muted-foreground/30 p-8 transition hover:border-muted-foreground/50">
        <Upload className="size-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Drop .bin file or click to browse</span>
        <input
          type="file"
          accept=".bin"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
          }}
        />
      </label>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          <FileQuestion className="size-5 shrink-0" />
          {error}
        </div>
      )}

      {dial && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 border-b">
            <Button
              variant={tab === 'summary' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab('summary')}
              className="rounded-b-none"
            >
              Summary
            </Button>
            <Button
              variant={tab === 'tree' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab('tree')}
              className="rounded-b-none"
            >
              Widget Tree
            </Button>
          </div>

          {tab === 'summary' && <DialSummary dial={dial} />}

          {tab === 'tree' && (
            <div className="max-h-[400px] overflow-auto rounded-lg border bg-black/30 p-2">
              <WidgetNode widget={dial.tree} />
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Dial ID: <code>{dial.header.dialId.toString(16).padStart(8, '0')}</code> · Version:{' '}
            <code>{dial.header.version}</code> · Size: {(dial.raw.length / 1024).toFixed(1)} KB
          </div>
        </div>
      )}
    </div>
  )
}
