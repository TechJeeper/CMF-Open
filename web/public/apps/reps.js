// Count exercise reps with button presses.
export const manifest = {
  id: 'reps',
  name: 'Rep Counter',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '💪',
  description: 'Track workout reps and sets. Tap play to count reps, next for new set. Shows total volume.',
  tickInterval: null,
  tags: ['fitness', 'health'],
  buttons: { play: 'Count rep', next: 'New set', prev: 'Undo' },
  settings: [
    { key: 'target', label: 'Target reps per set', type: 'number', default: 12 },
    { key: 'sets', label: 'Target sets', type: 'number', default: 3 },
  ],
}

let reps = 0
let set = 1
let history = []
let total = 0

async function render(watch) {
  const target = watch.settings.target || 12
  const targetSets = watch.settings.sets || 3
  const progress = Math.min(100, Math.round((reps / target) * 100))
  await watch.status(`${reps}/${target}`, `Set ${set}/${targetSets} · Total: ${total}`, { playing: reps > 0 })
  await watch.menu(history.slice(-8).reverse().map((h, i) => [`Set ${history.length - i}`, `${h} reps`]))
}

export default {
  async start(watch) {
    reps = 0
    set = 1
    history = []
    total = 0
    await render(watch)
  },

  async onButton(watch, button) {
    const target = watch.settings.target || 12
    
    if (button === 'play' || button === 'pause') {
      reps++
      total++
      if (reps === target) {
        await watch.vibrate()
        await watch.notify('💪', `Set ${set} complete!`)
      }
    } else if (button === 'next') {
      if (reps > 0) {
        history.push(reps)
        set++
        reps = 0
        await watch.vibrate()
      }
    } else if (button === 'prev') {
      if (reps > 0) {
        reps--
        total--
      } else if (history.length > 0) {
        reps = history.pop()
        set--
        total -= reps
      }
    }
    await render(watch)
  },
}
