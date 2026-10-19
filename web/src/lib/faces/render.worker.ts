/// <reference lib="webworker" />
/** Renders a face module into pixels on an OffscreenCanvas, away from the page. */
import { makeEnv } from './env'
import type { FaceManifest } from './types'

type Module = { face?: FaceManifest; default?: (ctx: OffscreenCanvasRenderingContext2D, env: unknown) => void | Promise<void> }

export type RenderRequest = { id: number; url: string; settings: Record<string, string | number | boolean>; now: number; size: number; thumb: number }
export type RenderResponse =
  | { id: number; ok: true; full: ArrayBuffer; thumb: ArrayBuffer; size: number; thumbSize: number }
  | { id: number; ok: false; error: string }

const modules = new Map<string, Promise<Module>>()

self.onmessage = async (e: MessageEvent<RenderRequest>) => {
  const { id, url, settings, now, size, thumb } = e.data
  try {
    let mod = modules.get(url)
    if (!mod) {
      mod = import(/* @vite-ignore */ url) as Promise<Module>
      modules.set(url, mod)
      mod.catch(() => modules.delete(url))
    }
    const m = await mod
    if (typeof m.default !== 'function') throw new Error('the module must `export default function draw(ctx, env)`')
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)
    const seed = `${m.face?.id ?? url}:${settings.seed ?? ''}`
    await m.default(ctx, makeEnv(size, settings, new Date(now), seed))
    const small = new OffscreenCanvas(thumb, thumb)
    const sctx = small.getContext('2d')!
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(canvas, 0, 0, thumb, thumb)
    const full = ctx.getImageData(0, 0, size, size).data.buffer as ArrayBuffer
    const tb = sctx.getImageData(0, 0, thumb, thumb).data.buffer as ArrayBuffer
    self.postMessage({ id, ok: true, full, thumb: tb, size, thumbSize: thumb } satisfies RenderResponse, [full, tb])
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error).message ?? String(err) } satisfies RenderResponse)
  }
}
