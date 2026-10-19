export const face = {
  id: 'glitch',
  name: 'Glitch',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'RGB-split blocks and scan lines like a misbehaving LCD. Chaotic but the clock area stays clean.',
  tags: ['generative', 'retro'],
  clock: { style: 0, x: 113, y: 92, color: '#ffffff' },
  settings: [
    { key: 'seed', label: 'Glitch seed', type: 'number', default: 99 },
    { key: 'a', label: 'Channel A', type: 'color', default: '#ff0040' },
    { key: 'b', label: 'Channel B', type: 'color', default: '#00e5ff' },
  ],
}

export default function draw(ctx, { size, settings, random }) {
  ctx.fillStyle = '#101018'
  ctx.fillRect(0, 0, size, size)
  const blocks = 55 + Math.floor(random() * 40)
  for (let i = 0; i < blocks; i++) {
    const x = random() * size
    const y = random() * size
    const w = 20 + random() * 120
    const h = 4 + random() * 28
    if (y > 70 && y < 200 && x > 60 && x < 400) continue
    ctx.fillStyle = i % 2 ? String(settings.a || '#ff0040') + '55' : String(settings.b || '#00e5ff') + '55'
    ctx.fillRect(x, y, w, h)
    if (random() > 0.5) ctx.fillRect(x + (random() > 0.5 ? 3 : -3), y, w, h)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  for (let y = 0; y < size; y += 4) ctx.fillRect(0, y, size, 1)
  const calm = ctx.createRadialGradient(233, 140, 10, 233, 140, 150)
  calm.addColorStop(0, 'rgba(16,16,24,0.9)')
  calm.addColorStop(1, 'rgba(16,16,24,0)')
  ctx.fillStyle = calm
  ctx.fillRect(0, 0, size, size)
}
