// Daily gratitude practice with prompts.
export const manifest = {
  id: 'gratitude',
  name: 'Gratitude',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🙏',
  description: 'Daily gratitude prompts to boost your wellbeing. Cycle through reflections and track your streak.',
  tickInterval: null,
  tags: ['mindfulness', 'health'],
  buttons: { play: 'Mark done', next: 'Next prompt', prev: 'Previous' },
  settings: [],
}

const PROMPTS = [
  ['🌅', 'What made you smile today?'],
  ['👥', 'Who are you grateful for?'],
  ['🎁', 'What simple pleasure do you enjoy?'],
  ['💪', 'What challenge made you stronger?'],
  ['🏠', 'What comfort are you thankful for?'],
  ['🌱', 'What growth have you noticed?'],
  ['🎵', 'What sound brings you joy?'],
  ['🍽️', 'What food nourishes you?'],
  ['📚', 'What did you learn recently?'],
  ['❤️', 'What do you love about yourself?'],
]

let promptIdx = 0
let completed = new Set()
let streak = 0
let lastDate = ''

async function render(watch) {
  const [emoji, prompt] = PROMPTS[promptIdx]
  const done = completed.has(promptIdx) ? ' ✓' : ''
  await watch.status(emoji, prompt.slice(0, 32) + done, { playing: completed.size > 0 })
  await watch.menu([
    ['Today', `${completed.size}/${PROMPTS.length} done`],
    ['Streak', `${streak} days`],
  ])
}

export default {
  async start(watch) {
    promptIdx = Math.floor(Math.random() * PROMPTS.length)
    completed = new Set()
    const today = new Date().toDateString()
    if (lastDate && lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString()
      if (lastDate === yesterday) streak++
      else streak = 0
    }
    lastDate = today
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'next') {
      promptIdx = (promptIdx + 1) % PROMPTS.length
    } else if (button === 'prev') {
      promptIdx = (promptIdx - 1 + PROMPTS.length) % PROMPTS.length
    } else if (button === 'play' || button === 'pause') {
      if (!completed.has(promptIdx)) {
        completed.add(promptIdx)
        await watch.vibrate()
        if (completed.size === PROMPTS.length) {
          await watch.notify('🙏', 'All gratitudes complete!')
          streak++
        }
      }
    }
    await render(watch)
  },
}
