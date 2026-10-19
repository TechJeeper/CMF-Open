export const face = {
  id: 'glitch',
  name: 'Glitch',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'RGB-split blocks and scan lines that flicker and shift like a misbehaving display.',
  tags: ['generative', 'retro', 'animated'],
  clock: { style: 0, x: 113, y: 92, color: '#ffffff' },
  settings: [
    { key: 'seed', label: 'Glitch seed', type: 'number', default: 99 },
    { key: 'a', label: 'Channel A', type: 'color', default: '#ff0040' },
    { key: 'b', label: 'Channel B', type: 'color', default: '#00e5ff' },
  ],
}

export default function draw(ctx, { size, settings, random, now }) {
  const time = now.getSeconds() + now.getMilliseconds() / 1000
  const glitchIntensity = Math.sin(time * 3) > 0.7 ? 1.5 : 1
  
  ctx.fillStyle = '#101018'
  ctx.fillRect(0, 0, size, size)
  
  // Occasional horizontal tear
  if (Math.sin(time * 7) > 0.85) {
    const tearY = (time * 100) % size
    ctx.fillStyle = '#101018'
    ctx.fillRect(0, tearY, size, 20)
    ctx.drawImage(ctx.canvas, Math.sin(time * 50) * 15, 0)
  }
  
  const blocks = Math.floor((55 + Math.floor(random() * 40)) * glitchIntensity)
  for (let i = 0; i < blocks; i++) {
    const flickerOffset = Math.sin(time * 20 + i) * 5
    const x = random() * size + flickerOffset
    const y = random() * size
    const w = 20 + random() * 120
    const h = 4 + random() * 28
    if (y > 70 && y < 200 && x > 60 && x < 400) continue
    
    const alpha = Math.sin(time * 10 + i * 0.5) > 0 ? '55' : '33'
    ctx.fillStyle = i % 2 ? String(settings.a || '#ff0040') + alpha : String(settings.b || '#00e5ff') + alpha
    ctx.fillRect(x, y, w, h)
    
    // RGB split effect
    if (random() > 0.5) {
      const split = (random() > 0.5 ? 3 : -3) + Math.sin(time * 15) * 2
      ctx.fillRect(x + split, y, w, h)
    }
  }
  
  // Animated scan lines
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  const scanOffset = (time * 50) % 4
  for (let y = scanOffset; y < size; y += 4) ctx.fillRect(0, y, size, 1)
  
  const calm = ctx.createRadialGradient(233, 140, 10, 233, 140, 150)
  calm.addColorStop(0, 'rgba(16,16,24,0.9)')
  calm.addColorStop(1, 'rgba(16,16,24,0)')
  ctx.fillStyle = calm
  ctx.fillRect(0, 0, size, size)
}
