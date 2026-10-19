// Dice roller for board games.
export const manifest = {
  id: 'dice',
  name: 'Dice',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🎲',
  description: 'Roll a d4 to d100 from your wrist. History of the last 20 rolls goes into the contacts list.',
  tickInterval: null,
  tags: ['games'],
  buttons: { play: 'Roll', next: 'Bigger die', prev: 'Smaller die', vol_up: 'One more die', vol_down: 'One less die' },
}

const DICE = [4, 6, 8, 10, 12, 20, 100]
let die = 1
let count = 1
let history = []

const name = () => `${count}d${DICE[die]}`

export default {
  async start(watch) {
    await watch.status(`Dice: ${name()}`, 'press play to roll')
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * DICE[die]))
      const total = rolls.reduce((a, b) => a + b, 0)
      history = [[`${name()} = ${total}`, rolls.join(' + ')], ...history].slice(0, 20)
      await watch.status(`${name()}: ${total}`, count > 1 ? rolls.join(' + ') : 'press play to roll again')
      await watch.menu(history)
      return
    }
    if (button === 'next') die = Math.min(die + 1, DICE.length - 1)
    else if (button === 'prev') die = Math.max(die - 1, 0)
    else if (button === 'vol_up') count = Math.min(count + 1, 10)
    else if (button === 'vol_down') count = Math.max(count - 1, 1)
    await watch.status(`Dice: ${name()}`, 'press play to roll')
  },
}
