/** Command-channel opcodes, mirroring src/cmfkit/protocol/opcodes.py. */

export interface Op {
  cmd1: number
  cmd2: number
}

const op = (cmd1: number, cmd2: number): Op => ({ cmd1, cmd2 })

export const opKey = (o: Op) =>
  `${o.cmd1.toString(16).toUpperCase().padStart(4, '0')}:${o.cmd2.toString(16).toUpperCase().padStart(4, '0')}`

export const sameOp = (a: Op, b: Op) => a.cmd1 === b.cmd1 && a.cmd2 === b.cmd2

export const OPS = {
  TIME: op(0xffff, 0x8004),
  FIRMWARE_VERSION_GET: op(0xffff, 0x8006),
  FIRMWARE_VERSION_RET: op(0xffff, 0x0006),
  SERIAL_NUMBER_GET: op(0x00de, 0x0002),
  SERIAL_NUMBER_RET: op(0x00de, 0x0001),
  BATTERY: op(0x005c, 0x0001),

  AUTH_PAIR_REQUEST: op(0xffff, 0x8047),
  AUTH_PAIR_REPLY: op(0xffff, 0x0048),
  AUTH_PHONE_NAME: op(0xffff, 0x8049),
  AUTH_WATCH_MAC: op(0xffff, 0x0049),
  AUTH_NONCE_REQUEST: op(0xffff, 0x804b),
  AUTH_NONCE_REPLY: op(0xffff, 0x004c),
  AUTH_CONFIRM_REQUEST: op(0xffff, 0x804d),
  AUTH_CONFIRM_REPLY: op(0xffff, 0x0004),
  AUTH_FAILED: op(0xffff, 0xa061),

  APP_NOTIFICATION: op(0x0065, 0x0001),
  APP_NOTIFICATION_ACK: op(0x0065, 0x0003),
  FIND_PHONE: op(0x005b, 0x0001),
  FIND_WATCH: op(0x005d, 0x0001),
  FIND_WATCH_ACK: op(0x005d, 0x0003),

  MUSIC_INFO_SET: op(0xffff, 0x905c),
  MUSIC_INFO_ACK: op(0xffff, 0xa05c),
  MUSIC_BUTTON: op(0xffff, 0xa05d),

  CONTACTS_SET: op(0x00d5, 0x0001),
  CONTACTS_ACK: op(0x00d5, 0x0003),
  WEATHER_SET: op(0xffff, 0x906b),

  WF_INIT1_REQUEST: op(0xffff, 0x8052),
  WF_INIT1_REPLY: op(0xffff, 0x0052),
  WF_INIT2_PHOTO_REQUEST: op(0xffff, 0x9063),
  WF_INIT2_PHOTO_REPLY: op(0xffff, 0xa063),
  WF_INIT2_STRUCTURED_REQUEST: op(0xffff, 0x9075),
  WF_INIT2_STRUCTURED_REPLY: op(0xffff, 0xa075),
  WF_CHUNK_REQUEST: op(0xffff, 0xa064),
  WF_CHUNK_WRITE: op(0xffff, 0x9064),
  WF_FINISH_REQUEST: op(0xffff, 0xa065),
  WF_FINISH_ACK: op(0xffff, 0x9065),

  DIAL_COMMAND: op(0xffff, 0x9055),
  DIAL_COMMAND_REPLY: op(0xffff, 0xa055),

  FW_CHUNK_WRITE: op(0xffff, 0x9042),
} as const

const PLAINTEXT = new Set(
  [OPS.AUTH_PAIR_REQUEST, OPS.AUTH_PAIR_REPLY, OPS.WF_CHUNK_WRITE, OPS.FW_CHUNK_WRITE, op(0xffff, 0x905f)].map(opKey),
)

export const isPlaintextOp = (o: Op) => PLAINTEXT.has(opKey(o))

const NAMES = new Map(Object.entries(OPS).map(([name, o]) => [opKey(o), name]))

export const nameOf = (o: Op) => NAMES.get(opKey(o)) ?? opKey(o)
