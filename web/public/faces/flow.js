// Generative flow field: thousands of strands following a smooth noise current.
export const face = {
  id: 'flow',
  name: 'Flow Field',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Thousands of silky strands drifting along an evolving current. The flow shifts gently over time.',
  tags: ['generative', 'art'],
  clock: { style: 0, x: 113, y: 92, color: '#ffffff' },
  settings: [
    { key: 'seed', label: 'Seed', type: 'number', default: 42, help: 'Any number gives a different piece' },
    { key: 'a', label: 'Colour A', type: 'color', default: '#ff6b35' },
    { key: 'b', label: 'Colour B', type: 'color', default: '#3ec1d3' },
    { key: 'bg', label: 'Background', type: 'color', default: '#0b0b12' },
  ],
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0)

export default function draw(ctx, { size, settings, random, noise, now }) {
  const A = rgb(settings.a || '#ff6b35')
  const B = rgb(settings.b || '#3ec1d3')
  
  const time = (now.getSeconds() + now.getMilliseconds() / 1000) / 60
  
  ctx.fillStyle = String(settings.bg || '#0b0b12')
  ctx.fillRect(0, 0, size, size)
  const swirl = 1.2 + random() * 1.6
  const scale = 0.004 + random() * 0.004
  ctx.lineCap = 'round'
  
  for (let i = 0; i < 1700; i++) {
    let x = random() * size
    let y = random() * size
    const t = (noise(x * 0.003 + 50 + time * 0.5, y * 0.003 + time * 0.3) + 1) / 2
    const c = A.map((v, k) => Math.round(v + (B[k] - v) * t))
    ctx.strokeStyle = `rgba(${c.join(',')},${0.25 + random() * 0.45})`
    ctx.lineWidth = 0.6 + random() * 1.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    const steps = 25 + Math.floor(random() * 45)
    for (let s = 0; s < steps; s++) {
      // Time-varying flow field
      const ang = noise(x * scale + time * 0.2, y * scale + time * 0.15) * Math.PI * swirl
      x += Math.cos(ang) * 2.4
      y += Math.sin(ang) * 2.4
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  
  // A soft pool of background colour so the clock stays readable.
  const [r, g, b] = rgb(settings.bg || '#0b0b12')
  const pool = ctx.createRadialGradient(233, 140, 10, 233, 140, 170)
  pool.addColorStop(0, `rgba(${r},${g},${b},0.85)`)
  pool.addColorStop(0.6, `rgba(${r},${g},${b},0.45)`)
  pool.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, size, size)
}
