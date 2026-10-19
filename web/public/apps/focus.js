// Deep focus mode with distraction blocking reminders.
export const manifest = {
  id: 'focus',
  name: 'Focus Mode',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🎯',
  description: 'Enter deep focus mode. Get periodic reminders to stay on task and track your focus sessions.',
  tickInterval: 1000,
  tags: ['productivity', 'mindfulness'],
  buttons: { play: 'Start/End focus', next: 'Add 15 min', prev: 'Check-in' },
  settings: [
    { key: 'duration', label: 'Focus duration (min)', type: 'number', default: 45 },
    { key: 'checkIn', label: 'Check-in interval (min)', type: 'number', default: 15 },
  ],
}

let running = false
let elapsed = 0
let duration = 0
let checkInInterval = 0
let lastCheckIn = 0
let sessions = 0
let totalFocus = 0

function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

async function render(watch) {
  const remaining = Math.max(0, duration - elapsed)
  const status = running ? `${fmt(remaining)} left` : 'Ready to focus'
  const sub = `Sessions: ${sessions} · Total: ${Math.floor(totalFocus/60)}m`
  await watch.status(running ? '🎯' : '💭', status, { playing: running })
  await watch.menu([
    ['Today', `${sessions} sessions`],
    ['Total focus', `${Math.floor(totalFocus/60)} minutes`],
  ])
}

export default {
  async start(watch) {
    duration = (watch.settings.duration || 45) * 60
    checkInInterval = (watch.settings.checkIn || 15) * 60
    running = false
    elapsed = 0
    sessions = 0
    totalFocus = 0
    await render(watch)
  },

  async onTick(watch) {
    if (!running) return
    elapsed++
    totalFocus++

    if (elapsed - lastCheckIn >= checkInInterval && elapsed < duration) {
      lastCheckIn = elapsed
      await watch.notify('🎯', 'Still focused?')
      await watch.vibrate()
    }

    if (elapsed >= duration) {
      running = false
      sessions++
      await watch.notify('✅', `Focus session complete!`)
      await watch.vibrate()
      await watch.vibrate()
    }

    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      if (running) {
        running = false
        if (elapsed > 60) sessions++
      } else {
        running = true
        elapsed = 0
        lastCheckIn = 0
      }
    } else if (button === 'next') {
      duration += 900
    } else if (button === 'prev' && running) {
      await watch.notify('🎯', 'Stay focused! You got this.')
      await watch.vibrate()
    }
    await render(watch)
  },
}
