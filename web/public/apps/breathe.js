// Guided breathing: box, 4-7-8 or a custom pattern, with a buzz on every phase change.
export const manifest = {
  id: 'breathe',
  name: 'Breathe',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🫁',
  description: 'Box breathing, 4-7-8 or your own pattern. Follow the buzzes with your eyes closed.',
  tickInterval: 1,
  tags: ['health'],
  buttons: { play: 'Start / pause', next: 'Next pattern', prev: 'Previous pattern' },
  settings: [
    { key: 'minutes', label: 'Session minutes', type: 'number', default: 3 },
    { key: 'custom', label: 'Custom pattern (in-hold-out-hold seconds)', type: 'text', default: '5-0-5-0' },
    { key: 'buzz', label: 'Buzz on every phase', type: 'boolean', default: true },
  ],
}

const NAMES = ['Breathe in', 'Hold', 'Breathe out', 'Hold']

let patterns, which, phase, remaining, elapsed, paused, last, total

function parse(text) {
  const parts = String(text)
    .split(/[^0-9.]+/)
    .filter(Boolean)
    .map(Number)
  while (parts.length < 4) parts.push(0)
  return parts.slice(0, 4).map((n) => Math.min(30, Math.max(0, n)))
}

const nextPhase = (from) => {
  const p = patterns[which].steps
  let i = from
  do i = (i + 1) % 4
  while (!p[i] && i !== from)
  return i
}

async function render(watch) {
  const pat = patterns[which]
  const left = Math.max(0, Math.ceil(total - elapsed))
  const sub = `${pat.name} - ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`
  if (paused) return watch.status(elapsed ? 'Paused' : 'Ready when you are', sub, { playing: false })
  await watch.status(`${NAMES[phase]}  ${Math.max(1, Math.ceil(remaining))}`, sub)
}

function reset() {
  phase = 0
  remaining = patterns[which].steps[0] || 1
  elapsed = 0
  paused = true
}

export default {
  async start(watch) {
    patterns = [
      { name: 'Box 4-4-4-4', steps: [4, 4, 4, 4] },
      { name: '4-7-8 relax', steps: [4, 7, 8, 0] },
      { name: 'Coherent 5-5', steps: [5, 0, 5, 0] },
      { name: 'Custom', steps: parse(watch.settings.custom) },
    ]
    if (!patterns[3].steps.some(Boolean)) patterns.pop()
    which = 0
    total = Math.max(1, Number(watch.settings.minutes) || 3) * 60
    reset()
    last = Date.now()
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') paused = !paused
    else if (button === 'next' || button === 'prev') {
      which = (which + (button === 'next' ? 1 : patterns.length - 1)) % patterns.length
      reset()
    }
    last = Date.now()
    await render(watch)
  },

  async tick(watch) {
    const now = Date.now()
    if (!paused) {
      const dt = (now - last) / 1000
      elapsed += dt
      remaining -= dt
      if (elapsed >= total) {
        reset()
        await watch.card('Breathe', `Session complete. ${Math.round(total / 60)} min of calm.`)
      } else if (remaining <= 0) {
        phase = nextPhase(phase)
        remaining = patterns[which].steps[phase]
        if (watch.settings.buzz) await watch.buzz()
      }
    }
    last = now
    await render(watch)
  },
}
