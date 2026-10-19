// Lap timer with split times for runners.
export const manifest = {
  id: 'split',
  name: 'Lap Timer',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🏃',
  description: 'Track lap times for running, swimming, or cycling. Records splits and shows pace comparison.',
  tickInterval: 100,
  tags: ['fitness', 'sports'],
  buttons: { play: 'Start/Stop', next: 'Lap/Split', prev: 'Reset' },
  settings: [
    { key: 'lapDistance', label: 'Lap distance (m)', type: 'number', default: 400 },
  ],
}

let running = false
let startTime = 0
let elapsed = 0
let laps = []
let lastLapTime = 0

function fmt(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  const tenths = Math.floor((ms % 1000) / 100)
  return `${m}:${sec.toString().padStart(2, '0')}.${tenths}`
}

async function render(watch) {
  const current = running ? Date.now() - startTime : elapsed
  const lapTime = current - lastLapTime
  const lapNum = laps.length + 1
  await watch.status(fmt(current), `Lap ${lapNum}: ${fmt(lapTime)}`, { playing: running })
  if (laps.length > 0) {
    await watch.menu(laps.slice(-8).reverse().map((l, i) => [`Lap ${laps.length - i}`, fmt(l)]))
  }
}

export default {
  async start(watch) {
    running = false
    elapsed = 0
    laps = []
    lastLapTime = 0
    await render(watch)
  },

  async onTick(watch) {
    if (running) await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      if (running) {
        elapsed = Date.now() - startTime
        running = false
      } else {
        startTime = Date.now() - elapsed
        running = true
      }
    } else if (button === 'next' && running) {
      const current = Date.now() - startTime
      const lapTime = current - lastLapTime
      laps.push(lapTime)
      lastLapTime = current
      if (watch.vibrate) await watch.vibrate()
    } else if (button === 'prev') {
      running = false
      elapsed = 0
      laps = []
      lastLapTime = 0
    }
    await render(watch)
  },
}
