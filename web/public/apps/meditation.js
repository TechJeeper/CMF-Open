// Meditation timer with gentle interval bells.
export const manifest = {
  id: 'meditation',
  name: 'Meditation Bell',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🔔',
  description: 'A meditation timer that rings a bell at your chosen intervals. Helps maintain focus during practice.',
  tickInterval: 1000,
  tags: ['health', 'mindfulness'],
  buttons: { play: 'Start/Stop', next: 'Add 5 min', prev: 'Skip to bell' },
  settings: [
    { key: 'duration', label: 'Session (minutes)', type: 'number', default: 10 },
    { key: 'interval', label: 'Bell interval (minutes)', type: 'number', default: 5 },
    { key: 'endBells', label: 'Bells at end', type: 'number', default: 3 },
  ],
}

let running = false
let elapsed = 0
let duration = 0
let interval = 0
let lastBell = 0

function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

async function render(watch) {
  const remaining = Math.max(0, duration - elapsed)
  const next = interval > 0 ? interval - (elapsed % interval) : remaining
  await watch.status(fmt(remaining), running ? `Bell in ${fmt(next)}` : 'Paused', { playing: running })
}

export default {
  async start(watch) {
    duration = (watch.settings.duration || 10) * 60
    interval = (watch.settings.interval || 5) * 60
    elapsed = 0
    running = false
    lastBell = 0
    await render(watch)
  },

  async onTick(watch) {
    if (!running) return
    elapsed++
    
    if (interval > 0 && elapsed % interval === 0 && elapsed < duration) {
      await watch.notify('🔔', 'Mindfulness bell')
      await watch.vibrate()
    }
    
    if (elapsed >= duration) {
      running = false
      const bells = watch.settings.endBells || 3
      await watch.notify('🧘', `Session complete`)
      for (let i = 0; i < bells; i++) {
        await watch.vibrate()
      }
    }
    
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      if (elapsed >= duration) {
        elapsed = 0
      }
      running = !running
    } else if (button === 'next') {
      duration += 300
    } else if (button === 'prev' && running) {
      const nextBell = interval - (elapsed % interval)
      elapsed += nextBell
      await watch.notify('🔔', 'Mindfulness bell')
      await watch.vibrate()
    }
    await render(watch)
  },
}
