// Checklist: items live in the contacts list, the cursor on the music card.
export const manifest = {
  id: 'checklist',
  name: 'Checklist',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '✅',
  description: 'Packing lists, groceries, pre-flight checks. Tick items off with the media buttons; progress is saved.',
  tickInterval: null,
  tags: ['productivity'],
  buttons: { play: 'Tick / untick item', next: 'Next item', prev: 'Previous item' },
  settings: [
    {
      key: 'items',
      label: 'Items (one per line, max 20)',
      type: 'textarea',
      default: 'Passport\nCharger\nHeadphones\nWater bottle\nKeys',
    },
  ],
}

let items, done, cursor

async function render(watch) {
  await watch.menu(items.map((item, i) => (done[i] ? '[x] ' : '[ ] ') + item))
  const left = done.filter((d) => !d).length
  await watch.status(items[cursor], `${done[cursor] ? 'done' : 'todo'} - ${left} left`, { playing: left > 0 })
}

export default {
  async start(watch) {
    items = String(watch.settings.items)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
    if (!items.length) items = ['Add items in the app settings']
    const saved = watch.storage.get('done', {})
    done = items.map((item) => Boolean(saved[item]))
    cursor = 0
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      done[cursor] = !done[cursor]
      watch.storage.set('done', Object.fromEntries(items.map((item, i) => [item, done[i]])))
      if (done.every(Boolean)) await watch.card('Checklist', 'All items done!')
    } else if (button === 'next') cursor = (cursor + 1) % items.length
    else if (button === 'prev') cursor = (cursor - 1 + items.length) % items.length
    await render(watch)
  },
}
