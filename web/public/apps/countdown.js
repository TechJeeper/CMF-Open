// Countdown to upcoming events: trips, launches, birthdays.
export const manifest = {
  id: 'countdown',
  name: 'Countdown',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '⏳',
  description: 'Days, hours and minutes until the things you are looking forward to. Buzzes when an event arrives.',
  tickInterval: 30,
  tags: ['utility', 'timer'],
  buttons: { next: 'Next event', prev: 'Previous event', play: 'Show as a card' },
  settings: [
    {
      key: 'events',
      label: 'Events as "Name | YYYY-MM-DD HH:MM", one per line',
      type: 'textarea',
      default: 'New Year | 2027-01-01 00:00\nSummer holiday | 2027-07-15 09:00',
    },
  ],
}

let events, cursor, fired

function parseWhen(text) {
  const m = String(text).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/)
  if (!m) return null
  const [, y, mo, d, h = '0', mi = '0'] = m
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)).getTime()
}

function left(at) {
  const ms = at - Date.now()
  if (ms <= 0) return 'now!'
  const mins = Math.floor(ms / 60_000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m` : `${m}m`
}

async function render(watch) {
  if (!events.length) return watch.status('No events', 'add some in the app settings', { playing: false })
  const e = events[cursor]
  await watch.status(`${e.name}: ${left(e.at)}`, new Date(e.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))
  await watch.ticker(`${left(e.at)} ${e.name}`.slice(0, 32))
  await watch.menu(events.map((x) => [x.name, left(x.at)]))
}

export default {
  async start(watch) {
    events = String(watch.settings.events)
      .split('\n')
      .map((l) => l.split('|').map((s) => s.trim()))
      .map(([name, when]) => ({ name, at: parseWhen(when) }))
      .filter((e) => e.name && e.at)
      .sort((a, b) => a.at - b.at)
      .slice(0, 20)
    // Start on the soonest event that hasn't happened yet.
    cursor = Math.max(0, events.findIndex((e) => e.at > Date.now()))
    fired = new Set(events.filter((e) => e.at <= Date.now()).map((e) => e.name))
    await render(watch)
  },

  async onButton(watch, button) {
    if (events.length) {
      if (button === 'next') cursor = (cursor + 1) % events.length
      else if (button === 'prev') cursor = (cursor - 1 + events.length) % events.length
      else if (button === 'play' || button === 'pause') await watch.card(events[cursor].name, `${left(events[cursor].at)} to go`)
    }
    await render(watch)
  },

  async tick(watch) {
    for (const e of events) {
      if (e.at <= Date.now() && !fired.has(e.name)) {
        fired.add(e.name)
        await watch.card("It's time!", e.name)
      }
    }
    await render(watch)
  },
}
