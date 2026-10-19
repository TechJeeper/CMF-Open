// Water reminder: a buzzing card every N minutes, a tap logs a glass.
export const manifest = {
  id: 'hydrate',
  name: 'Hydration',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '💧',
  description: 'Nudges you to drink on a schedule and counts glasses towards a daily goal. Quiet hours keep nights silent.',
  tickInterval: 30,
  tags: ['health'],
  buttons: { play: 'Log a glass', prev: 'Undo last glass', next: 'Snooze 15 min' },
  settings: [
    { key: 'every', label: 'Remind every N minutes', type: 'number', default: 60 },
    { key: 'goal', label: 'Glasses per day', type: 'number', default: 8 },
    { key: 'quietFrom', label: 'Quiet from (hour, 0-23)', type: 'number', default: 22 },
    { key: 'quietTo', label: 'Quiet until (hour, 0-23)', type: 'number', default: 8 },
  ],
}

let day, glasses, due

const dayKey = () => new Date().toDateString()
const minutes = (w) => Math.max(5, Number(w.settings.every) || 60)
const goal = (w) => Math.max(1, Number(w.settings.goal) || 8)

function quiet(w) {
  const h = new Date().getHours()
  const from = Number(w.settings.quietFrom) % 24
  const to = Number(w.settings.quietTo) % 24
  return from > to ? h >= from || h < to : h >= from && h < to
}

const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function rollDay(watch) {
  if (day === dayKey()) return
  day = dayKey()
  glasses = []
  watch.storage.set('state', { day, glasses })
}

async function render(watch) {
  const g = goal(watch)
  const n = glasses.length
  await watch.status(`Water ${n}/${g} ${n >= g ? '- goal met!' : ''}`.trim(), quiet(watch) ? 'quiet hours' : `next reminder ${hhmm(due)}`, {
    playing: n < g,
  })
  await watch.menu(
    glasses
      .slice(-20)
      .reverse()
      .map((t, i) => [`Glass ${n - i}`, hhmm(t)]),
  )
}

export default {
  async start(watch) {
    ;({ day, glasses } = watch.storage.get('state', { day: dayKey(), glasses: [] }))
    rollDay(watch)
    due = Date.now() + minutes(watch) * 60_000
    await render(watch)
  },

  async onButton(watch, button) {
    rollDay(watch)
    if (button === 'play' || button === 'pause') {
      glasses.push(Date.now())
      due = Date.now() + minutes(watch) * 60_000
      if (glasses.length === goal(watch)) await watch.card('Hydration', `Goal reached: ${glasses.length} glasses today!`)
    } else if (button === 'prev') glasses.pop()
    else if (button === 'next') due = Date.now() + 15 * 60_000
    watch.storage.set('state', { day, glasses })
    await render(watch)
  },

  async tick(watch) {
    rollDay(watch)
    if (Date.now() >= due) {
      due = Date.now() + minutes(watch) * 60_000
      if (!quiet(watch) && glasses.length < goal(watch)) {
        await watch.card('Time for water', `${glasses.length}/${goal(watch)} today. Press play when you've had a glass.`)
      }
    }
    await render(watch)
  },
}
