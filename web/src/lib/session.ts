/** An authenticated, encrypted session with one watch (port of src/cmfkit/session.py). */
import { fromHex, randomBytes, concat, equal, utf8 } from './protocol/bytes'
import { deriveAuthkey, deriveSessionKey, sign } from './protocol/crypto'
import { encode, FrameDecoder, FrameError, type Message } from './protocol/frame'
import { nameOf, OPS, sameOp, type Op } from './protocol/opcodes'
import * as pl from './protocol/payloads'
import type { Channel, Transport } from './transport/types'

export class AuthError extends Error {}

type Waiter = { wanted: Op[]; resolve: (m: Message) => void }
export type LogFn = (dir: '->' | '<-' | '!!' | '..', text: string) => void

export class Session {
  authkey: Uint8Array | null = null
  readonly transport: Transport
  private key: Uint8Array | null = null
  private decoder = new FrameDecoder()
  private waiters: Waiter[] = []
  private listeners = new Set<(m: Message) => void>()
  private shellBuf = ''
  private shellWaiter: ((s: string) => void) | null = null
  private readonly timeoutMs: number
  log: LogFn = () => {}

  constructor(transport: Transport, timeoutMs = 8000) {
    this.transport = transport
    this.timeoutMs = timeoutMs
    transport.setNotifyHandler((ch, data) => void this.onNotify(ch, data))
  }

  private setKey(key: Uint8Array | null) {
    this.key = key
    this.decoder.key = key
  }

