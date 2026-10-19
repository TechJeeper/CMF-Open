// A simple compass showing cardinal directions.
export const manifest = {
  id: 'compass',
  name: 'Compass',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🧭',
  description: 'Display cardinal directions on your wrist. Tap next/prev to rotate, play calibrates to north.',
  tickInterval: null,
  tags: ['tools', 'outdoor'],
  buttons: { next: 'Rotate right', prev: 'Rotate left', play: 'Reset to N' },
  settings: [
    { key: 'style', label: 'Style', type: 'select', options: ['Modern', 'Classic', 'Minimal'], default: 'Modern' },
  ],
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const DEGS = [0, 45, 90, 135, 180, 225, 270, 315]
let heading = 0

async function render(watch) {
  const idx = Math.round(heading / 45) % 8
  const dir = DIRS[idx]
  const deg = `${heading}°`
  await watch.status(dir, deg, { playing: false })
  await watch.menu(DIRS.map((d, i) => [d, `${DEGS[i]}°`]))
}

export default {
  async start(watch) {
    heading = 0
    await render(watch)
  },

  async onButton(watch, button) {
    if (button === 'next') heading = (heading + 15) % 360
    else if (button === 'prev') heading = (heading - 15 + 360) % 360
    else if (button === 'play' || button === 'pause') heading = 0
    await render(watch)
  },
}
