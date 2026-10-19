/** Page-side controller for one sandboxed app worker. */
import { validateManifest, type AppManifest, type Button, type SettingValues } from './manifest'
import type { HostToWorker, ScreenCall, WorkerToHost } from './messages'

export type AppLog = { at: number; level: 'info' | 'warn' | 'error'; text: string }

export interface HostEvents {
  screen: (call: ScreenCall) => Promise<void>
  log: (entry: AppLog) => void
  storage?: (key: string, value: unknown) => void
  exited?: () => void
}

const newWorker = () => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })

/** Load a module just far enough to read and validate its manifest. */
export function inspectApp(source: string, timeoutMs = 4000): Promise<{ manifest: AppManifest | null; errors: string[] }> {
  return new Promise((resolve) => {
    const w = newWorker()
    const done = (r: { manifest: AppManifest | null; errors: string[] }) => {
      clearTimeout(t)
      w.terminate()
      resolve(r)
    }
    const t = setTimeout(() => done({ manifest: null, errors: ['timed out loading the module'] }), timeoutMs)
    w.onmessage = (ev: MessageEvent<WorkerToHost>) => {
      if (ev.data.type === 'loaded') done(validateManifest(ev.data.manifest))
      else if (ev.data.type === 'error') done({ manifest: null, errors: [ev.data.message] })
    }
    w.onerror = (e) => done({ manifest: null, errors: [e.message || 'syntax error in module'] })
    w.postMessage({ type: 'load', source, settings: {}, storage: {} } satisfies HostToWorker)
  })
}

export class AppHost {
  readonly manifest: AppManifest
  private worker: Worker | null = null
  private readonly ev: HostEvents

  constructor(manifest: AppManifest, ev: HostEvents) {
    this.manifest = manifest
    this.ev = ev
  }

  private send(m: HostToWorker) {
    this.worker?.postMessage(m)
  }

  private log(level: AppLog['level'], text: string) {
    this.ev.log({ at: Date.now(), level, text })
  }

  start(source: string, settings: SettingValues, storage: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = newWorker()
      this.worker = w
      w.onerror = (e) => {
        this.log('error', e.message || 'worker crashed')
        reject(new Error(e.message))
      }
      w.onmessage = async (ev: MessageEvent<WorkerToHost>) => {
        const m = ev.data
        switch (m.type) {
          case 'loaded':
            this.send({ type: 'start' })
            resolve()
            break
          case 'screen': {
            const { id, type: _t, ...call } = m
            void _t
            try {
              await this.ev.screen(call as ScreenCall)
              this.send({ type: 'ack', id })
            } catch (e) {
              this.log('warn', `${call.call} failed: ${(e as Error).message}`)
              this.send({ type: 'ack', id, error: (e as Error).message })
            }
            break
          }
          case 'storage':
            this.ev.storage?.(m.key, m.value)
            break
          case 'log':
            this.log(m.level, m.text)
            break
          case 'error':
            this.log('error', m.message)
            if (m.fatal) {
              this.terminate()
              reject(new Error(m.message))
            }
            break
          case 'exit':
            this.log('info', 'app exited')
            void this.stop().then(() => this.ev.exited?.())
            break
          case 'stopped':
            break
        }
      }
      this.send({ type: 'load', source, settings, storage })
    })
  }

  press(button: Button | `raw:${string}`) {
    this.send({ type: 'button', button })
  }

  /** Give the app's stop() a moment to run, then kill the worker regardless. */
  stop(graceMs = 1500): Promise<void> {
    const w = this.worker
    if (!w) return Promise.resolve()
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(t)
        this.terminate()
        resolve()
      }
      const t = setTimeout(finish, graceMs)
      w.addEventListener('message', (ev: MessageEvent<WorkerToHost>) => ev.data.type === 'stopped' && finish())
      this.send({ type: 'stop' })
    })
  }

  private terminate() {
    this.worker?.terminate()
    this.worker = null
  }

  get running() {
    return this.worker !== null
  }
}
