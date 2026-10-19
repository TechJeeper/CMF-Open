/** Payload builders/parsers, byte-compatible with src/cmfkit/protocol/payloads.py. */
import { clip, concat, fixed, str, u32be } from './bytes'

export const POLL = Uint8Array.of(0xa5)

export const NOTIFICATION_TITLE_MAX = 20
export const NOTIFICATION_BODY_MAX = 128
export const WEATHER_CITY_MAX = 32
export const MUSIC_FIELD_MAX = 64
export const CONTACT_NAME_MAX = 32
export const CONTACT_PHONE_MAX = 25
export const CONTACTS_MAX = 20

export const ICONS = { whatsapp: 8, telegram: 12, instagram: 18, gmail: 27, generic: 0xff } as const

export const MUSIC_STOPPED = 0
export const MUSIC_PAUSED = 1
export const MUSIC_PLAYING = 2

export interface Contact {
  name: string
  phone: string
}

const nowS = () => Math.floor(Date.now() / 1000)

export function timeSync(now = nowS(), utcOffsetS = -new Date().getTimezoneOffset() * 60): Uint8Array {
  const out = new Uint8Array(8)
  const v = new DataView(out.buffer)
  v.setInt32(0, now)
  v.setInt32(4, utcOffsetS * 1000)
  return out
}

export function notification(title: string, body: string, icon: number = ICONS.generic, when = nowS()) {
  const t = clip(title, NOTIFICATION_TITLE_MAX)
  return concat(Uint8Array.of(icon & 0xff, 0), u32be(when), Uint8Array.of(t.length), t, clip(body, NOTIFICATION_BODY_MAX))
}

export function parseNotification(p: Uint8Array) {
  const tlen = p[6]
  return { icon: p[0], title: str(p.subarray(7, 7 + tlen)), body: str(p.subarray(7 + tlen)) }
}

export function musicInfo(track: string, artist: string, state = MUSIC_PLAYING, volume = 8, volumeMax = 16) {
  return concat(Uint8Array.of(state, volume, volumeMax), fixed(track, MUSIC_FIELD_MAX), fixed(artist, MUSIC_FIELD_MAX))
}

export function parseMusicInfo(p: Uint8Array) {
  return { state: p[0], track: str(p.subarray(3, 67)), artist: str(p.subarray(67, 131)) }
}

export function contacts(entries: Contact[]): Uint8Array {
  return concat(
    ...entries.slice(0, CONTACTS_MAX).map((c) => concat(fixed(c.name, CONTACT_NAME_MAX), fixed(c.phone, CONTACT_PHONE_MAX))),
  )
}

export function parseContacts(p: Uint8Array): Contact[] {
  const out: Contact[] = []
  for (let i = 0; i + 57 <= p.length; i += 57) {
    out.push({ name: str(p.subarray(i, i + 32)), phone: str(p.subarray(i + 32, i + 57)) })
  }
  return out
}

const temp = (c: number) => (c + 100) & 0xff

/** WEATHER_SET (FFFF:906B), 199 bytes. Only the city and temperature encoding are confirmed. */
export function weather(city: string, tempC = 20, condition = 1): Uint8Array {
  const day = new Uint8Array(9)
  day.set([condition, temp(tempC), temp(tempC - 3), temp(tempC + 3)])
  const days = concat(...Array(7).fill(day))
  const hours = concat(...Array(24).fill(Uint8Array.of(condition, temp(tempC))))
  const sunOne = new Uint8Array(8)
  new DataView(sunOne.buffer).setUint32(0, 6 * 3600, true)
  new DataView(sunOne.buffer).setUint32(4, 18 * 3600, true)
  const out = concat(days, hours, fixed(city, WEATHER_CITY_MAX), concat(...Array(7).fill(sunOne)))
  if (out.length !== 199) throw new Error('weather payload must be 199 bytes')
  return out
}

export const parseWeatherCity = (p: Uint8Array) => str(p.subarray(111, 143))

export const parseBattery = (p: Uint8Array) => ({ level: p[0], charging: p.length > 1 && p[1] !== 0 })

export const parseSerial = (p: Uint8Array) => str(p.subarray(1, 1 + p[0]))

export const parseFirmwareVersion = (p: Uint8Array) =>
  p.length >= 4 ? Array.from(p.subarray(0, 4)).join('.') : Array.from(p, (b) => b.toString(16)).join('')

export function photoDialInit(size: number, style = 0, x = 56, y = 77, color565 = 0xffff): Uint8Array {
  const tail = new Uint8Array(8)
  const v = new DataView(tail.buffer)
  v.setUint16(0, style)
  v.setUint16(2, x)
  v.setUint16(4, y)
  v.setUint16(6, color565)
  return concat(Uint8Array.of(1), u32be(size), Uint8Array.of(0xff, 0xff, 0xff, 0xff, 1, 1, 1), tail, new Uint8Array(8).fill(0xff))
}

export function chunkRequest(p: Uint8Array) {
  const v = new DataView(p.buffer, p.byteOffset)
  return { offset: v.getUint32(0), length: v.getUint32(4) }
}

export function buildChunkRequest(offset: number, length: number, progress = 0) {
  return concat(u32be(offset), u32be(length), Uint8Array.of(progress))
}

export function structuredDialInit(size: number, oldDialId: number): Uint8Array {
  const out = new Uint8Array(10)
  const v = new DataView(out.buffer)
  out[0] = 1
  v.setUint32(1, size, false)
  v.setUint32(5, oldDialId, false)
  out[9] = 1
  return out
}

export const DIAL_CMD_LIST = 0x01
export const DIAL_CMD_DELETE = 0x02
export const DIAL_CMD_REORDER = 0x03

export function dialList(): Uint8Array {
  return Uint8Array.of(DIAL_CMD_LIST)
}

export function dialDelete(dialId: number): Uint8Array {
  const out = new Uint8Array(5)
  out[0] = DIAL_CMD_DELETE
  new DataView(out.buffer).setUint32(1, dialId, false)
  return out
}

export function dialReorder(dialIds: number[]): Uint8Array {
  const out = new Uint8Array(1 + 1 + dialIds.length * 4)
  out[0] = DIAL_CMD_REORDER
  out[1] = dialIds.length
  const v = new DataView(out.buffer)
  dialIds.forEach((id, i) => v.setUint32(2 + i * 4, id, false))
  return out
}

export interface DialInfo {
  id: number
  type: number
  active: boolean
}

export function parseDialList(p: Uint8Array): DialInfo[] {
  const dials: DialInfo[] = []
  if (p.length < 2) return dials
  const count = p[1]
  let offset = 2
  for (let i = 0; i < count && offset + 6 <= p.length; i++) {
    const v = new DataView(p.buffer, p.byteOffset + offset)
    dials.push({
      id: v.getUint32(0, false),
      type: p[offset + 4],
      active: p[offset + 5] === 1,
    })
    offset += 6
  }
  return dials
}
