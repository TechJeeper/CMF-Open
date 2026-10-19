/** The `face` manifest every watchface module exports. Documented in docs/08-watch-faces.md. */

export type FaceSettingType = 'text' | 'number' | 'boolean' | 'color'

export interface FaceSetting {
  key: string
  label: string
  type: FaceSettingType
  default?: string | number | boolean
  help?: string
}

/** Where and how the watch draws its built-in clock over the background. */
export interface ClockPlacement {
  /** Built-in clock style, 0-4. */
  style: number
  /** Top-left of the clock, in 466 × 466 screen pixels. */
  x: number
  y: number
  color: string
}

export interface FaceManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  tags?: string[]
  clock: ClockPlacement
  settings?: FaceSetting[]
  /** Set when the face draws today's data, so the UI can suggest reinstalling it. */
  live?: string
}

export type FaceValues = Record<string, string | number | boolean>

export interface FaceEntry extends FaceManifest {
  entry: string
  url: string
}

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/
const HEX = /^#[0-9a-f]{6}$/i

export function validateFace(raw: unknown): string[] {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return ['the module must `export const face = {...}`']
  const f = raw as Record<string, unknown>
  if (typeof f.id !== 'string' || !ID.test(f.id)) errors.push('id: 2-40 chars of a-z, 0-9 and "-"')
  if (typeof f.name !== 'string' || !f.name.trim()) errors.push('name is required')
  if (typeof f.version !== 'string' || !/^\d+\.\d+\.\d+/.test(f.version)) errors.push('version must be semver')
  if (typeof f.description !== 'string') errors.push('description is required')
  const c = f.clock as Partial<ClockPlacement> | undefined
  if (!c || typeof c !== 'object') errors.push('clock: { style, x, y, color } is required')
  else {
    if (!Number.isInteger(c.style) || c.style! < 0 || c.style! > 4) errors.push('clock.style must be 0-4')
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x! < 0 || c.y! < 0 || c.x! > 466 || c.y! > 466) {
      errors.push('clock.x and clock.y must be within 0-466')
    }
    if (typeof c.color !== 'string' || !HEX.test(c.color)) errors.push('clock.color must be "#rrggbb"')
  }
  for (const [i, s] of ((f.settings as FaceSetting[] | undefined) ?? []).entries()) {
    if (!s?.key || !s.label || !['text', 'number', 'boolean', 'color'].includes(s.type)) {
      errors.push(`settings[${i}] needs key, label and type (text | number | boolean | color)`)
    }
  }
  return errors
}

export function faceDefaults(f: FaceManifest): FaceValues {
  const out: FaceValues = {}
  for (const s of f.settings ?? []) {
    out[s.key] = s.default ?? (s.type === 'number' ? 0 : s.type === 'boolean' ? false : s.type === 'color' ? '#ffffff' : '')
  }
  return out
}
