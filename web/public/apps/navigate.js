// Turn-by-turn steps. Each step buzzes as a notification card.
export const manifest = {
  id: 'navigate',
  name: 'Turn by Turn',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🧭',
  description: 'Step through a route on your wrist. Paste directions as "instruction | distance" lines.',
  tickInterval: null,
  tags: ['travel'],
  buttons: { next: 'Next step', prev: 'Previous step' },
  settings: [
    {
      key: 'route',
      label: 'Route (instruction | distance per line)',
      type: 'textarea',
      default:
        'Head north on Main St | 200 m\nTurn right onto Oak Ave | 450 m\nKeep left at the fork | 1.2 km\nTurn left onto Station Rd | 300 m\nArrive at destination |',
    },
  ],
}

let steps, index

async function show(watch) {
  const [text, dist] = steps[index]
  const n = `${index + 1}/${steps.length}`
  await watch.status(text, dist ? `${dist}  (${n})` : n)
  await watch.card(dist || 'Arrived', text)
}

export default {
  async start(watch) {
    steps = String(watch.settings.route)
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        const [text, dist = ''] = l.split('|')
        return [text.trim(), dist.trim()]
      })
    if (!steps.length) steps = [['Add a route in the app settings', '']]
    index = 0
    await show(watch)
  },

  async onButton(watch, button) {
    if (button === 'next' && index < steps.length - 1) index++
    else if (button === 'prev' && index > 0) index--
    else return
    await show(watch)
  },
}
