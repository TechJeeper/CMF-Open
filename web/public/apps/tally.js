// A persistent tally counter (laps swum, people at the door, push-ups...).
export const manifest = {
  id: 'tally',
  name: 'Tally Counter',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🔢',
  description: 'Count anything with a tap. The count survives restarts; set a goal to get a buzz when you hit it.',
  tickInterval: null,
  tags: ['sport', 'utility'],
  buttons: { next: '+1', prev: '-1', vol_up: '+10', vol_down: '-10', play: 'Show total as a card' },
  settings: [
    { key: 'label', label: 'What are you counting?', type: 'text', default: 'Count' },
    { key: 'goal', label: 'Goal (0 for none)', type: 'number', default: 0 },
  ],
}

let count = 0

const goal = (watch) => Number(watch.settings.goal) || 0

const render = (watch) => {
  const g = goal(watch)
  return watch.status(`${watch.settings.label}: ${count}`, g ? `goal ${g} - ${Math.max(g - count, 0)} to go` : 'next +1 / prev -1')
}

export default {
  async start(watch) {
    count = watch.storage.get('count', 0)
    await render(watch)
  },

  async onButton(watch, button) {
    const step = { next: 1, prev: -1, vol_up: 10, vol_down: -10 }[button]
    if (step) {
      const before = count
      count = Math.max(0, count + step)
      watch.storage.set('count', count)
      const g = goal(watch)
      if (g && before < g && count >= g) await watch.card('Goal reached!', `${watch.settings.label}: ${count}`)
    } else if (button === 'play' || button === 'pause') {
      await watch.card(String(watch.settings.label), `Total: ${count}`)
    }
    await render(watch)
  },
}
