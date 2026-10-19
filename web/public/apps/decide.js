// Decision maker: Magic 8-Ball answers, a coin flip, or a random pick from your own list.
export const manifest = {
  id: 'decide',
  name: 'Decision Maker',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🎱',
  description: 'Can\'t choose? Ask the 8-Ball, flip a coin, or let it pick dinner from your list. Answers pop up as a card.',
  tickInterval: null,
  tags: ['games', 'utility'],
  buttons: { play: 'Ask / flip / pick', next: 'Next mode', prev: 'Previous mode' },
  settings: [
    {
      key: 'options',
      label: 'Options for "Pick one" (one per line)',
      type: 'textarea',
      default: 'Pizza\nSushi\nTacos\nCurry\nBurgers\nPho',
    },
  ],
}

const EIGHT_BALL = [
  'It is certain',
  'Without a doubt',
  'Yes, definitely',
  'Most likely',
  'Outlook good',
  'Signs point to yes',
  'Reply hazy, try again',
  'Ask again later',
  'Cannot predict now',
  "Don't count on it",
  'My reply is no',
  'Very doubtful',
]

let modes, mode, history

const pick = (a) => a[Math.floor(Math.random() * a.length)]

async function render(watch) {
  await watch.status(modes[mode].name, `play to ${modes[mode].verb} - next/prev change mode`)
  await watch.menu(history.slice(0, 20))
}

export default {
  async start(watch) {
    const options = String(watch.settings.options)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    modes = [
      { name: 'Magic 8-Ball', verb: 'ask', roll: () => pick(EIGHT_BALL) },
      { name: 'Coin flip', verb: 'flip', roll: () => pick(['Heads', 'Tails']) },
      { name: 'Pick one', verb: 'pick', roll: () => (options.length ? pick(options) : 'Add options in settings') },
      { name: 'Yes or no', verb: 'decide', roll: () => pick(['Yes', 'No']) },
    ]
    mode = 0
    history = []
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      const answer = modes[mode].roll()
      history.unshift([answer, modes[mode].name])
      await watch.card(modes[mode].name, answer)
    } else if (button === 'next') mode = (mode + 1) % modes.length
    else if (button === 'prev') mode = (mode - 1 + modes.length) % modes.length
    await render(watch)
  },
}
