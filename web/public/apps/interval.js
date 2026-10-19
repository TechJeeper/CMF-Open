// HIIT / Tabata interval timer: work and rest rounds with a buzz at every switch.
export const manifest = {
  id: 'interval',
  name: 'Interval Timer',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🔥',
  description: 'Work/rest rounds for HIIT, Tabata or circuits. Your wrist buzzes at every switch so you never look at a clock.',
  tickInterval: 1,
  tags: ['sport', 'timer', 'health'],
  buttons: { play: 'Start / pause', next: 'Skip to next interval', prev: 'Restart workout' },
  settings: [
    { key: 'work', label: 'Work seconds', type: 'number', default: 40 },
    { key: 'rest', label: 'Rest seconds', type: 'number', default: 20 },
    { key: 'rounds', label: 'Rounds', type: 'number', default: 8 },
    { key: 'warmup', label: 'Get-ready seconds', type: 'number', default: 10 },
  ],
}

let plan, step, remaining, paused, last

const pad = (n) => String(n).padStart(2, '0')
const clock = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`

function buildPlan(settings) {
  const work = Math.max(5, Number(settings.work) || 40)
  const rest = Math.max(0, Number(settings.rest) || 0)
  const rounds = Math.min(99, Math.max(1, Number(settings.rounds) || 8))
  const out = []
  const warmup = Math.max(0, Number(settings.warmup) || 0)
  if (warmup) out.push({ label: 'Get ready', secs: warmup, round: 0 })
  for (let r = 1; r <= rounds; r++) {
    out.push({ label: 'Work', secs: work, round: r })
    if (rest && r < rounds) out.push({ label: 'Rest', secs: rest, round: r })
  }
  return out
}

const rounds = () => plan[plan.length - 1].round

async function render(watch) {
  if (step >= plan.length) return watch.status('Workout done!', `${rounds()} rounds - prev to restart`, { playing: false })
  const cur = plan[step]
  const where = cur.round ? `round ${cur.round}/${rounds()}` : 'starting soon'
  await watch.status(`${cur.label} ${clock(Math.max(0, Math.ceil(remaining)))}`, paused ? `paused - ${where}` : where, {
    playing: !paused,
  })
}

async function advance(watch) {
  step++
  if (step >= plan.length) {
    paused = true
    await watch.card('Interval Timer', `Done! ${rounds()} rounds complete.`)
    return
  }
  remaining = plan[step].secs
  const cur = plan[step]
  await watch.card(cur.label.toUpperCase(), `${cur.secs}s - round ${cur.round || 1}/${rounds()}`)
}

export default {
  async start(watch) {
    plan = buildPlan(watch.settings)
    step = 0
    remaining = plan[0].secs
    paused = true
    last = Date.now()
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      if (step >= plan.length) step = 0
      paused = !paused
    } else if (button === 'next' && step < plan.length) await advance(watch)
    else if (button === 'prev') {
      step = 0
      remaining = plan[0].secs
      paused = true
    }
    last = Date.now()
    await render(watch)
  },

  async tick(watch) {
    const now = Date.now()
    if (!paused && step < plan.length) {
      remaining -= (now - last) / 1000
      if (remaining <= 0) await advance(watch)
    }
    last = now
    await render(watch)
  },
}
