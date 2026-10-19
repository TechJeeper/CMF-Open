/**
 * In-browser simulated CMF Watch 3 Pro (port of src/cmfkit/transport/sim.py). It plays the watch
 * side of the real protocol, so everything the store sends is framed, encrypted and decoded.
 */
import { DisplayStore } from '../display'
import { concat, fromHex, hex, randomBytes, utf8 } from '../protocol/bytes'
import { deriveAuthkey, deriveSessionKey, sign } from '../protocol/crypto'
import { encode, FrameDecoder, type Message } from '../protocol/frame'
import { OPS, opKey, type Op } from '../protocol/opcodes'
import * as pl from '../protocol/payloads'
import { parse as parseDial } from '../watchface/photo'
import type { Channel, NotifyHandler, Transport } from './types'

const CHUNK = 4096

/** Raw MUSIC_BUTTON codes. The real mapping is unconfirmed; see docs/07. */
export const BUTTON_CODES = { play: 1, pause: 2, next: 3, prev: 4, vol_up: 5, vol_down: 6 } as const
export type ButtonName = keyof typeof BUTTON_CODES | 'find_phone'

export class SimWatch implements Transport {
  readonly name = 'CMF Watch 3 Pro-SIM0'
  readonly id = 'simulator'
  readonly mtu = 247
  readonly display = new DisplayStore()
  readonly secret = randomBytes(16)
  onEvent: (text: string) => void = () => {}
  private handler: NotifyHandler | null = null
  private authkey: Uint8Array | null = null
  private key: Uint8Array | null = null
  private cmd = new FrameDecoder(true)
  private data = new FrameDecoder(true)
  private timeSynced = false
  private upload: Uint8Array[] | null = null
  private uploaded = 0
  private uploadSize = 0
  private pendingClock: { style: number; x: number; y: number; color: string } | null = null
  private replies: Promise<unknown> = Promise.resolve()

  setNotifyHandler(h: NotifyHandler) {
    this.handler = h
  }

  async connect() {
    this.setKey(this.authkey)
    this.timeSynced = false
    this.onEvent('connected')
  }

  async disconnect() {
    this.onEvent('disconnected')
  }

  async write(channel: Channel, data: Uint8Array) {
    await new Promise((r) => setTimeout(r, 2))
    if (channel === 'shell') return this.shell(new TextDecoder().decode(data).trim())
    const dec = channel === 'command' ? this.cmd : this.data
    dec.key = this.key
    for (const msg of await dec.feed(data)) await this.dispatch(msg)
  }

  /** The wearer pressing a media control (or "find phone") on the watch. */
  press(button: ButtonName) {
    if (button === 'find_phone') return this.reply(OPS.FIND_PHONE, Uint8Array.of(1))
    return this.reply(OPS.MUSIC_BUTTON, Uint8Array.of(BUTTON_CODES[button]))
  }

  private setKey(k: Uint8Array | null) {
    this.key = k
    this.cmd.key = k
  }

  private notify(channel: Channel, data: Uint8Array) {
    setTimeout(() => this.handler?.(channel, data), 1)
  }

  private reply(op: Op, payload: Uint8Array = new Uint8Array()) {
    // Encode with the key current at call time, before dispatch() switches to the session key.
    const key = this.key
    const run = this.replies.then(async () => {
      for (const f of await encode(op, payload, key, this.mtu, true)) this.notify('command', f)
    })
    this.replies = run.catch(() => undefined)
    return run
  }

  private shell(line: string) {
    const cmd = line.replace(/^AT/i, '').trim().toUpperCase()
    let out: string
    if (cmd === 'GETSECRET') out = `GETSECRET:${hex(this.secret).toUpperCase()},OK`
    else if (cmd === 'GETVERSION') out = 'GETVERSION:1.0.0.77,OK'
    else if (cmd === 'GETBATLV') out = 'GETBATLV:3921mv,OK'
    else if (cmd.startsWith('SETMOTOR')) {
      this.display.update((s) => ({ buzzes: s.buzzes + 1 }))
      this.onEvent('bzzz (motor)')
      out = 'SETMOTOR,OK'
    } else out = `${cmd},ERROR`
    this.notify('shell', utf8(out))
  }

