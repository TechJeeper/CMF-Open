const enc = new TextEncoder()
const dec = new TextDecoder('utf-8', { fatal: false })

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

export function hex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function fromHex(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '')
  if (clean.length % 2) throw new Error('odd-length hex string')
  return Uint8Array.from(clean.match(/../g) ?? [], (h) => parseInt(h, 16))
}

/** UTF-8 encode, cut to at most `size` bytes without splitting a code point. */
export function clip(text: string, size: number): Uint8Array {
  const raw = enc.encode(text)
  if (raw.length <= size) return raw
  let end = size
  while (end > 0 && (raw[end] & 0xc0) === 0x80) end--
  return raw.slice(0, end)
}

export function fixed(text: string, size: number): Uint8Array {
  const out = new Uint8Array(size)
  out.set(clip(text, size))
  return out
}

export function utf8(text: string): Uint8Array {
  return enc.encode(text)
}

export function str(data: Uint8Array): string {
  let end = data.length
  while (end > 0 && data[end - 1] === 0) end--
  return dec.decode(data.subarray(0, end))
}

export function equal(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function u32be(n: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, n >>> 0)
  return out
}
