/** Client for the face render worker, plus the face catalog. */
import { SCREEN, THUMB, type Rgba } from '@/lib/watchface/photo'
import type { RenderRequest, RenderResponse } from './render.worker'
import type { FaceEntry, FaceManifest, FaceValues } from './types'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: { full: Rgba; thumb: Rgba }) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<RenderResponse>) => {
    const r = e.data
    const p = pending.get(r.id)
    if (!p) return
    pending.delete(r.id)
    if (r.ok) {
      p.resolve({
        full: { width: r.size, height: r.size, data: new Uint8Array(r.full) },
        thumb: { width: r.thumbSize, height: r.thumbSize, data: new Uint8Array(r.thumb) },
      })
    } else p.reject(new Error(r.error))
  }
  worker.onerror = (e) => {
    // A crash in the worker takes every queued render with it; start fresh next time.
    pending.forEach((p) => p.reject(new Error(e.message || 'face renderer crashed')))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

export function renderFace(url: string, settings: FaceValues, now = new Date()): Promise<{ full: Rgba; thumb: Rgba }> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, url, settings, now: now.getTime(), size: SCREEN, thumb: THUMB } satisfies RenderRequest)
  })
}

export const FACE_CATALOG = 'faces/index.json'

export async function fetchFaces(source = FACE_CATALOG): Promise<FaceEntry[]> {
  const base = new URL(source, document.baseURI)
  const res = await fetch(base, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const data = (await res.json()) as { faces?: (FaceManifest & { entry: string })[] }
  if (!Array.isArray(data.faces)) throw new Error('index.json has no "faces" array')
  return data.faces.filter((f) => f?.id && f.entry).map((f) => ({ ...f, url: new URL(f.entry, base).href }))
}

const KEY = (id: string) => `cmf.face.${id}.v1`

export function loadFaceSettings(id: string, defaults: FaceValues): FaceValues {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY(id)) ?? '{}') as FaceValues) }
  } catch {
    return defaults
  }
}

export function saveFaceSettings(id: string, values: FaceValues) {
  localStorage.setItem(KEY(id), JSON.stringify(values))
}
