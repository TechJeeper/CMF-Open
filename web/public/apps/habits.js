// Daily habit tracker with streaks. The contacts list shows every habit and its streak.
export const manifest = {
  id: 'habits',
  name: 'Habit Tracker',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🌱',
  description: 'Tick off daily habits from your wrist and keep the streaks going. Resets each day, remembers your history.',
  tickInterval: 60,
  tags: ['health', 'productivity'],
  buttons: { play: 'Done today / undo', next: 'Next habit', prev: 'Previous habit' },
  settings: [
    {
      key: 'habits',
      label: 'Habits (one per line, max 20)',
      type: 'textarea',
      default: 'Drink 2L water\nWalk 8000 steps\nRead 20 pages\nNo phone in bed\nStretch',
    },
  ],
}

let habits, log, cursor, today

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dayKey(d)
}

function streak(habit) {
  const days = log[habit] ?? {}
  // A streak survives until the end of today even if today isn't ticked yet.
  let n = 0
  for (let i = days[today] ? 0 : 1; days[daysAgo(i)]; i++) n++
  return n
}

async function render(watch) {
  await watch.menu(habits.map((h) => [`${log[h]?.[today] ? '[x]' : '[ ]'} ${h}`, `${streak(h)} day streak`]))
  const h = habits[cursor]
  const doneToday = habits.filter((x) => log[x]?.[today]).length
  await watch.status(h, `${log[h]?.[today] ? 'done' : 'todo'} - ${streak(h)}d streak - ${doneToday}/${habits.length} today`, {
    playing: !log[h]?.[today],
  })
}

export default {
  async start(watch) {
    habits = String(watch.settings.habits)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
    if (!habits.length) habits = ['Add habits in the app settings']
    log = watch.storage.get('log', {})
    today = dayKey()
    cursor = 0
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      const h = habits[cursor]
      log[h] = log[h] ?? {}
      if (log[h][today]) delete log[h][today]
      else {
        log[h][today] = true
        const s = streak(h)
        if (s > 1 && s % 7 === 0) await watch.card('Streak!', `${h}: ${s} days in a row`)
      }
      watch.storage.set('log', log)
      if (habits.every((x) => log[x]?.[today])) await watch.card('Habits', 'Everything done for today!')
    } else if (button === 'next') cursor = (cursor + 1) % habits.length
    else if (button === 'prev') cursor = (cursor - 1 + habits.length) % habits.length
    await render(watch)
  },

  async tick(watch) {
    if (dayKey() !== today) {
      today = dayKey()
      await render(watch)
    }
  },
}
