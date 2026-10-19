export const face = {
  id: 'matrix',
  name: 'Matrix Rain',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Falling digital rain in classic green. Characters cascade down the screen in real-time.',
  tags: ['retro', 'generative', 'nerd', 'animated'],
  clock: { style: 4, x: 148, y: 198, color: '#6bff6b' },
  settings: [
    { key: 'seed', label: 'Seed', type: 'number', default: 42 },
    { key: 'color', label: 'Phosphor', type: 'color', default: '#39ff14' },
  ],
}

export default function draw(ctx, { size, settings, random, now }) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(settings.color || '#39ff14').slice(i, i + 2), 16))
  
  const time = now.getSeconds() + now.getMilliseconds() / 1000
  
  ctx.fillStyle = '#020a04'
  ctx.fillRect(0, 0, size, size)
  ctx.font = '14px monospace'
  const cols = 28
  const colW = size / cols
  
  for (let c = 0; c < cols; c++) {
    const x = c * colW + 2
    const speed = 0.5 + random() * 1.5
    const offset = random() * size
    let y = ((time * speed * 80 + offset) % (size + 300)) - 150
    const len = 8 + Math.floor(random() * 18)
    
    for (let i = 0; i < len; i++) {
      const charCode = Math.floor(random() * 10 + (time * 10 + i) % 10) % 10
      const ch = String.fromCharCode(0x30 + charCode)
      const fade = i / len
      const flicker = i === 0 ? 1 : 0.15 + fade * 0.85
      ctx.fillStyle = `rgba(${r},${g},${b},${flicker})`
      if (i === 0) {
        ctx.fillStyle = `rgba(255,255,255,0.95)`
      }
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
