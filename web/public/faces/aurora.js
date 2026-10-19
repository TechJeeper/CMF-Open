export const face = {
  id: 'aurora',
  name: 'Aurora',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Northern lights over a dark horizon — flowing green and violet bands, different every seed.',
  tags: ['generative', 'nature'],
  clock: { style: 0, x: 113, y: 88, color: '#e8fff4' },
  settings: [
    { key: 'seed', label: 'Pattern', type: 'number', default: 11 },
    { key: 'green', label: 'Aurora green', type: 'color', default: '#3dff9a' },
    { key: 'violet', label: 'Aurora violet', type: 'color', default: '#9b5cff' },
  ],
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0)

export default function draw(ctx, { size, settings, random, noise }) {
  const G = rgb(settings.green || '#3dff9a')
  const V = rgb(settings.violet || '#9b5cff')
  const sky = ctx.createLinearGradient(0, 0, 0, size)
  sky.addColorStop(0, '#020812')
  sky.addColorStop(0.55, '#0a1530')
  sky.addColorStop(1, '#1a0a20')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, size, size)
  for (let y = 80; y < 380; y += 2) {
    const n = noise(y * 0.012, random() * 10)
    const t = (n + 1) / 2
    const c = G.map((g, i) => Math.round(g + (V[i] - g) * t))
    ctx.fillStyle = `rgba(${c.join(',')},${0.08 + t * 0.25})`
    const wave = Math.sin(y * 0.04 + random() * 6) * 40 + size / 2
    ctx.fillRect(wave - 180, y, 360, 3)
  }
  ctx.fillStyle = '#050508'
  ctx.fillRect(0, 340, size, size - 340)
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255,255,255,${random() * 0.6})`
    ctx.fillRect(random() * size, random() * 280, 1.2, 1.2)
  }
}
