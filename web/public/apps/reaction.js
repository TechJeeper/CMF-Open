// Test your reaction time - how fast can you respond?
export const manifest = {
  id: 'reaction',
  name: 'Reaction Test',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '⚡',
  description: 'Measure your reaction time. Wait for GO! then tap play as fast as you can. Tracks your best time.',
  tickInterval: 100,
  tags: ['games', 'health'],
  buttons: { play: 'React!', next: 'New round', prev: 'Reset best' },
  settings: [],
}

let state = 'ready'
let waitStart = 0
let goTime = 0
let result = 0
let best = Infinity
let delay = 0

async function render(watch) {
  if (state === 'ready') {
    await watch.status('Ready?', 'Press NEXT to start', { playing: false })
  } else if (state === 'waiting') {
    await watch.status('Wait...', 'Don\'t tap yet!', { playing: false })
  } else if (state === 'go') {
    await watch.status('GO!', 'TAP NOW!', { playing: true })
  } else if (state === 'result') {
    const bestStr = best === Infinity ? '---' : `${best}ms`
    await watch.status(`${result}ms`, `Best: ${bestStr}`, { playing: false })
  } else if (state === 'early') {
    await watch.status('Too early!', 'Wait for GO', { playing: false })
  }
}

export default {
  async start(watch) {
    state = 'ready'
    best = Infinity
    await render(watch)
  },

  async onTick(watch) {
    if (state === 'waiting') {
      const elapsed = Date.now() - waitStart
      if (elapsed >= delay) {
        state = 'go'
        goTime = Date.now()
        await render(watch)
      }
    }
  },

  async onButton(watch, button) {
    if (button === 'next') {
      state = 'waiting'
      waitStart = Date.now()
      delay = 1500 + Math.random() * 3000
      await render(watch)
    } else if (button === 'play' || button === 'pause') {
      if (state === 'waiting') {
        state = 'early'
      } else if (state === 'go') {
        result = Date.now() - goTime
        if (result < best) best = result
        state = 'result'
      }
      await render(watch)
    } else if (button === 'prev') {
      best = Infinity
      state = 'ready'
      await render(watch)
    }
  },
}
