// Lap stopwatch: laps go into the contacts list so you can scroll them on the watch.
export const manifest = {
  id: 'stopwatch',
  name: 'Lap Stopwatch',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '⏱️',
  description: 'Start, stop and record laps from your wrist. Laps appear in the contacts list.',
  tickInterval: 1,
  tags: ['sport', 'timer'],
  buttons: { play: 'Start / stop', next: 'Record lap', prev: 'Reset' },
}

let elapsed = 0
let startedAt = null
let laps = []

const now = () => elapsed + (startedAt ? Date.now() - startedAt : 0)
const fmt = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const render = (watch) =>
  watch.status(`Stopwatch ${fmt(now())}`, `${startedAt ? 'running' : 'stopped'} - ${laps.length} laps`, {
    playing: Boolean(startedAt),
  })

export default {
  start: render,

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      if (startedAt) {
        elapsed = now()
        startedAt = null
      } else startedAt = Date.now()
    } else if (button === 'next' && startedAt) {
      laps.push(now())
      await watch.menu(laps.map((t, i) => [`Lap ${i + 1}`, fmt(t)]))
      await watch.card(`Lap ${laps.length}`, fmt(laps.at(-1)))
    } else if (button === 'prev') {
      elapsed = 0
      startedAt = null
      laps = []
    }
    await render(watch)
  },

  async tick(watch) {
    if (startedAt) await render(watch)
  },
}
