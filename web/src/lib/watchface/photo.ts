/**
 * Photo watchface container (see src/cmfkit/watchface/photo.py):
 * magic | 0x12 | 8 x 00 | lenFull | FULL block | THUMB block | magic,
 * where each block is `dims u32 | len u32 | LZ4(RGB565 LE)` and dims = cf | w << 10 | h << 21.
 */
import { concat } from '../protocol/bytes'
import { compress, decompress } from './lz4'

export const MAGIC = Uint8Array.of(0x6c, 0x8d, 0xc4, 0xa5)
export const CF_RGB565 = 4
export const SCREEN = 466
export const THUMB = 270

export class DialFormatError extends Error {}

export interface Rgba {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array
}

export const dimsWord = (w: number, h: number, cf = CF_RGB565) => ((cf & 0x1f) | ((w & 0x7ff) << 10) | ((h & 0x7ff) << 21)) >>> 0

export const splitDims = (word: number) => ({ cf: word & 0x1f, width: (word >>> 10) & 0x7ff, height: (word >>> 21) & 0x7ff })

const u32le = (...vals: number[]) => {
  const out = new Uint8Array(vals.length * 4)
  const v = new DataView(out.buffer)
  vals.forEach((n, i) => v.setUint32(i * 4, n >>> 0, true))
  return out
}

/** RGBA -> RGB565 little-endian, blacking out everything outside the round panel. */
export function toRgb565(img: Rgba, roundMask = true): Uint8Array {
  const { width: w, height: h, data } = img
  const out = new Uint8Array(w * h * 2)
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const r2 = (w / 2) * (h / 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (roundMask && (x - cx) ** 2 + (y - cy) ** 2 > r2) continue
      const a = data[i * 4 + 3] / 255
      const r = data[i * 4] * a
      const g = data[i * 4 + 1] * a
      const b = data[i * 4 + 2] * a
      const v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
      out[i * 2] = v & 0xff
      out[i * 2 + 1] = v >> 8
    }
  }
  return out
}

export function fromRgb565(raw: Uint8Array, width: number, height: number): Rgba {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const v = raw[i * 2] | (raw[i * 2 + 1] << 8)
    data[i * 4] = ((v >> 11) & 0x1f) << 3
    data[i * 4 + 1] = ((v >> 5) & 0x3f) << 2
    data[i * 4 + 2] = (v & 0x1f) << 3
    data[i * 4 + 3] = 255
  }
  return { width, height, data }
}

function block(img: Rgba): Uint8Array {
  const packed = compress(toRgb565(img))
  return concat(u32le(dimsWord(img.width, img.height), packed.length), packed)
}

/** Build a container from images already sized to SCREEN and THUMB pixels. */
export function build(full: Rgba, thumb: Rgba): Uint8Array {
  const f = block(full)
  return concat(MAGIC, u32le(0x12, 0, 0, f.length), f, block(thumb), MAGIC)
}

export function parse(blob: Uint8Array): { full: Rgba; thumb: Rgba } {
  const magicAt = (pos: number) => MAGIC.every((b, i) => blob[pos + i] === b)
  if (blob.length < 32 || !magicAt(0) || !magicAt(blob.length - 4)) throw new DialFormatError('missing photo dial magic')
  const v = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  const lenFull = v.getUint32(16, true)
  const images: Rgba[] = []
  let pos = 20
  for (const end of [20 + lenFull, blob.length - 4]) {
    const { cf, width, height } = splitDims(v.getUint32(pos, true))
    const n = v.getUint32(pos + 4, true)
    if (cf !== CF_RGB565) throw new DialFormatError(`unsupported color format ${cf}`)
    if (pos + 8 + n !== end) throw new DialFormatError('block length does not match container layout')
    images.push(fromRgb565(decompress(blob.subarray(pos + 8, pos + 8 + n), width * height * 2), width, height))
    pos += 8 + n
  }
  return { full: images[0], thumb: images[1] }
}
