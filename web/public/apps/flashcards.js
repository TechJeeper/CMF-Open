// Flashcards: question on the music card, play reveals the answer, volume keys grade it.
export const manifest = {
  id: 'flashcards',
  name: 'Flashcards',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🃏',
  description: 'Study on the go. Flip a card with play, mark it known or not with the volume keys. Known cards drop out.',
  tickInterval: null,
  tags: ['productivity', 'education'],
  buttons: {
    play: 'Flip card',
    next: 'Next card',
    prev: 'Previous card',
    vol_up: 'I knew it',
    vol_down: "Didn't know it",
    find_phone: 'Reset progress',
  },
  settings: [
    {
      key: 'cards',
      label: 'Cards, one per line as "front | back"',
      type: 'textarea',
      default: 'Hola | Hello\nGracias | Thank you\nPor favor | Please\nAgua | Water\nLa cuenta | The bill\nBuenos dias | Good morning',
    },
    { key: 'shuffle', label: 'Shuffle', type: 'boolean', default: true },
  ],
}

let cards, deck, pos, flipped, known

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function rebuild(watch) {
  deck = cards.map((_, i) => i).filter((i) => !known[cards[i].front])
  if (watch.settings.shuffle) shuffle(deck)
  pos = 0
  flipped = false
}

async function render(watch) {
  const done = cards.length - deck.length
  await watch.menu(cards.map((c) => [`${known[c.front] ? '* ' : ''}${c.front}`, c.back]))
  if (!deck.length) return watch.status('All cards known!', `${cards.length} cards - find phone resets`, { playing: false })
  const c = cards[deck[pos]]
  await watch.status(flipped ? c.back : c.front, `${flipped ? 'answer' : 'question'} ${pos + 1}/${deck.length} - ${done} known`, {
    playing: !flipped,
  })
}

export default {
  async start(watch) {
    cards = String(watch.settings.cards)
      .split('\n')
      .map((l) => l.split('|').map((s) => s.trim()))
      .filter(([f, b]) => f && b)
      .map(([front, back]) => ({ front, back }))
      .slice(0, 200)
    if (!cards.length) cards = [{ front: 'No cards yet', back: 'Add some in the app settings' }]
    known = watch.storage.get('known', {})
    rebuild(watch)
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'find_phone') {
      known = {}
      watch.storage.set('known', known)
      rebuild(watch)
      await watch.card('Flashcards', 'Progress reset')
    } else if (deck.length) {
      if (button === 'play' || button === 'pause') flipped = !flipped
      else if (button === 'next' || button === 'prev') {
        pos = (pos + (button === 'next' ? 1 : deck.length - 1)) % deck.length
        flipped = false
      } else if (button === 'vol_up') {
        known[cards[deck[pos]].front] = true
        watch.storage.set('known', known)
        deck.splice(pos, 1)
        if (pos >= deck.length) pos = 0
        flipped = false
        if (!deck.length) await watch.card('Flashcards', `Deck complete: all ${cards.length} cards known!`)
      } else if (button === 'vol_down') {
        // Move the card to the back so it comes round again.
        deck.push(deck.splice(pos, 1)[0])
        if (pos >= deck.length) pos = 0
        flipped = false
      }
    }
    await render(watch)
  },
}
