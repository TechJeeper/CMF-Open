// Planets orbiting the sun - hours and minutes as celestial bodies.
export const face = {
  id: 'orbit',
  name: 'Solar Orbit',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A tiny solar system where planets represent hours and minutes. Watch time orbit around the sun.',
  tags: ['space', 'fun', 'live'],
  clock: { style: 0, x: 180, y: 420, color: '#ffffff' },
  settings: [
    { key: 'showLabels', label: 'Show time labels', type: 'boolean', default: true },
    { key: 'trailLength', label: 'Orbit trails', type: 'boolean', default: true },
  ],
}

export default function draw(ctx, { size, settings, now }) {
  const cx = size / 2
  const cy = size / 2

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.55)
  bg.addColorStop(0, '#0a0a1a')
  bg.addColorStop(1, '#000005')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 150; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 1.2
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 35)
  sun.addColorStop(0, '#fff7e0')
  sun.addColorStop(0.5, '#ffcc00')
  sun.addColorStop(1, '#ff6600')
  ctx.fillStyle = sun
  ctx.shadowColor = '#ffaa00'
  ctx.shadowBlur = 30
  ctx.beginPath()
  ctx.arc(cx, cy, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  const h = now.getHours() % 12
  const m = now.getMinutes()
  const s = now.getSeconds()

  const hourAngle = ((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2
  const minAngle = ((m + s / 60) / 60) * Math.PI * 2 - Math.PI / 2
  const secAngle = (s / 60) * Math.PI * 2 - Math.PI / 2

  const orbits = [
    { r: 160, angle: hourAngle, color: '#4a9eff', size: 14, label: 'H' },
    { r: 115, angle: minAngle, color: '#ff6b6b', size: 10, label: 'M' },
    { r: 75, angle: secAngle, color: '#50fa7b', size: 6, label: 'S' },
  ]

  orbits.forEach(({ r, color }) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  })

  if (settings.trailLength !== false && ctx.createConicGradient) {
    orbits.forEach(({ r, angle, color }) => {
      const grad = ctx.createConicGradient(angle - Math.PI, cx, cy)
      if (grad && grad.addColorStop) {
        grad.addColorStop(0, 'transparent')
        grad.addColorStop(0.15, color + '40')
        grad.addColorStop(0.5, 'transparent')
        ctx.strokeStyle = grad
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    })
  }

  orbits.forEach(({ r, angle, color, size: pSize }) => {
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r

    ctx.shadowColor = color
    ctx.shadowBlur = 12
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, pSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  })

  if (settings.showLabels !== false) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '600 32px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    ctx.fillText(timeStr, cx, size - 50)
  }
}
