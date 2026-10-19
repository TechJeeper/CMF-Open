// Speaker notes on your wrist: two lines at a time on the music card.
export const manifest = {
  id: 'teleprompter',
  name: 'Teleprompter',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🎤',
  description: 'Silent speaker notes. Next/prev move through your script; play scrolls it automatically.',
  tickInterval: 1,
  tags: ['productivity', 'presenting'],
  buttons: { next: 'Next line', prev: 'Previous line', play: 'Auto-scroll on / off' },
  settings: [
    {
      key: 'script',
      label: 'Script',
      type: 'textarea',
      default:
        'Thank everyone for coming.\nIntroduce the problem in one sentence.\nShow the demo.\nThree numbers that matter.\nWhat we need from you.\nQuestions.',
    },
    { key: 'seconds', label: 'Auto-scroll seconds per line', type: 'number', default: 6 },
  ],
}

let lines, pos, auto, since

const render = (watch) =>
  watch.status(lines[pos], lines[pos + 1] ?? '-- end --', { playing: auto })

export default {
  async start(watch) {
    lines = String(watch.settings.script)
      .split(/\n|(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!lines.length) lines = ['Paste your script in the settings']
    pos = watch.storage.get('pos', 0) % lines.length
    auto = false
    since = Date.now()
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'next') pos = Math.min(pos + 1, lines.length - 1)
    else if (button === 'prev') pos = Math.max(pos - 1, 0)
    else if (button === 'play' || button === 'pause') auto = !auto
    since = Date.now()
    watch.storage.set('pos', pos)
    await render(watch)
  },

  async tick(watch) {
    const every = Number(watch.settings.seconds || 6) * 1000
    if (!auto || Date.now() - since < every) return
    since = Date.now()
    if (pos < lines.length - 1) pos++
    else {
      auto = false
      await watch.buzz()
    }
    watch.storage.set('pos', pos)
    await render(watch)
  },
}
