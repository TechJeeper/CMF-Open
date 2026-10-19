// Metronome: steady beat on the music card, buzz on each downbeat.
export const manifest = {
  id: 'metronome',
  name: 'Metronome',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🎵',
  description: 'Practice tempo with a ticking beat on your wrist. Volume keys nudge BPM; play starts and stops the click.',
  tickInterval: 0.25,
  tags: ['music', 'timer'],
  buttons: { play: 'Start / stop', vol_up: '+5 BPM', vol_down: '-5 BPM', next: '+1 BPM', prev: '-1 BPM' },
  settings: [{ key: 'bpm', label: 'Starting BPM', type: 'number', default: 120 }],
}

let bpm, running, beat, last, interval

const msPerBeat = () => 60_000 / bpm

async function render(watch) {
  await watch.status(`${bpm} BPM`, running ? `beat ${(beat % 4) + 1}` : 'stopped', { playing: running })
}

export default {
  async start(watch) {
    bpm = Math.min(240, Math.max(40, Number(watch.settings.bpm) || 120))
    running = false
    beat = 0
    last = Date.now()
    interval = msPerBeat()
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'play' || button === 'pause') running = !running
    else if (button === 'vol_up') bpm = Math.min(240, bpm + 5)
    else if (button === 'vol_down') bpm = Math.max(40, bpm - 5)
    else if (button === 'next') bpm = Math.min(240, bpm + 1)
    else if (button === 'prev') bpm = Math.max(40, bpm - 1)
    interval = msPerBeat()
    last = Date.now()
    await render(watch)
  },

  async tick(watch) {
    if (!running) return
    const now = Date.now()
    if (now - last >= interval) {
      beat++
      last = now
      if (beat % 4 === 1) await watch.buzz()
      await render(watch)
    }
  },
}
