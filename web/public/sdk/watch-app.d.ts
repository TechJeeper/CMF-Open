/**
 * Type definitions for CMF App Store apps. Reference them from a plain JS app for editor
 * autocompletion:
 *
 *   /// <reference path="https://<your-pages-site>/sdk/watch-app.d.ts" />
 *   /** @type {import('./watch-app').WatchApp} *\/
 *   export default { ... }
 */

export type Button = 'play' | 'pause' | 'next' | 'prev' | 'vol_up' | 'vol_down' | 'find_phone'

export interface SettingSpec {
  key: string
  label: string
  type: 'text' | 'number' | 'textarea' | 'boolean'
  default?: string | number | boolean
  help?: string
}

export interface Manifest {
  /** Unique, 2-40 chars of a-z, 0-9 and "-". */
  id: string
  name: string
  /** Semver. The store offers an update when this increases. */
  version: string
  description: string
  author?: string
  /** One emoji. */
  icon?: string
  /** Seconds between tick() calls. null disables ticking. Default 1, minimum 0.25. */
  tickInterval?: number | null
  /** What each button does, shown to the user next to the watch preview. */
  buttons?: Partial<Record<Button, string>>
  /** Rendered as a form; values arrive in watch.settings. */
  settings?: SettingSpec[]
  /** Informational: "network" if the app calls fetch(). */
  permissions?: 'network'[]
  tags?: string[]
}

export interface Watch {
  /** Values of manifest.settings, as the user configured them. Read-only. */
  readonly settings: Readonly<Record<string, string | number | boolean>>
  /** Music screen: two lines, 64 UTF-8 bytes each. Silent, updates in place, deduplicated. */
  status(line1: string, line2?: string, opts?: { playing?: boolean }): Promise<void>
  /** Notification: 20-byte title, 128-byte body. Vibrates. Not deduplicated. */
  card(title: string, body?: string): Promise<void>
  /** Weather tile city name: 32 bytes, plus a temperature in Celsius. Deduplicated. */
  ticker(text: string, tempC?: number): Promise<void>
  /** Contacts list: up to 20 rows of [name (32 B), detail (25 B)]. Deduplicated. */
  menu(rows: (string | [string, string?] | { name: string; detail?: string })[]): Promise<void>
  /** Vibrate once. */
  buzz(): Promise<void>
  /** Small JSON storage private to this app, kept across runs. */
  storage: {
    get<T = unknown>(key: string, fallback?: T): T
    set(key: string, value: unknown): void
  }
  /** Write to the log panel under the watch preview. */
  log(...args: unknown[]): void
  /** Stop the app. */
  exit(): void
}

export interface WatchApp {
  start?(watch: Watch): void | Promise<void>
  onButton?(watch: Watch, button: Button | `raw:${string}`): void | Promise<void>
  tick?(watch: Watch): void | Promise<void>
  stop?(watch: Watch): void | Promise<void>
}
