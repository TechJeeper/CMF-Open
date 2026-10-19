/** Per-watch auth keys. Only the derived key is stored, never the factory secret. */
import { fromHex, hex } from '@/lib/protocol/bytes'

const KEY = 'cmf.keys.v1'

const all = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const loadAuthkey = (id: string) => (all()[id] ? fromHex(all()[id]) : null)

export function saveAuthkey(id: string, key: Uint8Array | null) {
  const keys = all()
  if (key) keys[id] = hex(key)
  else delete keys[id]
  localStorage.setItem(KEY, JSON.stringify(keys))
}
