export type Channel = 'command' | 'shell' | 'data'

export type NotifyHandler = (channel: Channel, data: Uint8Array) => void

export interface Transport {
  readonly name: string
  readonly id: string
  readonly mtu: number
  setNotifyHandler(handler: NotifyHandler): void
  connect(): Promise<void>
  disconnect(): Promise<void>
  write(channel: Channel, data: Uint8Array): Promise<void>
  onDisconnect?: () => void
}
