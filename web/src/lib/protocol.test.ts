import { describe, expect, it } from 'vitest'
import V from './__fixtures__/vectors.json'
import { fromHex, hex } from './protocol/bytes'
import { crc32le, deriveAuthkey, deriveSessionKey, sign } from './protocol/crypto'
import { encode, FrameDecoder } from './protocol/frame'
import { OPS } from './protocol/opcodes'
import * as pl from './protocol/payloads'
import { compress, decompress } from './watchface/lz4'
import * as photo from './watchface/photo'

const KEY = fromHex(V.key)
const fill = (b: number) => new Uint8Array(16).fill(b)

describe('matches the Python implementation byte for byte', () => {
  it('derives the same keys', async () => {
    expect(hex(await deriveAuthkey(fill(1), fill(2), fill(3)))).toBe(V.authkey)
    expect(hex(await deriveSessionKey(fill(4), KEY))).toBe(V.sessionKey)
    expect(hex(await sign(fill(1), fill(3)))).toBe(V.sign)
    expect(hex(crc32le(new TextEncoder().encode('cmfkit')))).toBe(V.crc)
  })

  it('builds the same payloads', () => {
    expect(hex(pl.notification('Hi', 'from cmfkit ✓', pl.ICONS.generic, 1_700_000_000))).toBe(V.notification)
    expect(hex(pl.musicInfo('Focus 24:59', 'Pomodoro - 0 done', pl.MUSIC_PAUSED))).toBe(V.music)
    expect(hex(pl.weather('Lisbon', 21))).toBe(V.weather)
    expect(
      hex(pl.contacts([{ name: 'Lap 1', phone: '00:42' }, { name: 'Ä long name '.repeat(4), phone: 'x' }])),
    ).toBe(V.contacts)
    expect(hex(pl.timeSync(1_700_000_000, 3600))).toBe(V.timeSync)
    expect(hex(pl.photoDialInit(12345, 2, 56, 77, 0xf800))).toBe(V.photoInit)
  })

  it('encodes identical encrypted and plaintext frames', async () => {
    expect((await encode(OPS.MUSIC_INFO_SET, fromHex(V.music), KEY, 64)).map(hex)).toEqual(V.musicFrames)
    const plain = Uint8Array.from({ length: 200 }, (_, i) => i)
    expect((await encode(OPS.WF_CHUNK_WRITE, plain, KEY, 64)).map(hex)).toEqual(V.plainFrames)
  })

  it('decodes Python frames, including split notifications and watch-style plaintext', async () => {
    const dec = new FrameDecoder(true)
    dec.key = KEY
    const wire = fromHex(V.musicFrames.join(''))
    const out = [...(await dec.feed(wire.slice(0, 7))), ...(await dec.feed(wire.slice(7)))]
    expect(out).toHaveLength(1)
    expect(pl.parseMusicInfo(out[0].payload)).toEqual({ state: 1, track: 'Focus 24:59', artist: 'Pomodoro - 0 done' })

    const watch = new FrameDecoder(false)
    const [reply] = await watch.feed(fromHex(V.watchFrames.join('')))
    expect(reply.payload).toEqual(new Uint8Array(48))
  })

  it('parses a Python-built photo watchface', () => {
    const dial = photo.parse(fromHex(V.dial))
    expect([dial.full.width, dial.thumb.width]).toEqual([40, 20])
    const centre = (20 * 40 + 20) * 4
    expect(Array.from(dial.full.data.slice(centre, centre + 3))).toEqual([120, 120, 128])
  })
})

describe('lz4 + watchface', () => {
  it('round-trips compressible and random data', () => {
    const runs = new Uint8Array(70_000).map((_, i) => (i >> 9) & 0xff)
    const noise = crypto.getRandomValues(new Uint8Array(5000))
    for (const src of [runs, noise, new Uint8Array(3), new Uint8Array()]) {
      const packed = compress(src)
      expect(decompress(packed, src.length)).toEqual(src)
    }
    expect(compress(runs).length).toBeLessThan(runs.length / 20)
  })

  it('builds a container the parser (and the firmware layout) accepts', () => {
    const solid = (n: number): photo.Rgba => ({ width: n, height: n, data: new Uint8ClampedArray(n * n * 4).fill(255) })
    const blob = photo.build(solid(photo.SCREEN), solid(photo.THUMB))
    const back = photo.parse(blob)
    expect(back.full.width).toBe(466)
    const centre = (233 * 466 + 233) * 4
    expect(Array.from(back.full.data.slice(centre, centre + 3))).toEqual([248, 252, 248])
    expect(Array.from(back.full.data.slice(0, 3))).toEqual([0, 0, 0])
  })
})
