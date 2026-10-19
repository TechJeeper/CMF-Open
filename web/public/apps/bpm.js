// Tap to find the BPM of any beat.
export const manifest = {
  id: 'bpm',
  name: 'BPM Tap',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🎵',
  description: 'Find the tempo of any song. Tap play in time with the beat and see the BPM. Great for DJs and musicians.',
  tickInterval: 100,
  tags: ['music', 'tools'],
  buttons: { play: 'Tap beat', next: 'Reset', prev: 'Save tempo' },
  settings: [],
}

let taps = []
let bpm = 0
let saved = []
let lastTap = 0

function calcBpm() {
  if (taps.length < 2) return 0
  const intervals = []
  for (let i = 1; i < taps.length; i++) {
    intervals.push(taps[i] - taps[i - 1])
  }
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
  return Math.round(60000 / avg)
}

async function render(watch) {
  const display = bpm > 0 ? `${bpm}` : '---'
  const sub = taps.length > 0 ? `${taps.length} taps` : 'Tap to start'
  await watch.status(display, sub, { playing: taps.length > 0 })
  if (saved.length > 0) {
    await watch.menu(saved.slice(-8).reverse().map((b, i) => [`Tempo ${saved.length - i}`, `${b} BPM`]))
  }
}

export default {
  async start(watch) {
    taps = []
    bpm = 0
    saved = []
    await render(watch)
  },

  async onTick(watch) {
    if (taps.length > 0 && Date.now() - lastTap > 3000) {
      if (bpm > 0) saved.push(bpm)
      taps = []
      bpm = 0
      await render(watch)
    }
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') {
      const now = Date.now()
      if (taps.length > 0 && now - lastTap > 2000) {
        taps = []
      }
      taps.push(now)
      lastTap = now
      if (taps.length > 8) taps.shift()
      bpm = calcBpm()
      await watch.vibrate()
    } else if (button === 'next') {
      if (bpm > 0) saved.push(bpm)
      taps = []
      bpm = 0
    } else if (button === 'prev') {
      if (bpm > 0) {
        saved.push(bpm)
        await watch.notify('🎵', `Saved ${bpm} BPM`)
      }
    }
    await render(watch)
  },
}
