/** Helpers handed to every face's `draw()`: deterministic randomness and smooth noise. */

export function seededRandom(seed: string | number): () => number {
  let h = 1779033703
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353) >>> 0
  let a = h || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 2-D gradient noise in roughly [-1, 1], seeded so a face looks the same every render. */
export function makeNoise(random: () => number): (x: number, y: number) => number {
  const perm = Uint8Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const grads = Array.from({ length: 256 }, () => {
    const a = random() * Math.PI * 2
    return [Math.cos(a), Math.sin(a)]
  })
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const dot = (ix: number, iy: number, x: number, y: number) => {
    const g = grads[perm[(perm[ix & 255] + iy) & 255]]
    return g[0] * (x - ix) + g[1] * (y - iy)
  }
  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const u = fade(x - x0)
    const v = fade(y - y0)
    const a = dot(x0, y0, x, y) + u * (dot(x0 + 1, y0, x, y) - dot(x0, y0, x, y))
    const b = dot(x0, y0 + 1, x, y) + u * (dot(x0 + 1, y0 + 1, x, y) - dot(x0, y0 + 1, x, y))
    return (a + v * (b - a)) * 1.4
  }
}

export interface FaceEnv {
  size: number
  settings: Record<string, string | number | boolean>
  /** When the face is being rendered; faces that show "today" read this. */
  now: Date
  random: () => number
  noise: (x: number, y: number) => number
}

export function makeEnv(size: number, settings: FaceEnv['settings'], now: Date, seed: string): FaceEnv {
  const random = seededRandom(seed)
  return { size, settings, now, random, noise: makeNoise(seededRandom(`${seed}:noise`)) }
}
