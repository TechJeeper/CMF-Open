// Bauhaus tiles: a random composition of circles, quarters and stripes in primaries.
export const face = {
  id: 'bauhaus',
  name: 'Bauhaus',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Bold geometric tiles in red, yellow and blue, recomposed for every seed. A gallery poster for your wrist.',
  tags: ['generative', 'art'],
  clock: { style: 0, x: 113, y: 98, color: '#1a1a1a' },
  settings: [{ key: 'seed', label: 'Composition', type: 'number', default: 1919 }],
}

const CREAM = '#f1e9da'
const COLORS = ['#d6402b', '#f2b630', '#1e4fa3', '#1a1a1a', CREAM]

export default function draw(ctx, { size, random }) {
  const n = 5
  const s = size / n
  const pick = (arr) => arr[Math.floor(random() * arr.length)]
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, size, size)

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = col * s
      const y = row * s
      // Row 1, columns 1-3 stay blank: that's where the clock sits.
      if (row === 1 && col >= 1 && col <= 3) continue
      const bg = pick(COLORS)
      let fg = pick(COLORS)
      while (fg === bg) fg = pick(COLORS)
      ctx.fillStyle = bg
      ctx.fillRect(x, y, s + 0.5, s + 0.5)
      ctx.fillStyle = fg
      ctx.beginPath()
      const kind = Math.floor(random() * 6)
      const corner = Math.floor(random() * 4)
      const [ox, oy] = [
        [x, y],
        [x + s, y],
        [x + s, y + s],
        [x, y + s],
      ][corner]
      if (kind === 0) {
        ctx.moveTo(ox, oy)
        ctx.arc(ox, oy, s, (corner * Math.PI) / 2, (corner * Math.PI) / 2 + Math.PI / 2)
        ctx.closePath()
      } else if (kind === 1) {
        const a = (corner * Math.PI) / 2
        ctx.arc(x + s / 2 + (Math.cos(a) * s) / 2, y + s / 2 + (Math.sin(a) * s) / 2, s / 2, a + Math.PI / 2, a + Math.PI * 1.5)
      } else if (kind === 2) {
        ctx.arc(x + s / 2, y + s / 2, s * 0.36, 0, Math.PI * 2)
      } else if (kind === 3) {
        ctx.arc(x + s / 2, y + s / 2, s * 0.42, 0, Math.PI * 2)
        ctx.arc(x + s / 2, y + s / 2, s * 0.2, 0, Math.PI * 2, true)
      } else if (kind === 4) {
        ctx.moveTo(x, y)
        ctx.lineTo(x + s, y + s)
        ctx.lineTo(corner % 2 ? x + s : x, corner % 2 ? y : y + s)
        ctx.closePath()
      } else {
        for (let k = 0; k < 4; k++) ctx.rect(x, y + (k * s) / 4 + s / 16, s, s / 8)
      }
      ctx.fill()
    }
  }
  ctx.fillStyle = CREAM
  ctx.fillRect(s, s, s * 3, s)
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 3
  ctx.strokeRect(s, s, s * 3, s)
}
