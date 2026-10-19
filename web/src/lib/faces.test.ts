import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { makeEnv, seededRandom } from './faces/env'
import { faceDefaults, validateFace, type FaceManifest } from './faces/types'

const dir = path.resolve(import.meta.dirname, '../../public/faces')
const files = readdirSync(dir).filter((f) => f.endsWith('.js'))

/** A 2-D context that accepts every call, with just enough real behaviour for faces. */
function fakeContext(size: number) {
  const calls = { draws: 0 }
  const gradient = { addColorStop: () => {} }
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (t: string) => ({ width: t.length * 8 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    canvas: { width: size, height: size },
  }
  const ctx = new Proxy(target, {
    get: (t, k: string) => {
      if (k in t) return t[k]
      return (...args: unknown[]) => {
        if (/^(fill|stroke|putImageData|drawImage)/.test(k)) calls.draws++
        for (const a of args) if (typeof a === 'number' && Number.isNaN(a)) throw new Error(`${k} called with NaN`)
      }
    },
    set: (t, k: string, v) => ((t[k] = v), true),
  })
  return { ctx, calls }
}

describe('watchface catalog', () => {
  it('lists every face module in index.json', () => {
    const index = JSON.parse(readFileSync(path.join(dir, 'index.json'), 'utf8')) as { faces: { entry: string }[] }
    expect(index.faces.map((f) => f.entry).sort()).toEqual([...files].sort())
  })

  it('seeds randomness reproducibly', () => {
    const a = seededRandom('x')
    const b = seededRandom('x')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seededRandom('y')()).not.toBe(seededRandom('x')())
  })

  for (const file of files) {
    it(`${file} has a valid manifest and draws without throwing`, async () => {
      const mod = (await import(pathToFileURL(path.join(dir, file)).href)) as {
        face: FaceManifest
        default: (ctx: unknown, env: unknown) => unknown
      }
      expect(validateFace(mod.face)).toEqual([])
      expect(`${mod.face.id}.js`).toBe(file)
      // Midsummer, midwinter and a leap day exercise the date-driven faces.
      for (const now of [new Date(2026, 5, 21, 12), new Date(2026, 11, 21, 23, 59), new Date(2028, 1, 29, 6)]) {
        const { ctx, calls } = fakeContext(466)
        await mod.default(ctx, makeEnv(466, faceDefaults(mod.face), now, mod.face.id))
        expect(calls.draws).toBeGreaterThan(0)
      }
    })
  }
})
