/** LZ4 block format (no frame header), as produced by python-lz4's `lz4.block.compress(store_size=False)`. */

const MIN_MATCH = 4
const LAST_LITERALS = 5
const MF_LIMIT = 12
const HASH_LOG = 16

function writeLength(out: number[], n: number) {
  while (n >= 255) {
    out.push(255)
    n -= 255
  }
  out.push(n)
}

export function compress(src: Uint8Array): Uint8Array {
  const out: number[] = []
  const table = new Int32Array(1 << HASH_LOG).fill(-1)
  const read32 = (i: number) => src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24)
  const hash = (v: number) => Math.imul(v, 2654435761) >>> (32 - HASH_LOG)
  let anchor = 0
  let i = 0
  const limit = src.length - MF_LIMIT

  const emit = (litEnd: number, matchLen: number, offset: number) => {
    const lit = litEnd - anchor
    const token = (Math.min(lit, 15) << 4) | (matchLen ? Math.min(matchLen - MIN_MATCH, 15) : 0)
    out.push(token)
    if (lit >= 15) writeLength(out, lit - 15)
    for (let k = anchor; k < litEnd; k++) out.push(src[k])
    if (!matchLen) return
    out.push(offset & 0xff, offset >> 8)
    if (matchLen - MIN_MATCH >= 15) writeLength(out, matchLen - MIN_MATCH - 15)
  }

  while (i < limit) {
    const v = read32(i)
    const h = hash(v)
    const ref = table[h]
    table[h] = i
    if (ref < 0 || i - ref > 0xffff || read32(ref) !== v) {
      i++
      continue
    }
    let len = MIN_MATCH
    const maxLen = src.length - LAST_LITERALS - i
    while (len < maxLen && src[ref + len] === src[i + len]) len++
    emit(i, len, i - ref)
    i += len
    anchor = i
  }
  emit(src.length, 0, 0)
  return Uint8Array.from(out)
}

export function decompress(src: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size)
  let ip = 0
  let op = 0
  while (ip < src.length) {
    const token = src[ip++]
    let lit = token >> 4
    if (lit === 15) {
      let b
      do lit += b = src[ip++]
      while (b === 255)
    }
    out.set(src.subarray(ip, ip + lit), op)
    ip += lit
    op += lit
    if (ip >= src.length) break
    const offset = src[ip] | (src[ip + 1] << 8)
    ip += 2
    if (!offset || offset > op) throw new Error('corrupt LZ4 block')
    let len = (token & 15) + MIN_MATCH
    if ((token & 15) === 15) {
      let b
      do len += b = src[ip++]
      while (b === 255)
    }
    if (op + len > size) throw new Error('LZ4 output larger than expected')
    for (let k = 0; k < len; k++, op++) out[op] = out[op - offset]
  }
  if (op !== size) throw new Error(`LZ4 produced ${op} bytes, expected ${size}`)
  return out
}
