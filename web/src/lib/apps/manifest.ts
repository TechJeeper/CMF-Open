/** The `manifest` every app module exports. Documented in docs/07-web-app-store.md. */

export const BUTTONS = ['play', 'pause', 'next', 'prev', 'vol_up', 'vol_down', 'find_phone'] as const
export type Button = (typeof BUTTONS)[number]

export type SettingType = 'text' | 'number' | 'textarea' | 'boolean'

export interface SettingSpec {
  key: string
  label: string
  type: SettingType
  default?: string | number | boolean
  help?: string
}

export interface AppManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  icon?: string
  tickInterval?: number | null
  buttons?: Partial<Record<Button, string>>
  settings?: SettingSpec[]
  permissions?: 'network'[]
  tags?: string[]
}

export type SettingValues = Record<string, string | number | boolean>

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/
const SEMVER = /^\d+\.\d+\.\d+([-+][\w.]+)?$/

export function validateManifest(raw: unknown): { manifest: AppManifest | null; errors: string[] } {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return { manifest: null, errors: ['the module must `export const manifest = {...}`'] }
  const m = raw as Record<string, unknown>
  if (typeof m.id !== 'string' || !ID.test(m.id)) errors.push('id: 2-40 chars of a-z, 0-9 and "-", starting with a letter or digit')
  if (typeof m.name !== 'string' || !m.name.trim()) errors.push('name is required')
  if (typeof m.version !== 'string' || !SEMVER.test(m.version)) errors.push('version must be semver, e.g. "1.0.0"')
  if (typeof m.description !== 'string') errors.push('description is required')
  if (m.tickInterval != null && (typeof m.tickInterval !== 'number' || m.tickInterval < 0.25)) {
    errors.push('tickInterval must be null or a number of seconds >= 0.25')
  }
  if (m.buttons && Object.keys(m.buttons).some((b) => !BUTTONS.includes(b as Button))) {
    errors.push(`buttons keys must be among: ${BUTTONS.join(', ')}`)
  }
  if (m.settings != null) {
    if (!Array.isArray(m.settings)) errors.push('settings must be an array')
    else
      m.settings.forEach((s: SettingSpec, i) => {
        if (!s?.key || !s.label || !['text', 'number', 'textarea', 'boolean'].includes(s.type)) {
          errors.push(`settings[${i}] needs key, label and type (text | number | textarea | boolean)`)
        }
      })
  }
  return { manifest: errors.length ? null : (m as unknown as AppManifest), errors }
}

export function defaultSettings(m: AppManifest): SettingValues {
  const out: SettingValues = {}
  for (const s of m.settings ?? []) {
    out[s.key] = s.default ?? (s.type === 'number' ? 0 : s.type === 'boolean' ? false : '')
  }
  return out
}
