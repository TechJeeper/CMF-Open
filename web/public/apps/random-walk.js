// Random direction picker for walks or geocaching.
export const manifest = {
  id: 'random-walk',
  name: 'Random Walk',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🚶',
  description: 'Pick a random compass direction and walk that way for a block. Play rolls; next/prev change how many choices.',
  tickInterval: null,
  tags: ['games', 'health'],
  buttons: { play: 'Pick direction', next: 'More options', prev: 'Fewer options' },
  settings: [{ key: 'include', label: 'Include diagonals (8-way)', type: 'boolean', default: false }],
}

const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const FOUR = ['N', 'E', 'S', 'W']

let opts, last

async function render(watch) {
  await watch.status(last ? `Go ${last}` : 'Ready', `${opts.length}-way · play to pick`, { playing: !last })
}

export default {
  async start(watch) {
    opts = watch.settings.include ? CARD : FOUR
    last = ''
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      last = opts[Math.floor(Math.random() * opts.length)]
      await watch.card('Walk', last)
    } else if (button === 'next' || button === 'prev') {
      watch.settings.include = button === 'next'
      opts = watch.settings.include ? CARD : FOUR
      last = ''
    }
    await render(watch)
  },
}
