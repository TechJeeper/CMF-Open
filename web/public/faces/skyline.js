export const face = {
  id: 'skyline',
  name: 'Skyline',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A layered city silhouette at dusk with window lights. The skyline profile comes from your seed.',
  tags: ['generative', 'art'],
  clock: { style: 0, x: 113, y: 72, color: '#ffe8c8' },
  settings: [
    { key: 'seed', label: 'City layout', type: 'number', default: 5 },
    { key: 'name', label: 'Label under skyline', type: 'text', default: 'HOME' },
  ],
}

export default function draw(ctx, { size, settings, random, noise }) {
  const sky = ctx.createLinearGradient(0, 0, 0, 320)
  sky.addColorStop(0, '#0c1445')
  sky.addColorStop(0.5, '#4a2878')
  sky.addColorStop(1, '#ff7a45')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, size, 320)
  ctx.fillStyle = '#0a0a0c'
  ctx.beginPath()
  ctx.moveTo(0, 320)
  for (let x = 0; x <= size; x += 6) {
    const h = 40 + Math.abs(noise(x * 0.02, 0)) * 120 + random() * 30
    ctx.lineTo(x, 320 - h)
  }
  ctx.lineTo(size, size)
  ctx.lineTo(0, size)
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 120; i++) {
    const x = random() * size
    const y = 320 - 20 - random() * 100
    if (random() > 0.6) {
      ctx.fillStyle = `rgba(255,220,120,${0.3 + random() * 0.7})`
      ctx.fillRect(x, y, 2, 3)
    }
  }
  ctx.fillStyle = 'rgba(255,232,200,0.7)'
  ctx.font = '600 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(settings.name || '').slice(0, 16).toUpperCase(), size / 2, 350)
}
