/** What the watch is currently showing for each app surface. Rendered by the WatchPreview. */
import type { Rgba } from './watchface/photo'

export interface DisplayState {
  music: { track: string; artist: string; playing: boolean }
  notifications: { title: string; body: string; at: number }[]
  weatherCity: string
  weatherTemp: number
  contacts: { name: string; phone: string }[]
  dial: Rgba | null
  buzzes: number
  lastSurface: 'music' | 'notification' | 'weather' | 'contacts' | 'dial' | null
}

export const emptyDisplay = (): DisplayState => ({
  music: { track: '', artist: '', playing: false },
  notifications: [],
  weatherCity: '',
  weatherTemp: 20,
  contacts: [],
  dial: null,
  buzzes: 0,
  lastSurface: null,
})

type Listener = (s: DisplayState) => void

export class DisplayStore {
  state = emptyDisplay()
  private listeners = new Set<Listener>()

  update(fn: (s: DisplayState) => Partial<DisplayState>) {
    this.state = { ...this.state, ...fn(this.state) }
    this.listeners.forEach((l) => l(this.state))
  }

  reset() {
    this.state = emptyDisplay()
    this.listeners.forEach((l) => l(this.state))
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
}
