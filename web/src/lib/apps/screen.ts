/**
 * Maps app drawing calls onto the stock firmware's text surfaces (see docs/03, path A):
 * status -> music card, card -> notification, ticker -> weather city, menu -> contacts.
 * Unchanged status/ticker/menu calls are dropped so apps can redraw every tick.
 */
import type { DisplayStore } from '../display'
import * as pl from '../protocol/payloads'
import type { Session } from '../session'
import type { ScreenCall } from './messages'

export class Screen {
  private last = new Map<string, string>()
  private readonly session: Session
  private readonly mirror: DisplayStore | null

  /** `mirror` is updated for real watches; the simulator decodes its own display state. */
  constructor(session: Session, mirror: DisplayStore | null) {
    this.session = session
    this.mirror = mirror
  }

  private changed(key: string, value: unknown) {
    const v = JSON.stringify(value)
    if (this.last.get(key) === v) return false
    this.last.set(key, v)
    return true
  }

  async apply(c: ScreenCall): Promise<void> {
    const s = this.session
    const m = this.mirror
    switch (c.call) {
      case 'status': {
        const [track, artist, playing] = c.args
        if (!this.changed('status', c.args)) return
        await s.setMusic(track, artist, playing ? pl.MUSIC_PLAYING : pl.MUSIC_PAUSED)
        m?.update(() => ({ music: { track, artist, playing }, lastSurface: 'music' }))
        return
      }
      case 'card': {
        const [title, body] = c.args
        await s.notify(title, body)
        m?.update((st) => ({
          notifications: [{ title, body, at: Date.now() }, ...st.notifications].slice(0, 20),
          buzzes: st.buzzes + 1,
          lastSurface: 'notification',
        }))
        return
      }
      case 'ticker': {
        const [city, temp] = c.args
        if (!this.changed('ticker', c.args)) return
        await s.setWeather(city, temp)
        m?.update(() => ({ weatherCity: city, weatherTemp: temp, lastSurface: 'weather' }))
        return
      }
      case 'menu': {
        const rows = c.args[0].slice(0, pl.CONTACTS_MAX).map(([name, phone]) => ({ name, phone }))
        if (!this.changed('menu', rows)) return
        await s.setContacts(rows)
        m?.update(() => ({ contacts: rows, lastSurface: 'contacts' }))
        return
      }
      case 'buzz':
        try {
          await s.shell('AT SETMOTOR=1', 2000)
        } catch {
          // SET* commands often execute without echoing OK.
        }
        m?.update((st) => ({ buzzes: st.buzzes + 1 }))
    }
  }
}
