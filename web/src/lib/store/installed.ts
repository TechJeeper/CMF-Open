/** Installed apps, their settings and their private storage, all kept in localStorage. */
import { defaultSettings, type AppManifest, type SettingValues } from '../apps/manifest'

export type InstallOrigin = 'store' | 'sideload' | 'playground'

export interface InstalledApp {
  manifest: AppManifest
  source: string
  origin: InstallOrigin
  sourceUrl?: string
  installedAt: number
}

const APPS_KEY = 'cmf.apps.v1'
const settingsKey = (id: string) => `cmf.settings.${id}`
const dataKey = (id: string) => `cmf.appdata.${id}`

type Listener = () => void
const listeners = new Set<Listener>()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function listInstalled(): Record<string, InstalledApp> {
  return read(APPS_KEY, {})
}

export function getInstalled(id: string): InstalledApp | undefined {
  return listInstalled()[id]
}

export function install(app: InstalledApp) {
  const all = listInstalled()
  all[app.manifest.id] = app
  localStorage.setItem(APPS_KEY, JSON.stringify(all))
  listeners.forEach((l) => l())
}

export function uninstall(id: string) {
  const all = listInstalled()
  delete all[id]
  localStorage.setItem(APPS_KEY, JSON.stringify(all))
  localStorage.removeItem(settingsKey(id))
  localStorage.removeItem(dataKey(id))
  listeners.forEach((l) => l())
}

export function subscribeInstalled(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function loadSettings(m: AppManifest): SettingValues {
  return { ...defaultSettings(m), ...read<SettingValues>(settingsKey(m.id), {}) }
}

export function saveSettings(id: string, values: SettingValues) {
  localStorage.setItem(settingsKey(id), JSON.stringify(values))
}

export function loadAppData(id: string): Record<string, unknown> {
  return read(dataKey(id), {})
}

export function saveAppData(id: string, key: string, value: unknown) {
  const all = loadAppData(id)
  if (value === undefined) delete all[key]
  else all[key] = value
  localStorage.setItem(dataKey(id), JSON.stringify(all))
}

/** Compare dotted versions numerically: >0 if a is newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const pb = b.split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}
