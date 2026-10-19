// Generate a random password on your wrist (shown as a card — do not log secrets).
export const manifest = {
  id: 'password',
  name: 'Password Gen',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🔐',
  description: 'Roll a random password on your wrist. Length and symbols in settings; copy from the alert card on your phone.',
  tickInterval: null,
  tags: ['utility', 'security'],
  buttons: { play: 'Generate', next: '+2 chars', prev: '-2 chars' },
  settings: [
    { key: 'len', label: 'Length', type: 'number', default: 16 },
    { key: 'symbols', label: 'Include symbols', type: 'boolean', default: true },
  ],
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const NUM = '23456789'
const SYM = '!@#$%&*+-=?'

function gen(len, symbols) {
  let pool = LOWER + UPPER + NUM + (symbols ? SYM : '')
  let out = ''
  for (let i = 0; i < len; i++) out += pool[Math.floor(Math.random() * pool.length)]
  return out
}

export default {
  async start(watch) {
    await watch.status('Password Gen', 'Play to generate')
  },

  async onButton(watch, button) {
    let len = Math.min(32, Math.max(8, Number(watch.settings.len) || 16))
    if (button === 'next') len = Math.min(32, len + 2)
    else if (button === 'prev') len = Math.max(8, len - 2)
    else if (button === 'play' || button === 'pause') {
      const p = gen(len, Boolean(watch.settings.symbols))
      watch.settings.len = len
      await watch.card('Password', p)
      await watch.status(`${len} chars generated`, 'Copy from your phone alert')
      return
    }
    watch.settings.len = len
    await watch.status(`Length ${len}`, 'Play to generate')
  },
}
