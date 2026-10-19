import { readdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateManifest } from './apps/manifest'
import type { ScreenCall } from './apps/messages'
import { Screen } from './apps/screen'
import { OPS, sameOp } from './protocol/opcodes'
import { Session } from './session'
import { BUTTON_CODES, SimWatch } from './transport/sim'
import * as photo from './watchface/photo'

async function connected() {
  const sim = new SimWatch()
  await sim.connect()
  const session = new Session(sim, 2000)
  const authkey = await session.pair()
  return { sim, session, authkey }
}

describe('Session against the simulated watch', () => {
  it('pairs, reconnects with the stored key, and queries the watch', async () => {
    const { sim, session, authkey } = await connected()
    expect(await session.firmwareVersion()).toBe('1.0.0.77')
    expect((await session.battery()).level).toBe(87)

    await sim.connect()
    const again = new Session(sim, 2000)
    await again.login(authkey)
    await again.notify('Hello', 'again')
    await new Promise((r) => setTimeout(r, 30))
    expect(sim.display.state.notifications[0]).toMatchObject({ title: 'Hello', body: 'again' })
  })

  it('delivers watch button presses to listeners', async () => {
    const { sim, session } = await connected()
    const got: number[] = []
    session.onMessage((m) => sameOp(m.op, OPS.MUSIC_BUTTON) && got.push(m.payload[0]))
    await sim.press('next')
    await sim.press('play')
    await new Promise((r) => setTimeout(r, 30))
    expect(got).toEqual([BUTTON_CODES.next, BUTTON_CODES.play])
  })

  it('uploads a photo watchface through the chunked data channel', async () => {
    const { sim, session } = await connected()
    const solid = (n: number): photo.Rgba => ({ width: n, height: n, data: new Uint8ClampedArray(n * n * 4).fill(200) })
    const blob = photo.build(solid(photo.SCREEN), solid(photo.THUMB))
    const seen: number[] = []
    expect(await session.uploadPhotoDial(blob, { progress: (d) => seen.push(d) })).toBe(true)
    expect(seen.at(-1)).toBe(blob.length)
    expect(sim.display.state.dial?.width).toBe(466)
  })
})

const appsDir = path.resolve(import.meta.dirname, '../../public/apps')
const appFiles = readdirSync(appsDir).filter((f) => f.endsWith('.js'))

/** Runs an app module in-process with the same `watch` surface the sandbox worker provides. */
async function runApp(file: string, buttons: string[]) {
  const { sim, session } = await connected()
  const mod = await import(pathToFileURL(path.join(appsDir, file)).href)
  const screen = new Screen(session, null)
  const store: Record<string, unknown> = {}
  const settings = Object.fromEntries((mod.manifest.settings ?? []).map((s: { key: string; default: unknown }) => [s.key, s.default]))
  const apply = (c: ScreenCall) => screen.apply(c)
  const watch = {
    settings,
    status: (a: string, b = '', o: { playing?: boolean } = {}) => apply({ call: 'status', args: [a, b, o.playing ?? true] }),
    card: (a: string, b = '') => apply({ call: 'card', args: [a, b] }),
    ticker: (a: string, t = 20) => apply({ call: 'ticker', args: [a, t] }),
    menu: (rows: unknown[]) =>
      apply({ call: 'menu', args: [rows.map((r) => (Array.isArray(r) ? [String(r[0]), String(r[1] ?? '')] : [String(r), '']))] }),
    buzz: () => apply({ call: 'buzz', args: [] }),
    storage: { get: (k: string, f?: unknown) => (k in store ? store[k] : f), set: (k: string, v: unknown) => (store[k] = v) },
    log: () => {},
    exit: () => {},
  }
  const app = mod.default
  await app.start?.call(app, watch)
  for (const b of buttons) await app.onButton?.call(app, watch, b)
  if (mod.manifest.id !== 'crypto-ticker') await app.tick?.call(app, watch)
  await new Promise((r) => setTimeout(r, 40))
  return { manifest: mod.manifest, display: sim.display.state }
}

describe('sample apps', () => {
  it.each(appFiles)('%s has a valid manifest and drives the simulated watch', async (file) => {
    const { manifest, display } = await runApp(file, file === 'crypto-ticker.js' ? [] : ['play', 'next', 'next', 'prev'])
    expect(validateManifest(manifest).errors).toEqual([])
    if (file !== 'crypto-ticker.js') expect(display.music.track).not.toBe('')
  })

  it('stopwatch records laps into the contacts list', async () => {
    const { display } = await runApp('stopwatch.js', ['play', 'next', 'next'])
    expect(display.contacts.map((c) => c.name)).toEqual(['Lap 1', 'Lap 2'])
    expect(display.notifications[0].title).toBe('Lap 2')
  })

  it('checklist ticks items and reports progress', async () => {
    const { display } = await runApp('checklist.js', ['play', 'next'])
    expect(display.contacts[0].name).toBe('[x] Passport')
    expect(display.music.artist).toBe('todo - 4 left')
  })
})
