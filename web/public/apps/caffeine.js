// Log caffeine intake toward a daily limit.
export const manifest = {
  id: 'caffeine',
  name: 'Caffeine Log',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '☕',
  description: 'Track mg of caffeine for the day with one-tap presets. Resets at midnight; buzzes if you go over your limit.',
  tickInterval: 60,
  tags: ['health'],
  buttons: { play: 'Espresso (+64mg)', next: 'Coffee (+95mg)', prev: 'Tea (+47mg)', vol_up: 'Undo last' },
  settings: [{ key: 'limit', label: 'Daily limit (mg)', type: 'number', default: 400 }],
}

let day, total, log

const dayKey = () => new Date().toDateString()

async function render(watch) {
  const limit = Math.max(50, Number(watch.settings.limit) || 400)
  await watch.menu(log.slice(0, 20).map((e) => [e.name, `${e.mg} mg`]))
  await watch.status(`${total} / ${limit} mg`, total >= limit ? 'over limit' : `${limit - total} mg left`, {
    playing: total < limit,
  })
}

export default {
  async start(watch) {
    ;({ day, total, log } = watch.storage.get('caf', { day: dayKey(), total: 0, log: [] }))
    if (day !== dayKey()) {
      day = dayKey()
      total = 0
      log = []
    }
    await render(watch)
  },

  async onButton(watch, button) {
    if (day !== dayKey()) {
      day = dayKey()
      total = 0
      log = []
    }
    const add = { play: ['Espresso', 64], next: ['Coffee', 95], prev: ['Tea', 47] }[button]
    if (add) {
      total += add[1]
      log.unshift({ name: add[0], mg: add[1], at: Date.now() })
      const limit = Number(watch.settings.limit) || 400
      if (total >= limit) await watch.card('Caffeine', `Daily limit (${limit} mg) reached`)
    } else if (button === 'vol_up' && log.length) {
      total -= log.shift().mg
      total = Math.max(0, total)
    }
    watch.storage.set('caf', { day, total, log })
    await render(watch)
  },

  async tick(watch) {
    if (dayKey() !== day) {
      day = dayKey()
      total = 0
      log = []
      watch.storage.set('caf', { day, total, log })
      await render(watch)
    }
  },
}
