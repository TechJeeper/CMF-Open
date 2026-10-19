// Quick mood/energy journal with emoji ratings.
export const manifest = {
  id: 'journal',
  name: 'Mood Journal',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '📓',
  description: 'Log your mood and energy throughout the day with simple emoji ratings. Track patterns over time.',
  tickInterval: null,
  tags: ['health', 'productivity'],
  buttons: { play: 'Log entry', next: 'Next rating', prev: 'Previous rating' },
  settings: [],
}

const MOODS = ['😫', '😔', '😐', '🙂', '😄']
const ENERGY = ['🪫', '🔋', '⚡']
let moodIdx = 2
let energyIdx = 1
let mode = 'mood'
let entries = []

async function render(watch) {
  if (mode === 'mood') {
    await watch.status(MOODS[moodIdx], 'How do you feel?', { playing: false })
  } else {
    await watch.status(ENERGY[energyIdx], 'Energy level?', { playing: false })
  }
  if (entries.length > 0) {
    await watch.menu(entries.slice(-8).reverse().map((e) => [
      `${e.mood} ${e.energy}`,
      new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    ]))
  }
}

export default {
  async start(watch) {
    moodIdx = 2
    energyIdx = 1
    mode = 'mood'
    entries = []
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'next') {
      if (mode === 'mood') moodIdx = (moodIdx + 1) % MOODS.length
      else energyIdx = (energyIdx + 1) % ENERGY.length
    } else if (button === 'prev') {
      if (mode === 'mood') moodIdx = (moodIdx - 1 + MOODS.length) % MOODS.length
      else energyIdx = (energyIdx - 1 + ENERGY.length) % ENERGY.length
    } else if (button === 'play' || button === 'pause') {
      if (mode === 'mood') {
        mode = 'energy'
      } else {
        entries.push({ mood: MOODS[moodIdx], energy: ENERGY[energyIdx], time: Date.now() })
        await watch.notify('📓', `Logged ${MOODS[moodIdx]} ${ENERGY[energyIdx]}`)
        await watch.vibrate()
        mode = 'mood'
        moodIdx = 2
        energyIdx = 1
      }
    }
    await render(watch)
  },
}
