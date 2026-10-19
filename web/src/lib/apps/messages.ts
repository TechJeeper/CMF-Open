/** postMessage protocol between the page (host) and an app's sandbox worker. */
import type { AppManifest, Button, SettingValues } from './manifest'

export type ScreenCall =
  | { call: 'status'; args: [string, string, boolean] }
  | { call: 'card'; args: [string, string] }
  | { call: 'ticker'; args: [string, number] }
  | { call: 'menu'; args: [[string, string][]] }
  | { call: 'buzz'; args: [] }

export type HostToWorker =
  | { type: 'load'; source: string; settings: SettingValues; storage: Record<string, unknown> }
  | { type: 'start' }
  | { type: 'button'; button: Button | `raw:${string}` }
  | { type: 'stop' }
  | { type: 'ack'; id: number; error?: string }

export type WorkerToHost =
  | { type: 'loaded'; manifest: unknown }
  | { type: 'screen'; id: number } & ScreenCall
  | { type: 'storage'; key: string; value: unknown }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; text: string }
  | { type: 'error'; message: string; fatal: boolean }
  | { type: 'exit' }
  | { type: 'stopped' }

export type { AppManifest }
