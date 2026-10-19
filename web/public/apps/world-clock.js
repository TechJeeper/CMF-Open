// World clock: one city on the music card, all of them in the contacts list.
export const manifest = {
  id: 'world-clock',
  name: 'World Clock',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🌍',
  description: 'Time in the cities you care about. Flick through them with next/prev; the whole list sits in contacts.',
  tickInterval: 15,
  tags: ['travel', 'utility'],
  buttons: { next: 'Next city', prev: 'Previous city', play: 'Show all as a card' },
  settings: [
    {
      key: 'zones',
      label: 'Cities as "Name | IANA time zone", one per line',
      type: 'textarea',
      default:
        'London | Europe/London\nNew York | America/New_York\nSan Francisco | America/Los_Angeles\nTokyo | Asia/Tokyo\nSydney | Australia/Sydney\nDubai | Asia/Dubai',
    },
    { key: 'h12', label: '12-hour clock', type: 'boolean', default: false },
  ],
}

let zones, cursor

function timeIn(zone, h12, withDay = false) {
  const opts = { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: h12 }
  if (withDay) opts.weekday = 'short'
  return new Intl.DateTimeFormat('en-GB', opts).format(new Date())
}

function offset(zone) {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US'))
  const there = new Date(now.toLocaleString('en-US', { timeZone: zone }))
  const h = Math.round((there - local) / 36e5 * 2) / 2
  return h === 0 ? 'same as here' : `${h > 0 ? '+' : ''}${h}h from here`
}

async function render(watch) {
  const h12 = Boolean(watch.settings.h12)
  const z = zones[cursor]
  await watch.status(`${z.name} ${timeIn(z.zone, h12, true)}`, offset(z.zone))
  await watch.ticker(`${z.name} ${timeIn(z.zone, h12)}`)
  await watch.menu(zones.map((x) => [x.name, timeIn(x.zone, h12, true)]))
}

export default {
  async start(watch) {
    zones = String(watch.settings.zones)
      .split('\n')
      .map((l) => l.split('|').map((s) => s.trim()))
      .filter(([name, zone]) => {
        if (!name || !zone) return false
        try {
          new Intl.DateTimeFormat('en', { timeZone: zone })
          return true
        } catch {
          watch.log(`skipping unknown time zone "${zone}"`)
          return false
        }
      })
      .map(([name, zone]) => ({ name, zone }))
      .slice(0, 20)
    if (!zones.length) zones = [{ name: 'UTC', zone: 'UTC' }]
    cursor = 0
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'next') cursor = (cursor + 1) % zones.length
    else if (button === 'prev') cursor = (cursor - 1 + zones.length) % zones.length
    else if (button === 'play' || button === 'pause') {
      const h12 = Boolean(watch.settings.h12)
      await watch.card('World Clock', zones.map((z) => `${z.name} ${timeIn(z.zone, h12)}`).join(', '))
    }
    await render(watch)
  },

  tick: render,
}
