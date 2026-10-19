/** AES-128-CBC (fixed IV, PKCS7), CRC32-LE and SHA-256 key derivation via WebCrypto. */
import { concat, fromHex } from './bytes'

export const AES_IV = fromHex('5051525354555657606162636465665A')

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function crc32le(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, crc32(data), true)
  return out
}

const buf = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>

export async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf(concat(...parts))))
}

export const sign = (rnd: Uint8Array, secret: Uint8Array) => sha256(rnd, secret)

export async function deriveAuthkey(rnd1: Uint8Array, rnd2: Uint8Array, secret: Uint8Array) {
  return (await sha256(rnd1, rnd2, secret)).slice(0, 16)
}

export async function deriveSessionKey(nonce: Uint8Array, authkey: Uint8Array) {
  return (await sha256(nonce, authkey)).slice(0, 16)
}

const keyCache = new Map<string, Promise<CryptoKey>>()

function importKey(key: Uint8Array): Promise<CryptoKey> {
  const id = Array.from(key).join(',')
  let k = keyCache.get(id)
  if (!k) {
    k = crypto.subtle.importKey('raw', buf(key), 'AES-CBC', false, ['encrypt', 'decrypt'])
    if (keyCache.size > 32) keyCache.clear()
    keyCache.set(id, k)
  }
  return k
}

export async function aesEncrypt(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const k = await importKey(key)
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: buf(AES_IV) }, k, buf(plaintext)))
}

export async function aesDecrypt(key: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
  const k = await importKey(key)
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: buf(AES_IV) }, k, buf(ciphertext)))
}
