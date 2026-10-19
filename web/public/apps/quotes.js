// Rotate through your own quote collection.
export const manifest = {
  id: 'quotes',
  name: 'Quotes',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '💬',
  description: 'Inspiration on your wrist. Next and prev step through quotes; play sends the full line as a card.',
  tickInterval: null,
  tags: ['productivity'],
  buttons: { next: 'Next quote', prev: 'Previous', play: 'Show as card' },
  settings: [
    {
      key: 'lines',
      label: 'Quotes (one per line, optional "text | author")',
      type: 'textarea',
      default:
        'Start where you are.\nDone is better than perfect.\nThe secret of getting ahead is getting started. | Twain\nMake it work, then make it right.',
    },
    { key: 'shuffle', label: 'Shuffle on start', type: 'boolean', default: true },
  ],
}

let quotes, idx

function parse(settings) {
  return String(settings.lines)
    .split('\n')
    .map((l) => l.split('|').map((s) => s.trim()))
    .filter(([t]) => t)
    .map(([text, author]) => ({ text, author: author || '' }))
}

async function render(watch) {
  const q = quotes[idx]
  await watch.status(q.text.slice(0, 64), q.author || `${idx + 1}/${quotes.length}`, { playing: false })
  await watch.menu(quotes.map((x, i) => [x.text.slice(0, 32), x.author]))
}

export default {
  async start(watch) {
    quotes = parse(watch.settings)
    if (!quotes.length) quotes = [{ text: 'Add quotes in settings', author: '' }]
    if (watch.settings.shuffle) {
      for (let i = quotes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[quotes[i], quotes[j]] = [quotes[j], quotes[i]]
      }
    }
    idx = 0
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'next') idx = (idx + 1) % quotes.length
    else if (button === 'prev') idx = (idx - 1 + quotes.length) % quotes.length
    else if (button === 'play' || button === 'pause') {
      const q = quotes[idx]
      await watch.card(q.text.slice(0, 20), q.author || q.text.slice(20, 128))
    }
    await render(watch)
  },
}