  onMessage(fn: (m: Message) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private async onNotify(channel: Channel, data: Uint8Array) {
    if (channel === 'shell') {
      this.shellBuf += new TextDecoder().decode(data)
      if (this.shellWaiter && /(OK|ERROR)\s*$/.test(this.shellBuf)) {
        const w = this.shellWaiter
        this.shellWaiter = null
        w(this.shellBuf.trim())
        this.shellBuf = ''
      }
      return
    }
    const hex = Array.from(data.subarray(0, 48), (b) => b.toString(16).padStart(2, '0')).join('')
    this.log('..', `raw ${channel} ${data.length}B ${hex}${data.length > 48 ? '…' : ''}`)
    let messages: Message[]
    try {
      messages = await this.decoder.feed(data)
    } catch (e) {
      this.log('!!', `dropping bad frame: ${(e as FrameError).message}`)
      return
    }
    for (const msg of messages) {
      this.log('<-', nameOf(msg.op))
      const i = this.waiters.findIndex((w) => w.wanted.some((o) => sameOp(o, msg.op)))
      if (i >= 0) {
        this.waiters.splice(i, 1)[0].resolve(msg)
      } else {
        this.listeners.forEach((fn) => fn(msg))
      }
    }
  }

  expect(wanted: Op[], timeoutMs = this.timeoutMs): Promise<Message> {
    return new Promise((resolve, reject) => {
      const w: Waiter = { wanted, resolve: (m) => (clearTimeout(t), resolve(m)) }
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w)
        reject(new Error(`no ${wanted.map(nameOf).join('/')} reply`))
      }, timeoutMs)
      this.waiters.push(w)
    })
  }

  async send(op: Op, payload: Uint8Array = new Uint8Array(), channel: Channel = 'command') {
    this.log('->', nameOf(op))
    for (const chunk of await encode(op, payload, this.key, this.transport.mtu)) {
      await this.transport.write(channel, chunk)
    }
  }

  async request(op: Op, payload: Uint8Array, reply: Op[], timeoutMs?: number): Promise<Message> {
    const before = new Set(this.waiters)
    const pending = this.expect(reply, timeoutMs)
    pending.catch(() => {})
    const mine = this.waiters.find((w) => !before.has(w))
    try {
      await this.send(op, payload)
    } catch (e) {
      // A waiter left behind would swallow the reply meant for the next request.
      this.waiters = this.waiters.filter((w) => w !== mine)
      throw e
    }
    return pending
  }

  shell(command: string, timeoutMs = this.timeoutMs): Promise<string> {
    const line = command.toUpperCase().startsWith('AT') ? command : `AT ${command}`
    this.shellBuf = ''
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.shellWaiter = null
        reject(new Error(`no reply to ${line}`))
      }, timeoutMs)
      this.shellWaiter = (s) => (clearTimeout(t), resolve(s))
      this.transport.write('shell', utf8(line + '\r\n')).catch(reject)
    })
  }

  /**
   * First-time pairing via the factory AT shell secret. Returns the auth key to persist.
   * `onKey` fires as soon as the key is negotiated: the watch has stored it by then, so it
   * is worth keeping even if the login that follows fails.
   */
  async pair(secret?: Uint8Array, onKey?: (authkey: Uint8Array) => void): Promise<Uint8Array> {
    if (!secret) {
      const reply = await this.shell('AT GETSECRET')
      const m = reply.match(/GETSECRET:([0-9A-Fa-f]{32})/)
      if (!m) throw new AuthError(`unexpected GETSECRET reply: ${reply}`)
      secret = fromHex(m[1])
    }
    this.setKey(null)
    const rnd1 = randomBytes(16)
    const msg = await this.request(OPS.AUTH_PAIR_REQUEST, concat(rnd1, await sign(rnd1, secret)), [
      OPS.AUTH_PAIR_REPLY,
      OPS.AUTH_FAILED,
    ])
    if (sameOp(msg.op, OPS.AUTH_FAILED) || msg.payload.length < 48) throw new AuthError('watch rejected pairing')
    const rnd2 = msg.payload.slice(0, 16)
    if (!equal(msg.payload.slice(16, 48), await sign(rnd2, secret))) {
      throw new AuthError('watch signature mismatch (wrong secret?)')
    }
    const authkey = await deriveAuthkey(rnd1, rnd2, secret)
    onKey?.(authkey)
    await this.login(authkey)
    return authkey
  }

  async login(authkey: Uint8Array, phoneName = 'CMF App Store') {
    this.authkey = authkey
    this.setKey(authkey)
    const hello = concat(pl.POLL, utf8(phoneName))
    const helloReply = [OPS.AUTH_WATCH_MAC, OPS.AUTH_FAILED]
    let mac: Message
    try {
      mac = await this.request(OPS.AUTH_PHONE_NAME, hello, helloReply, this.timeoutMs * 1.5)
    } catch {
      this.log('!!', 'no reply to AUTH_PHONE_NAME, retrying once')
      mac = await this.request(OPS.AUTH_PHONE_NAME, hello, helloReply, this.timeoutMs * 1.5)
    }
    if (sameOp(mac.op, OPS.AUTH_FAILED)) throw new AuthError('watch rejected the auth key')
    const nonce = await this.request(OPS.AUTH_NONCE_REQUEST, pl.POLL, [OPS.AUTH_NONCE_REPLY, OPS.AUTH_FAILED])
    if (sameOp(nonce.op, OPS.AUTH_FAILED)) throw new AuthError('watch rejected the stored auth key')
    this.setKey(await deriveSessionKey(nonce.payload, authkey))
    const ok = await this.request(OPS.AUTH_CONFIRM_REQUEST, pl.POLL, [OPS.AUTH_CONFIRM_REPLY, OPS.AUTH_FAILED])
    if (sameOp(ok.op, OPS.AUTH_FAILED)) throw new AuthError('session confirmation failed')
    // The watch ignores data queries until it has been told the time.
    await this.send(OPS.TIME, pl.timeSync())
  }

  async firmwareVersion() {
    const m = await this.request(OPS.FIRMWARE_VERSION_GET, pl.POLL, [OPS.FIRMWARE_VERSION_RET])
    return pl.parseFirmwareVersion(m.payload)
  }

  async battery() {
    return pl.parseBattery((await this.request(OPS.BATTERY, pl.POLL, [OPS.BATTERY])).payload)
  }

  notify = (title: string, body: string, icon: number = pl.ICONS.generic) =>
    this.send(OPS.APP_NOTIFICATION, pl.notification(title, body, icon))
  findWatch = () => this.send(OPS.FIND_WATCH, Uint8Array.of(1))
  setMusic = (track: string, artist: string, state = pl.MUSIC_PLAYING) =>
    this.send(OPS.MUSIC_INFO_SET, pl.musicInfo(track, artist, state))
  setWeather = (city: string, tempC = 20) => this.send(OPS.WEATHER_SET, pl.weather(city, tempC))
  setContacts = (entries: pl.Contact[]) => this.send(OPS.CONTACTS_SET, pl.contacts(entries))

  /** Upload a photo watchface container. Resolves true if the watch activated it. */
  async uploadPhotoDial(
    blob: Uint8Array,
    opts: { style?: number; x?: number; y?: number; color565?: number; progress?: (done: number, total: number) => void } = {},
  ): Promise<boolean> {
    const init1 = await this.request(OPS.WF_INIT1_REQUEST, pl.POLL, [OPS.WF_INIT1_REPLY])
    if (init1.payload[0] !== 1) throw new Error('watch refused the watchface transfer')
    const next = () => {
      const p = this.expect([OPS.WF_CHUNK_REQUEST, OPS.WF_FINISH_REQUEST], this.timeoutMs * 4)
      p.catch(() => {})
      return p
    }
    let pending = next()
    const init2 = await this.request(
      OPS.WF_INIT2_PHOTO_REQUEST,
      pl.photoDialInit(blob.length, opts.style, opts.x, opts.y, opts.color565),
      [OPS.WF_INIT2_PHOTO_REPLY],
    )
    if (init2.payload[0] !== 1) throw new Error('watch rejected the watchface header')
    for (;;) {
      const msg = await pending
      if (sameOp(msg.op, OPS.WF_FINISH_REQUEST)) {
        await this.send(OPS.WF_FINISH_ACK, pl.POLL)
        return msg.payload[0] === 1
      }
      const { offset, length } = pl.chunkRequest(msg.payload)
      pending = next()
      await this.send(OPS.WF_CHUNK_WRITE, blob.subarray(offset, offset + length), 'data')
      opts.progress?.(Math.min(offset + length, blob.length), blob.length)
    }
  }
}
