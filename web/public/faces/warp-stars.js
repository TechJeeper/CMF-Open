export const face = {
  id: 'warp-stars',
  name: 'Warp Stars',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Hyperspace streaks radiating from the centre — a sci-fi tunnel with the clock floating in front.',
  tags: ['generative', 'space'],
  clock: { style: 0, x: 113, y: 98, color: '#ffffff' },
  settings: [{ key: 'seed', label: 'Star field', type: 'number', default: 21 }],
}

export default function draw(ctx, { size, random }) {
  ctx.fillStyle = '#03050a'
  ctx.fillRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  for (let i = 0; i < 220; i++) {
    const a = random() * Math.PI * 2
    const d = random() * 230
    const len = 8 + random() * 40
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d
    ctx.strokeStyle = `rgba(200,220,255,${0.2 + random() * 0.8})`
    ctx.lineWidth = 1 + random() * 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    ctx.stroke()
  }
  const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130)
  hole.addColorStop(0, 'rgba(3,5,10,0.95)')
  hole.addColorStop(0.7, 'rgba(3,5,10,0.5)')
  hole.addColorStop(1, 'rgba(3,5,10,0)')
  ctx.fillStyle = hole
  ctx.fillRect(0, 0, size, size)
}
