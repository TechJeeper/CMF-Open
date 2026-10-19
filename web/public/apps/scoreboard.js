// Two-team scoreboard for pickup games, table tennis, board games.
export const manifest = {
  id: 'scoreboard',
  name: 'Scoreboard',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🏆',
  description: 'Keep score for two sides from your wrist. Volume keys for home, next/prev for away. Buzzes when someone wins.',
  tickInterval: null,
  tags: ['sport', 'games'],
  buttons: {
    vol_up: 'Home +1',
    vol_down: 'Home -1',
    next: 'Away +1',
    prev: 'Away -1',
    play: 'Show score card',
    find_phone: 'New game',
  },
  settings: [
    { key: 'home', label: 'Home name', type: 'text', default: 'Home' },
    { key: 'away', label: 'Away name', type: 'text', default: 'Away' },
    { key: 'target', label: 'Winning score (0 for none)', type: 'number', default: 11 },
  ],
}

let score, history, over

const names = (w) => [String(w.settings.home || 'Home').slice(0, 12), String(w.settings.away || 'Away').slice(0, 12)]
const target = (w) => Math.max(0, Number(w.settings.target) || 0)

function save(watch) {
  watch.storage.set('game', { score, history, over })
}

async function render(watch) {
  const [h, a] = names(watch)
  const t = target(watch)
  await watch.status(`${h} ${score[0]} - ${score[1]} ${a}`, over ? 'game over - find phone for new game' : t ? `first to ${t}` : 'no limit', {
    playing: !over,
  })
  await watch.menu(
    history
      .slice(-20)
      .reverse()
      .map((e) => [`${e.side === 0 ? h : a} ${e.delta > 0 ? '+1' : '-1'}`, `${e.score[0]}-${e.score[1]}`]),
  )
}

export default {
  async start(watch) {
    ;({ score, history, over } = watch.storage.get('game', { score: [0, 0], history: [], over: false }))
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'find_phone') {
      score = [0, 0]
      history = []
      over = false
      await watch.card('Scoreboard', 'New game')
    } else if (button === 'play' || button === 'pause') {
      const [h, a] = names(watch)
      await watch.card('Score', `${h} ${score[0]} - ${score[1]} ${a}`)
    } else {
      const move = { vol_up: [0, 1], vol_down: [0, -1], next: [1, 1], prev: [1, -1] }[button]
      if (move && !(over && move[1] > 0)) {
        const [side, delta] = move
        score[side] = Math.max(0, score[side] + delta)
        history.push({ side, delta, score: [...score] })
        const t = target(watch)
        over = Boolean(t && Math.max(...score) >= t)
        if (over && delta > 0) await watch.card('Winner!', `${names(watch)[side]} wins ${score[side]}-${score[1 - side]}`)
      }
    }
    save(watch)
    await render(watch)
  },
}
