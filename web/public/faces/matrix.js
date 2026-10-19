export const face = {
  id: 'matrix',
  name: 'Matrix Rain',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Falling digital rain in classic green. Columns are seeded so your watch gets its own stream pattern.',
  tags: ['retro', 'generative', 'nerd'],
  clock: { style: 4, x: 148, y: 198, color: '#6bff6b' },
  settings: [
    { key: 'seed', label: 'Seed', type: 'number', default: 42 },
    { key: 'color', label: 'Phosphor', type: 'color', default: '#39ff14' },
  ],
}

export default function draw(ctx, { size, settings, random }) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(settings.color || '#39ff14').slice(i, i + 2), 16))
  ctx.fillStyle = '#020a04'
  ctx.fillRect(0, 0, size, size)
  ctx.font = '14px monospace'
  const cols = 28
  const colW = size / cols
  for (let c = 0; c < cols; c++) {
    const x = c * colW + 2
    let y = -(random() * size)
    const len = 8 + Math.floor(random() * 18)
    for (let i = 0; i < len; i++) {
      const ch = String.fromCharCode(0x30 + Math.floor(random() * 10))
      const fade = i / len
      ctx.fillStyle = `rgba(${r},${g},${b},${0.15 + fade * 0.85})`
      ctx.fillText(ch, x, y)
      y += 16
      if (y > size + 20) break
    }
  }
  const calm = ctx.createRadialGradient(233, 220, 20, 233, 220, 160)
  calm.addColorStop(0, 'rgba(2,10,4,0.85)')
  calm.addColorStop(1, 'rgba(2,10,4,0)')
  ctx.fillStyle = calm
  ctx.fillRect(0, 0, size, size)
}
