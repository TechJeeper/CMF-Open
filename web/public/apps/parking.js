// Remember where you parked and how long you have been there.
export const manifest = {
  id: 'parking',
  name: 'Parking',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🅿️',
  description: 'Save your spot and see how long you have been parked. Buzzes when a meter limit you set is almost up.',
  tickInterval: 30,
  tags: ['travel', 'utility'],
  buttons: { play: 'Parked here now / clear', next: '+15 min limit', prev: '-15 min limit', vol_up: 'Note in list' },
  settings: [
    { key: 'spot', label: 'Default spot note', type: 'text', default: 'Level 3, row B' },
    { key: 'limit', label: 'Meter limit (minutes, 0=none)', type: 'number', default: 120 },
  ],
}

let parkedAt, note, limitMin, warned

const fmt = (sec) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

async function render(watch) {
  const notes = watch.storage.get('notes', [])
  if (note) await watch.menu(notes.slice(0, 20).map((n) => [n.text, fmt(Math.floor((Date.now() - n.at) / 1000))]))
  if (!parkedAt) return watch.status('Not parked', 'Play when you park', { playing: false })
  const elapsed = Math.floor((Date.now() - parkedAt) / 1000)
  const left = limitMin ? limitMin * 60 - elapsed : null
  await watch.status(note || 'Parked', fmt(elapsed), { playing: true })
  if (left != null) await watch.ticker(left > 0 ? `${fmt(left)} left` : 'EXPIRED')
}

export default {
  async start(watch) {
    ;({ parkedAt, note, limitMin } = watch.storage.get('session', {
      parkedAt: null,
      note: String(watch.settings.spot || ''),
      limitMin: Number(watch.settings.limit) || 0,
    }))
    warned = false
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      if (parkedAt) {
        parkedAt = null
        note = String(watch.settings.spot || '')
      } else {
        parkedAt = Date.now()
        note = String(watch.settings.spot || 'Parked')
        warned = false
      }
    } else if (button === 'next') limitMin = Math.min(480, limitMin + 15)
    else if (button === 'prev') limitMin = Math.max(0, limitMin - 15)
    else if (button === 'vol_up') {
      const notes = watch.storage.get('notes', [])
      notes.unshift({ text: note, at: parkedAt || Date.now() })
      watch.storage.set('notes', notes.slice(0, 20))
    }
    watch.storage.set('session', { parkedAt, note, limitMin })
    await render(watch)
  },

  async tick(watch) {
    if (!parkedAt || !limitMin || warned) return
    const left = limitMin * 60 - (Date.now() - parkedAt) / 1000
    if (left <= 600 && left > 0) {
      warned = true
      await watch.card('Parking meter', `${Math.ceil(left / 60)} minutes left`)
    } else if (left <= 0) {
      warned = true
      await watch.card('Parking meter', 'Time may be up!')
    }
    await render(watch)
  },
}
