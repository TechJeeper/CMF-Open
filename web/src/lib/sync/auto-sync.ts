/**
 * Auto-sync: Push fresh data to the watch on connect.
 * This is the best we can do with Web Bluetooth limitations -
 * we can't push in the background, but we CAN auto-sync when the user connects.
 */

import type { Session } from '@/lib/session'
import { getMoonPhase } from '@/lib/astro/moon'

export interface SyncConfig {
  weather?: { city: string; lat?: number; lon?: number }
  moonPhase?: boolean
  enabled: boolean
}

export interface SyncResult {
  weather?: { city: string; tempC: number }
  moon?: { name: string; illumination: number; emoji: string }
  error?: string
}

const STORAGE_KEY = 'cmf.autosync.config'
const LAST_SYNC_KEY = 'cmf.autosync.last'

export function loadSyncConfig(): SyncConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { enabled: true, moonPhase: true }
}

export function saveSyncConfig(config: SyncConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function getLastSync(): number | null {
  const stored = localStorage.getItem(LAST_SYNC_KEY)
  return stored ? parseInt(stored, 10) : null
}

function setLastSync() {
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString())
}

async function fetchWeather(city: string): Promise<{ tempC: number } | null> {
  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const current = data.current_condition?.[0]
    if (!current) return null
    return { tempC: parseInt(current.temp_C, 10) }
  } catch {
    return null
  }
}

export async function runAutoSync(session: Session, config?: SyncConfig): Promise<SyncResult> {
  const cfg = config ?? loadSyncConfig()
  if (!cfg.enabled) return {}

  const result: SyncResult = {}
  const now = new Date()

  try {
    if (cfg.weather?.city) {
      const weather = await fetchWeather(cfg.weather.city)
      if (weather) {
        await session.setWeather(cfg.weather.city, weather.tempC)
        result.weather = { city: cfg.weather.city, tempC: weather.tempC }
      }
    }

    if (cfg.moonPhase) {
      const moon = getMoonPhase(now)
      const moonText = `${moon.emoji} ${moon.name} ${moon.illumination}%`
      await session.setWeather(moonText, 0)
      result.moon = { name: moon.name, illumination: moon.illumination, emoji: moon.emoji }
    }

    setLastSync()
  } catch (e) {
    result.error = (e as Error).message
  }

  return result
}

export function shouldSync(): boolean {
  const last = getLastSync()
  if (!last) return true
  const hoursSince = (Date.now() - last) / (1000 * 60 * 60)
  return hoursSince >= 1
}
