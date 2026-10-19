export const face = {
  id: 'radar',
  name: 'Radar',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Cold-war radar scope with range rings and a bright sweep. Blips are placed by your seed.',
  tags: ['retro', 'generative'],
  clock: { style: 1, x: 188, y: 118, color: '#7dffb3' },
  settings: [{ key: 'seed', label: 'Blip layout', type: 'number', default: 7 }],
}

export default function draw(ctx, { size, random }) {
  const cx = size / 2
  const cy = size / 2 + 20
  const R = 200
  ctx.fillStyle = '#041408'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(80,255,140,0.35)'
  ctx.lineWidth = 1
  for (let r = 40; r <= R; r += 40) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(cx - R, cy)
  ctx.lineTo(cx + R, cy)
  ctx.moveTo(cx, cy - R)
  ctx.lineTo(cx, cy + R)
  ctx.stroke()
  const sweep = random() * Math.PI * 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(sweep - Math.PI / 2)
  const g = ctx.createLinearGradient(0, 0, R, 0)
  g.addColorStop(0, 'rgba(80,255,140,0)')
  g.addColorStop(1, 'rgba(80,255,140,0.45)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, R, -0.35, 0.35)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  for (let i = 0; i < 6; i++) {
    const a = random() * Math.PI * 2
    const d = 40 + random() * (R - 50)
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d
    ctx.fillStyle = 'rgba(120,255,160,0.9)'
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}
