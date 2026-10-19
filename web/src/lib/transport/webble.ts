/** Web Bluetooth transport (Chrome/Edge on desktop and Android, Bluefy on iOS). */
import type { Channel, NotifyHandler, Transport } from './types'

const SERVICES = {
  command: '0000fff0-0000-1000-8000-00805f9b34fb',
  shell: '77d4e67c-2fe2-2334-0d35-9ccd078f529c',
  data: '02f00000-0000-0000-0000-00000000ffe0',
  firmware: '02f00000-0000-0000-0000-00000000fe00',
}

const WRITE: Record<Channel, string> = {
  command: '0000fff2-0000-1000-8000-00805f9b34fb',
  shell: '77d4ff01-2fe2-2334-0d35-9ccd078f529c',
  data: '02f00000-0000-0000-0000-00000000ffe1',
}

const NOTIFY: Record<Channel, string> = {
  command: '0000fff1-0000-1000-8000-00805f9b34fb',
  shell: '77d4ff02-2fe2-2334-0d35-9ccd078f529c',
  data: '02f00000-0000-0000-0000-00000000ffe2',
}

export const NAME_PREFIX = 'CMF Watch'

// Web Bluetooth does not expose the negotiated MTU. Android and desktop Chrome negotiate
// 247+ with this watch; 185 keeps every frame inside one write on iOS too.
const ASSUMED_MTU = 185

export const webBluetoothAvailable = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator

export class WebBleTransport implements Transport {
  readonly mtu = ASSUMED_MTU
  onDisconnect?: () => void
  private handler: NotifyHandler | null = null
  private chars = new Map<string, BluetoothRemoteGATTCharacteristic>()
  private queue: Promise<unknown> = Promise.resolve()
  private readonly device: BluetoothDevice

  constructor(device: BluetoothDevice) {
    this.device = device
    device.addEventListener('gattserverdisconnected', () => this.onDisconnect?.())
  }

  static async request(): Promise<WebBleTransport> {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: NAME_PREFIX }],
      optionalServices: Object.values(SERVICES),
    })
    return new WebBleTransport(device)
  }

  get name() {
    return this.device.name ?? 'CMF Watch'
  }

  get id() {
    return this.device.id
  }

  setNotifyHandler(handler: NotifyHandler) {
    this.handler = handler
  }

  async connect() {
    const server = await this.device.gatt!.connect()
    for (const service of await server.getPrimaryServices()) {
      for (const c of await service.getCharacteristics()) this.chars.set(c.uuid, c)
    }
    for (const [channel, uuid] of Object.entries(NOTIFY) as [Channel, string][]) {
      const c = this.chars.get(uuid)
      if (!c) continue
      c.addEventListener('characteristicvaluechanged', () => {
        const v = c.value!
        this.handler?.(channel, new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)))
      })
      await c.startNotifications()
    }
    if (!this.chars.has(WRITE.command)) throw new Error('This device does not expose the CMF command service')
  }

  async disconnect() {
    this.device.gatt?.disconnect()
    this.chars.clear()
  }

  write(channel: Channel, data: Uint8Array): Promise<void> {
    const c = this.chars.get(WRITE[channel])
    if (!c) return Promise.reject(new Error(`watch has no ${channel} characteristic`))
    const run = this.queue.then(() => c.writeValueWithoutResponse(data as Uint8Array<ArrayBuffer>))
    this.queue = run.catch(() => undefined)
    return run
  }
}
