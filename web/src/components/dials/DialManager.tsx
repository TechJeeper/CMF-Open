import { useState } from 'react'
import { GripVertical, Trash2, Loader2, RefreshCw, Check, X, Upload, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWatch } from '@/state/watch-context'
import type { DialInfo } from '@/lib/session'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const DIAL_TYPES: Record<number, string> = {
  0: 'Built-in',
  1: 'Custom',
  2: 'Photo',
  3: 'Structured',
}

export function DialManager() {
  const { session, status } = useWatch()
  const connected = status === 'connected'
  const [dials, setDials] = useState<DialInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  async function loadDials() {
    if (!session) return
    setBusy(true)
    try {
      const list = await session.listDials()
      setDials(list)
      setLoaded(true)
    } catch (e) {
      toast.error(`Failed to list dials: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function deleteDial(id: number) {
    if (!session || busy) return
    if (!confirm('Delete this dial? This cannot be undone.')) return
    setBusy(true)
    try {
      const ok = await session.deleteDial(id)
      if (ok) {
        toast.success('Dial deleted')
        await loadDials()
      } else {
        toast.error('Watch refused to delete dial')
      }
    } catch (e) {
      toast.error(`Failed to delete: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function uploadStructured() {
    if (!session || !selectedFile) return
    setBusy(true)
    setUploadProgress(0)
    try {
      const data = new Uint8Array(await selectedFile.arrayBuffer())
      const customDials = dials.filter((d) => d.type !== 0)
      if (customDials.length === 0) {
        toast.error('No custom dial slot to replace. Delete a dial first.')
        return
      }
      const targetId = customDials[0].id
      const ok = await session.uploadStructuredDial(data, targetId, {
        progress: (done, total) => setUploadProgress(Math.round((done / total) * 100)),
      })
      if (ok) {
        toast.success('Structured dial uploaded!')
        setSelectedFile(null)
        await loadDials()
      } else {
        toast.error('Watch rejected the dial')
      }
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      setUploadProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="size-5" /> Dial Manager
        </h2>
        <p className="text-sm text-muted-foreground">
          List, delete, and upload structured watchfaces to your watch.
        </p>
      </div>

      {!connected && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-400">
          Connect to a watch to manage dials.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!connected || busy} onClick={() => void loadDials()}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-4" />}
          {loaded ? 'Refresh' : 'Load Dials'}
        </Button>
      </div>

      {loaded && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">{dials.length} dial(s) installed</div>
          <div className="flex flex-col gap-1 rounded-lg border bg-card p-2">
            {dials.map((d) => (
              <div
                key={d.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 transition',
                  d.active ? 'bg-emerald-500/20' : 'hover:bg-muted/50',
                )}
              >
                <GripVertical className="size-4 text-muted-foreground" />
                <div className="flex flex-1 flex-col">
                  <span className="font-mono text-sm">
                    {d.id.toString(16).padStart(8, '0')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {DIAL_TYPES[d.type] ?? `Type ${d.type}`}
                  </span>
                </div>
                {d.active && (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/30 px-2 py-0.5 text-xs text-emerald-400">
                    <Check className="size-3" /> Active
                  </span>
                )}
                {d.type !== 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => void deleteDial(d.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Upload className="size-4" /> Upload Structured Dial
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload a <code>.bin</code> watchface with live data bindings (heart rate, steps, etc.).
          The dial will replace the first custom slot.
        </p>
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground transition hover:border-muted-foreground/50">
            {selectedFile ? selectedFile.name : 'Select .bin file'}
            <input
              type="file"
              accept=".bin"
              className="sr-only"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {selectedFile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFile(null)}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <Button
          disabled={!connected || busy || !selectedFile || !loaded}
          onClick={() => void uploadStructured()}
        >
          {busy && uploadProgress !== null ? (
            <>
              <Loader2 className="animate-spin" /> Uploading {uploadProgress}%
            </>
          ) : (
            <>
              <Upload className="size-4" /> Upload
            </>
          )}
        </Button>
        {!loaded && connected && (
          <p className="text-xs text-amber-400">Load dials first to see available slots.</p>
        )}
      </div>
    </div>
  )
}