  private async dispatch({ op, payload: p }: Message) {
    const is = (o: Op) => opKey(o) === opKey(op)
    const d = this.display
    if (is(OPS.AUTH_PAIR_REQUEST)) {
      const rnd1 = p.slice(0, 16)
      if (hex(p.slice(16, 48)) !== hex(await sign(rnd1, this.secret))) return this.reply(OPS.AUTH_FAILED)
      const rnd2 = randomBytes(16)
      await this.reply(OPS.AUTH_PAIR_REPLY, concat(rnd2, await sign(rnd2, this.secret)))
      this.authkey = await deriveAuthkey(rnd1, rnd2, this.secret)
      this.setKey(this.authkey)
    } else if (is(OPS.AUTH_PHONE_NAME)) {
      this.reply(OPS.AUTH_WATCH_MAC, fromHex('D0C0FFEE5485'))
    } else if (is(OPS.AUTH_NONCE_REQUEST)) {
      if (!this.authkey) return this.reply(OPS.AUTH_FAILED)
      const nonce = randomBytes(16)
      this.reply(OPS.AUTH_NONCE_REPLY, nonce)
      this.setKey(await deriveSessionKey(nonce, this.authkey))
    } else if (is(OPS.AUTH_CONFIRM_REQUEST)) {
      this.reply(OPS.AUTH_CONFIRM_REPLY, Uint8Array.of(1))
      this.onEvent('authenticated')
    } else if (is(OPS.TIME)) {
      this.timeSynced = true
    } else if (!this.timeSynced && (is(OPS.BATTERY) || is(OPS.SERIAL_NUMBER_GET))) {
      return
    } else if (is(OPS.FIRMWARE_VERSION_GET)) {
      this.reply(OPS.FIRMWARE_VERSION_RET, Uint8Array.of(1, 0, 0, 77))
    } else if (is(OPS.BATTERY)) {
      this.reply(OPS.BATTERY, Uint8Array.of(87, 0))
    } else if (is(OPS.APP_NOTIFICATION)) {
      const { title, body } = pl.parseNotification(p)
      d.update((s) => ({
        notifications: [{ title, body, at: Date.now() }, ...s.notifications].slice(0, 20),
        buzzes: s.buzzes + 1,
        lastSurface: 'notification',
      }))
      this.onEvent(`notification [${title}] ${body}`)
      this.reply(OPS.APP_NOTIFICATION_ACK)
    } else if (is(OPS.FIND_WATCH)) {
      d.update((s) => ({ buzzes: s.buzzes + 1 }))
      this.onEvent('ringing (find watch)')
      this.reply(OPS.FIND_WATCH_ACK)
    } else if (is(OPS.MUSIC_INFO_SET)) {
      const { track, artist, state } = pl.parseMusicInfo(p)
      d.update(() => ({ music: { track, artist, playing: state === pl.MUSIC_PLAYING }, lastSurface: 'music' }))
      this.reply(OPS.MUSIC_INFO_ACK)
    } else if (is(OPS.WEATHER_SET)) {
      const city = pl.parseWeatherCity(p)
      d.update(() => ({ weatherCity: city, weatherTemp: p[1] - 100, lastSurface: 'weather' }))
    } else if (is(OPS.CONTACTS_SET)) {
      d.update(() => ({ contacts: pl.parseContacts(p), lastSurface: 'contacts' }))
      this.reply(OPS.CONTACTS_ACK)
    } else if (is(OPS.WF_INIT1_REQUEST)) {
      this.reply(OPS.WF_INIT1_REPLY, Uint8Array.of(1))
    } else if (is(OPS.WF_INIT2_PHOTO_REQUEST)) {
      const v = new DataView(p.buffer, p.byteOffset, p.byteLength)
      this.uploadSize = v.getUint32(1)
      if (p.length >= 20) {
        const c = v.getUint16(18)
        const r = ((c >> 11) & 31) * 255 / 31
        const g = ((c >> 5) & 63) * 255 / 63
        const b = (c & 31) * 255 / 31
        const hex = '#' + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')
        this.pendingClock = { style: v.getUint16(12), x: v.getUint16(14), y: v.getUint16(16), color: hex }
      }
      this.upload = []
      this.uploaded = 0
      await this.reply(OPS.WF_INIT2_PHOTO_REPLY, Uint8Array.of(1))
      this.requestChunk()
    } else if (is(OPS.WF_CHUNK_WRITE) && this.upload) {
      this.upload.push(p)
      this.uploaded += p.length
      this.requestChunk()
    }
  }

  private requestChunk() {
    const offset = this.uploaded
    if (offset >= this.uploadSize) return this.finishUpload()
    const length = Math.min(CHUNK, this.uploadSize - offset)
    this.reply(OPS.WF_CHUNK_REQUEST, pl.buildChunkRequest(offset, length, Math.floor((offset * 100) / this.uploadSize)))
  }

  private finishUpload() {
    const blob = concat(...(this.upload ?? []))
    this.upload = null
    try {
      const { full } = parseDial(blob)
      const clock = this.pendingClock
      this.display.update((s) => ({ dial: full, dialClock: clock ?? s.dialClock, lastSurface: 'dial' }))
      this.onEvent(`watchface installed (${blob.length} bytes)`)
      this.reply(OPS.WF_FINISH_REQUEST, Uint8Array.of(1))
    } catch (e) {
      this.onEvent(`watchface rejected: ${(e as Error).message}`)
      this.reply(OPS.WF_FINISH_REQUEST, Uint8Array.of(0x0a))
    }
  }
}
