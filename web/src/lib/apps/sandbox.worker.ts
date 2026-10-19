/// <reference lib="webworker" />
/**
 * Runs one app module in isolation. The app gets a `watch` object; it never sees the BLE
 * session, auth keys, other apps, or the page's DOM and storage. Calls are serialised so
 * start/tick/onButton never overlap.
 */
import type { HostToWorker, ScreenCall, WorkerToHost } from './messages'

declare const self: DedicatedWorkerGlobalScope

type Fn = (watch: WatchApi, ...args: unknown[]) => unknown
interface AppModule {
  manifest?: { tickInterval?: number | null }
  default?: { start?: Fn; onButton?: Fn; tick?: Fn; stop?: Fn }
}

const post = (m: WorkerToHost) => self.postMessage(m)
const pending = new Map<number, { resolve: () => void; reject: (e: Error) => void }>()
let nextId = 1
let mod: AppModule = {}
let storage: Record<string, unknown> = {}
let queue: Promise<unknown> = Promise.resolve()
let timer: ReturnType<typeof setInterval> | undefined
let running = false
let ticking = false

function screen(call: ScreenCall): Promise<void> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    post({ type: 'screen', id, ...call } as WorkerToHost)
  })
}

const text = (v: unknown) => (v == null ? '' : String(v))
const fmt = (args: unknown[]) => args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')

type Row = string | [unknown, unknown?] | { name: unknown; detail?: unknown }

const watch = {
  settings: {} as Record<string, unknown>,
  status: (line1: unknown, line2: unknown = '', opts: { playing?: boolean } = {}) =>
    screen({ call: 'status', args: [text(line1), text(line2), opts.playing ?? true] }),
  card: (title: unknown, body: unknown = '') => screen({ call: 'card', args: [text(title), text(body)] }),
  ticker: (value: unknown, tempC = 20) => screen({ call: 'ticker', args: [text(value), Math.round(Number(tempC) || 0)] }),
  menu: (rows: Row[]) =>
    screen({
      call: 'menu',
      args: [
        rows.map((r): [string, string] =>
          Array.isArray(r) ? [text(r[0]), text(r[1])] : typeof r === 'object' && r ? [text(r.name), text(r.detail)] : [text(r), ''],
        ),
      ],
    }),
  buzz: () => screen({ call: 'buzz', args: [] }),
  storage: {
    get: <T = unknown>(key: string, fallback?: T): T => (key in storage ? (storage[key] as T) : (fallback as T)),
    set: (key: string, value: unknown) => {
      storage[key] = value
      post({ type: 'storage', key, value })
    },
  },
  log: (...args: unknown[]) => post({ type: 'log', level: 'info', text: fmt(args) }),
  exit: () => {
    post({ type: 'exit' })
  },
}
export type WatchApi = typeof watch

function call(name: 'start' | 'onButton' | 'tick' | 'stop', ...args: unknown[]): Promise<unknown> {
  const run = queue.then(async () => {
    const app = mod.default
    const fn = app?.[name]
    if (typeof fn === 'function') await fn.call(app, watch, ...args)
  })
  queue = run.catch((e: Error) => post({ type: 'error', message: `${name}: ${e?.message ?? e}`, fatal: false }))
  return queue
}

self.onmessage = async (ev: MessageEvent<HostToWorker>) => {
  const msg = ev.data
  if (msg.type === 'ack') {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) p?.reject(new Error(msg.error))
    else p?.resolve()
  } else if (msg.type === 'load') {
    watch.settings = Object.freeze({ ...msg.settings })
    storage = { ...msg.storage }
    const url = URL.createObjectURL(new Blob([msg.source], { type: 'text/javascript' }))
    try {
      mod = await import(/* @vite-ignore */ url)
      post({ type: 'loaded', manifest: mod.manifest ?? null })
    } catch (e) {
      post({ type: 'error', message: `could not load app: ${(e as Error).message}`, fatal: true })
    } finally {
      URL.revokeObjectURL(url)
    }
  } else if (msg.type === 'start') {
    running = true
    await call('start')
    const every = mod.manifest?.tickInterval === undefined ? 1 : mod.manifest.tickInterval
    if (every && running) {
      timer = setInterval(() => {
        // Skip a tick rather than letting them pile up behind a slow handler.
        if (!running || ticking) return
        ticking = true
        call('tick').finally(() => (ticking = false))
      }, Math.max(every, 0.25) * 1000)
    }
  } else if (msg.type === 'button') {
    if (running) await call('onButton', msg.button)
  } else if (msg.type === 'stop') {
    running = false
    clearInterval(timer)
    await call('stop')
    post({ type: 'stopped' })
  }
}
