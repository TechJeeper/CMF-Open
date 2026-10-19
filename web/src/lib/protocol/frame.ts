/**
 * The 0xF5 frame: `F5 | chunkLen u16 | cmd1 u16 | count u16 | index u16 | cmd2 u16 | chunk` (big-endian).
 * Each chunk is `piece || CRC32_LE(piece)`, AES-encrypted unless the opcode is plaintext.
 * Plaintext frames sent by the watch count the CRC in chunkLen but omit it on the wire.
 */
import { concat } from './bytes'
import { aesDecrypt, aesEncrypt, crc32le } from './crypto'
import { isPlaintextOp, opKey, type Op } from './opcodes'

export const MAGIC = 0xf5
export const HEADER_LEN = 11

export class FrameError extends Error {}

export interface Message {
  op: Op
  payload: Uint8Array
}

export const isEncrypted = (op: Op, key: Uint8Array | null) => key !== null && !isPlaintextOp(op)

export function chunkCapacity(mtu: number, encrypted: boolean): number {
  const maxWrite = mtu - 3
  const cap = encrypted ? Math.floor((maxWrite - HEADER_LEN) / 16) * 16 - 4 - 1 : maxWrite - HEADER_LEN - 4 - 2
  if (cap < 1) throw new FrameError(`MTU ${mtu} is too small; negotiate a larger MTU first`)
  return cap
}

function header(chunkLen: number, op: Op, count: number, index: number): Uint8Array {
  const h = new Uint8Array(HEADER_LEN)
  const v = new DataView(h.buffer)
  h[0] = MAGIC
  v.setUint16(1, chunkLen)
  v.setUint16(3, op.cmd1)
  v.setUint16(5, count)
  v.setUint16(7, index)
  v.setUint16(9, op.cmd2)
  return h
}

export async function encode(
  op: Op,
  payload: Uint8Array,
  key: Uint8Array | null,
  mtu = 247,
  omitPlaintextCrc = false,
): Promise<Uint8Array[]> {
  const encrypted = isEncrypted(op, key)
  const cap = chunkCapacity(mtu, encrypted)
  const pieces: Uint8Array[] = []
  for (let i = 0; i < payload.length; i += cap) pieces.push(payload.subarray(i, i + cap))
  if (!pieces.length) pieces.push(new Uint8Array())
  const frames: Uint8Array[] = []
  for (const [i, piece] of pieces.entries()) {
    let body = concat(piece, crc32le(piece))
    if (encrypted) body = await aesEncrypt(key!, body)
    const h = header(body.length, op, pieces.length, i + 1)
    frames.push(concat(h, omitPlaintextCrc && !encrypted ? piece : body))
  }
  return frames
}

/** Reassembles a notification byte stream into messages. Calls are serialised internally. */
export class FrameDecoder {
  key: Uint8Array | null = null
  private buf: Uint8Array = new Uint8Array()
  private partial = new Map<string, Uint8Array[]>()
  private chain: Promise<unknown> = Promise.resolve()
  private readonly plaintextCrcOnWire: boolean

  constructor(plaintextCrcOnWire = false) {
    this.plaintextCrcOnWire = plaintextCrcOnWire
  }

  feed(data: Uint8Array): Promise<Message[]> {
    const run = this.chain.then(() => this.drain(data))
    this.chain = run.catch(() => undefined)
    return run
  }

  private async drain(data: Uint8Array): Promise<Message[]> {
    this.buf = concat(this.buf, data)
    const out: Message[] = []
    for (;;) {
      const start = this.buf.indexOf(MAGIC)
      if (start < 0) {
        this.buf = new Uint8Array()
        return out
      }
      this.buf = this.buf.slice(start)
      if (this.buf.length < HEADER_LEN) return out
      const v = new DataView(this.buf.buffer, this.buf.byteOffset)
      const chunkLen = v.getUint16(1)
      const op = { cmd1: v.getUint16(3), cmd2: v.getUint16(9) }
      const count = v.getUint16(5)
      const index = v.getUint16(7)
      const encrypted = isEncrypted(op, this.key)
      const wireLen = !encrypted && !this.plaintextCrcOnWire ? Math.max(chunkLen - 4, 0) : chunkLen
      if (this.buf.length < HEADER_LEN + wireLen) return out
      const body = this.buf.slice(HEADER_LEN, HEADER_LEN + wireLen)
      this.buf = this.buf.slice(HEADER_LEN + wireLen)
      const piece = await this.open(body, encrypted)
      if (count <= 1) {
        out.push({ op, payload: piece })
        continue
      }
      const k = opKey(op)
      const parts = index === 1 ? [] : (this.partial.get(k) ?? [])
      parts.push(piece)
      this.partial.set(k, parts)
      if (index === count) {
        out.push({ op, payload: concat(...parts) })
        this.partial.delete(k)
      }
    }
  }

  private async open(body: Uint8Array, encrypted: boolean): Promise<Uint8Array> {
    if (encrypted) {
      try {
        body = await aesDecrypt(this.key!, body)
      } catch {
        throw new FrameError('AES decryption failed (wrong key?)')
      }
    } else if (!this.plaintextCrcOnWire) {
      return body
    }
    if (body.length < 4) throw new FrameError('chunk shorter than its CRC')
    const piece = body.slice(0, -4)
    const crc = crc32le(piece)
    if (!crc.every((b, i) => b === body[body.length - 4 + i])) throw new FrameError('CRC mismatch')
    return piece
  }
}
