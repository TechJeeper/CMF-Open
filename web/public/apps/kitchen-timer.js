// Named kitchen timers: soup, pasta, eggs — all at once.
export const manifest = {
  id: 'kitchen-timer',
  name: 'Kitchen Timers',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🍳',
  description: 'Run several named timers together. Play starts the selected one; next/prev pick which timer you are editing.',
  tickInterval: 1,
  tags: ['timer', 'utility'],
  buttons: { play: 'Start / pause selected', next: 'Next timer', prev: 'Previous timer', vol_up: '+1 min', vol_down: '-1 min' },
  settings: [
    {
      key: 'timers',
      label: 'Timers as "name | minutes", one per line',
      type: 'textarea',
      default: 'Pasta | 9\nEggs | 7\nSoup | 25\nTea | 3',
    },
  ],
}

let timers, idx, last

const pad = (n) => String(n).padStart(2, '0')

async function render(watch) {
  const t = timers[idx]
  const left = Math.max(0, Math.ceil(t.remaining))
  await watch.menu(timers.map((x) => [x.name, x.running ? `${pad(Math.floor(x.remaining / 60))}:${pad(x.remaining % 60)}` : `${x.mins}m`]))
  await watch.status(
    `${t.name} ${pad(Math.floor(left / 60))}:${pad(left % 60)}`,
    t.running ? 'running' : `${idx + 1}/${timers.length} - play to start`,
    { playing: t.running },
  )
}

export default {
  async start(watch) {
    timers = String(watch.settings.timers)
      .split('\n')
      .map((l) => l.split('|').map((s) => s.trim()))
      .filter(([n, m]) => n && m)
      .map(([name, mins]) => ({
        name: name.slice(0, 20),
        mins: Math.max(1, Number(mins) || 1),
        remaining: Math.max(1, Number(mins) || 1) * 60,
        running: false,
      }))
      .slice(0, 8)
    if (!timers.length) timers = [{ name: 'Timer', mins: 5, remaining: 300, running: false }]
    idx = 0
    last = Date.now()
    await render(watch)
  },

  async onButton(watch, button) {
    const t = timers[idx]
    if (button === 'play' || button === 'pause') {
      if (t.remaining <= 0) t.remaining = t.mins * 60
      t.running = !t.running
    } else if (button === 'next') idx = (idx + 1) % timers.length
    else if (button === 'prev') idx = (idx - 1 + timers.length) % timers.length
    else if (button === 'vol_up') {
      t.mins++
      if (!t.running) t.remaining = t.mins * 60
    } else if (button === 'vol_down') {
      t.mins = Math.max(1, t.mins - 1)
      if (!t.running) t.remaining = t.mins * 60
    }
    last = Date.now()
    await render(watch)
  },

  async tick(watch) {
    const now = Date.now()
    const dt = (now - last) / 1000
    last = now
    for (const t of timers) {
      if (!t.running) continue
      t.remaining -= dt
      if (t.remaining <= 0) {
        t.remaining = 0
        t.running = false
        await watch.card(t.name, 'Timer done!')
      }
    }
    await render(watch)
  },
}
