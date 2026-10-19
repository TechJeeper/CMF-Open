// Pomodoro focus timer on the music card.
export const manifest = {
  id: 'pomodoro',
  name: 'Pomodoro',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🍅',
  description: 'Focus/break timer on the music screen. A card buzzes your wrist at every phase change.',
  tickInterval: 1,
  tags: ['productivity', 'timer'],
  buttons: { play: 'Start / pause', next: 'Skip to next phase', prev: 'Restart this phase' },
  settings: [
    { key: 'focus', label: 'Focus minutes', type: 'number', default: 25 },
    { key: 'rest', label: 'Break minutes', type: 'number', default: 5 },
  ],
}

let phases, phase, remaining, paused, rounds, last

const pad = (n) => String(n).padStart(2, '0')

async function render(watch) {
  const [label] = phases[phase]
  const s = Math.max(0, Math.ceil(remaining))
  const state = paused ? 'paused' : `${rounds} done`
  await watch.status(`${label} ${pad(Math.floor(s / 60))}:${pad(s % 60)}`, `Pomodoro - ${state}`, { playing: !paused })
}

async function advance(watch) {
  if (phase === 0) rounds++
  phase = (phase + 1) % phases.length
  remaining = phases[phase][1]
  await watch.card('Pomodoro', `${phases[phase][0]} time - ${phases[phase][1] / 60} min`)
}

export default {
  async start(watch) {
    phases = [
      ['Focus', Number(watch.settings.focus || 25) * 60],
      ['Break', Number(watch.settings.rest || 5) * 60],
    ]
    phase = 0
    remaining = phases[0][1]
    paused = true
    rounds = 0
    last = Date.now()
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') paused = !paused
    else if (button === 'next') await advance(watch)
    else if (button === 'prev') remaining = phases[phase][1]
    last = Date.now()
    await render(watch)
  },

  async tick(watch) {
    const now = Date.now()
    if (!paused) {
      remaining -= (now - last) / 1000
      if (remaining <= 0) await advance(watch)
    }
    last = now
    await render(watch)
  },
}
