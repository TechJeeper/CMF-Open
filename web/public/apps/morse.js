// Play a short message as morse buzzes on your wrist.
export const manifest = {
  id: 'morse',
  name: 'Morse Buzz',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '📡',
  description: 'Convert a short phrase into morse and buzz it on your wrist. Play to send; great for silent signals.',
  tickInterval: null,
  tags: ['utility', 'nerd'],
  buttons: { play: 'Buzz message', find_phone: 'Stop' },
  settings: [{ key: 'msg', label: 'Message (max 40 chars)', type: 'text', default: 'SOS' }],
}

const MORSE = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
}

let playing

function encode(text) {
  return String(text)
    .toUpperCase()
    .split('')
    .map((c) => (c === ' ' ? '/' : MORSE[c] || ''))
    .filter(Boolean)
    .join(' ')
}

async function buzzUnit(watch, sym, unitMs) {
  if (sym === ' ') return
  if (sym === '/') {
    await new Promise((r) => setTimeout(r, unitMs * 7))
    return
  }
  const on = sym === '.' ? unitMs : unitMs * 3
  await watch.buzz()
  await new Promise((r) => setTimeout(r, on))
  await new Promise((r) => setTimeout(r, unitMs))
}

export default {
  async start(watch) {
    playing = false
    const m = encode(String(watch.settings.msg || 'SOS').slice(0, 40))
    await watch.status('Morse Buzz', m.slice(0, 40) || 'Set message in settings')
  },

  async onButton(watch, button) {
    if (button === 'find_phone') {
      playing = false
      return
    }
    if ((button === 'play' || button === 'pause') && !playing) {
      playing = true
      const unit = 120
      const coded = encode(String(watch.settings.msg || 'SOS').slice(0, 40))
      await watch.card('Morse', coded.slice(0, 128))
      for (const ch of coded) {
        if (!playing) break
        await buzzUnit(watch, ch, unit)
      }
      playing = false
      await watch.status('Done', 'Play again or edit message')
    }
  },
}
