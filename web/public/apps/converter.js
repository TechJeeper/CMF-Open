// Quick unit converter: cycle modes with next/prev, adjust value with volume keys.
export const manifest = {
  id: 'converter',
  name: 'Unit Converter',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '📐',
  description: 'Flip through km/mi, °C/°F, kg/lb and L/gal on your wrist. Volume keys change the value; play swaps direction.',
  tickInterval: null,
  tags: ['utility', 'travel'],
  buttons: { next: 'Next conversion', prev: 'Previous', vol_up: '+1', vol_down: '-1', play: 'Swap direction' },
  settings: [{ key: 'start', label: 'Starting value', type: 'number', default: 10 }],
}

const MODES = [
  { a: 'km', b: 'mi', f: (v) => v * 0.621371, inv: (v) => v / 0.621371 },
  { a: '°C', b: '°F', f: (v) => (v * 9) / 5 + 32, inv: (v) => ((v - 32) * 5) / 9 },
  { a: 'kg', b: 'lb', f: (v) => v * 2.20462, inv: (v) => v / 2.20462 },
  { a: 'L', b: 'gal', f: (v) => v * 0.264172, inv: (v) => v / 0.264172 },
]

let mode, value, forward

async function render(watch) {
  const m = MODES[mode]
  const out = forward ? m.f(value) : m.inv(value)
  const from = forward ? m.a : m.b
  const to = forward ? m.b : m.a
  await watch.status(`${value.toFixed(2)} ${from}`, `${out.toFixed(2)} ${to}`)
  await watch.menu(MODES.map((x, i) => [i === mode ? '▸ ' + x.a + '↔' + x.b : x.a + '↔' + x.b, '']))
}

export default {
  async start(watch) {
    mode = 0
    value = Number(watch.settings.start) || 10
    forward = true
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'next') mode = (mode + 1) % MODES.length
    else if (button === 'prev') mode = (mode - 1 + MODES.length) % MODES.length
    else if (button === 'vol_up') value += 1
    else if (button === 'vol_down') value = Math.max(0, value - 1)
    else if (button === 'play' || button === 'pause') forward = !forward
    await render(watch)
  },
}
