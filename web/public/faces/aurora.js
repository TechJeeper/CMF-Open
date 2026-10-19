export const face = {
  id: 'aurora',
  name: 'Aurora',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Northern lights over a dark horizon — flowing green and violet bands that shimmer and wave.',
  tags: ['generative', 'nature'],
  clock: { style: 0, x: 113, y: 88, color: '#e8fff4' },
  settings: [
    { key: 'seed', label: 'Pattern', type: 'number', default: 11 },
    { key: 'green', label: 'Aurora green', type: 'color', default: '#3dff9a' },
    { key: 'violet', label: 'Aurora violet', type: 'color', default: '#9b5cff' },
  ],
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0)

export default function draw(ctx, { size, settings, random, noise, now }) {
  const G = rgb(settings.green || '#3dff9a')
  const V = rgb(settings.violet || '#9b5cff')
  
  const time = (now.getSeconds() + now.getMilliseconds() / 1000) / 60
  
  const sky = ctx.createLinearGradient(0, 0, 0, size)
  sky.addColorStop(0, '#020812')
  sky.addColorStop(0.55, '#0a1530')
  sky.addColorStop(1, '#1a0a20')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, size, size)
  
  // Stars with subtle twinkling
  for (let i = 0; i < 80; i++) {
    const sx = random() * size
    const sy = random() * 280
    const twinkle = 0.3 + Math.sin(time * Math.PI * 8 + random() * 10) * 0.3
    ctx.fillStyle = `rgba(255,255,255,${random() * 0.4 + twinkle})`
    ctx.fillRect(sx, sy, 1.2, 1.2)
  }
  
  // Animated aurora bands
  for (let y = 80; y < 380; y += 2) {
    const n = noise(y * 0.012 + time * 2, random() * 10)
    const t = (n + 1) / 2
    const c = G.map((g, i) => Math.round(g + (V[i] - g) * t))
    const alpha = 0.08 + t * 0.25 + Math.sin(time * Math.PI * 4 + y * 0.02) * 0.08
    ctx.fillStyle = `rgba(${c.join(',')},${Math.max(0, alpha)})`
    const wave = Math.sin(y * 0.04 + time * Math.PI * 4 + random() * 6) * 50 + size / 2
    ctx.fillRect(wave - 180, y, 360, 3)
  }
  
  ctx.fillStyle = '#050508'
  ctx.fillRect(0, 340, size, size - 340)
}
