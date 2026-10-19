// Guided stretching routine with timed holds.
export const manifest = {
  id: 'stretch',
  name: 'Stretch Timer',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🧘',
  description: 'A guided stretching routine with timed holds. Perfect for desk workers and athletes.',
  tickInterval: 1000,
  tags: ['fitness', 'health'],
  buttons: { play: 'Start/Pause', next: 'Skip stretch', prev: 'Previous' },
  settings: [
    { key: 'holdTime', label: 'Hold time (seconds)', type: 'number', default: 30 },
  ],
}

const STRETCHES = [
  ['🙆', 'Neck rolls'],
  ['💪', 'Shoulder stretch'],
  ['🙌', 'Overhead reach'],
  ['🔄', 'Torso twist'],
  ['🦵', 'Quad stretch'],
  ['🦶', 'Calf stretch'],
  ['🧎', 'Hip flexor'],
  ['🙇', 'Forward fold'],
]

let running = false
let stretchIdx = 0
let timeLeft = 0
let holdTime = 30

async function render(watch) {
  const [emoji, name] = STRETCHES[stretchIdx]
  const progress = `${stretchIdx + 1}/${STRETCHES.length}`
  await watch.status(emoji, running ? `${timeLeft}s` : name, { playing: running })
  await watch.menu(STRETCHES.map(([e, n], i) => [
    `${e} ${n}`,
    i < stretchIdx ? '✓' : i === stretchIdx ? '→' : ''
  ]))
}

export default {
  async start(watch) {
    holdTime = watch.settings.holdTime || 30
    running = false
    stretchIdx = 0
    timeLeft = holdTime
    await render(watch)
  },

  async onTick(watch) {
    if (!running) return
    timeLeft--

    if (timeLeft <= 3 && timeLeft > 0) {
      await watch.vibrate()
    }

    if (timeLeft <= 0) {
      stretchIdx++
      if (stretchIdx >= STRETCHES.length) {
        running = false
        stretchIdx = 0
        await watch.notify('🧘', 'Stretch routine complete!')
        await watch.vibrate()
        await watch.vibrate()
      } else {
        timeLeft = holdTime
        const [emoji, name] = STRETCHES[stretchIdx]
        await watch.notify(emoji, name)
        await watch.vibrate()
      }
    }

    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      running = !running
      if (running && timeLeft <= 0) timeLeft = holdTime
    } else if (button === 'next') {
      stretchIdx = (stretchIdx + 1) % STRETCHES.length
      timeLeft = holdTime
      running = false
    } else if (button === 'prev') {
      stretchIdx = (stretchIdx - 1 + STRETCHES.length) % STRETCHES.length
      timeLeft = holdTime
      running = false
    }
    await render(watch)
  },
}
