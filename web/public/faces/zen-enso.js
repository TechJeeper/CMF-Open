export const face = {
  id: 'zen-enso',
  name: 'Enso',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A hand-brushed Zen circle on warm paper. Imperfect on purpose — calm space for the clock in the middle.',
  tags: ['minimal', 'art'],
  clock: { style: 2, x: 128, y: 108, color: '#2a2418' },
  settings: [
    { key: 'seed', label: 'Brush stroke', type: 'number', default: 3 },
    { key: 'ink', label: 'Ink', type: 'color', default: '#1a1610' },
    { key: 'paper', label: 'Paper', type: 'color', default: '#f4ead8' },
  ],
}

export default function draw(ctx, { size, settings, random, noise }) {
  ctx.fillStyle = String(settings.paper || '#f4ead8')
  ctx.fillRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2 + 10
  const R = 150 + random() * 20
  ctx.strokeStyle = String(settings.ink || '#1a1610')
  ctx.lineWidth = 14 + random() * 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  const gap = 0.35 + random() * 0.5
  for (let a = gap; a < Math.PI * 2 - gap; a += 0.02) {
    const w = noise(Math.cos(a) * 3, Math.sin(a) * 3) * 8
    const x = cx + Math.cos(a) * (R + w)
    const y = cy + Math.sin(a) * (R + w * 0.7)
    if (a === gap) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}
