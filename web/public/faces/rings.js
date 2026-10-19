// Concentric rings showing hours, minutes, seconds.
export const face = {
  id: 'rings',
  name: 'Time Rings',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Three concentric arcs that fill as hours, minutes, and seconds progress. A beautiful data visualization.',
  tags: ['minimal', 'fitness'],
  clock: null,
  settings: [
    { key: 'hourColor', label: 'Hour ring', type: 'color', default: '#ff6b6b' },
    { key: 'minColor', label: 'Minute ring', type: 'color', default: '#4ecdc4' },
    { key: 'secColor', label: 'Second ring', type: 'color', default: '#ffe66d' },
    { key: 'thickness', label: 'Ring thickness', type: 'number', default: 24 },
  ],
}

export default function draw(ctx, { size, settings, now }) {
  const hourColor = settings.hourColor || '#ff6b6b'
  const minColor = settings.minColor || '#4ecdc4'
  const secColor = settings.secColor || '#ffe66d'
  const thick = settings.thickness || 24

  ctx.fillStyle = '#0f0f0f'
  ctx.fillRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2

  const h = now.getHours() % 12
  const m = now.getMinutes()
  const s = now.getSeconds()

  const hourPct = (h + m / 60) / 12
  const minPct = (m + s / 60) / 60
  const secPct = s / 60

  const rings = [
    { radius: 180, pct: hourPct, color: hourColor, label: 'H' },
    { radius: 140, pct: minPct, color: minColor, label: 'M' },
    { radius: 100, pct: secPct, color: secColor, label: 'S' },
  ]

  rings.forEach(({ radius, pct, color, label }) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = thick
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()

    const startAngle = -Math.PI / 2
    const endAngle = startAngle + pct * Math.PI * 2

    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 15
    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, endAngle)
    ctx.stroke()
    ctx.shadowBlur = 0
  })

  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 42px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(timeStr, cx, cy)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '500 14px sans-serif'
  const date = now.toLocaleDateString('en', { weekday: 'short', day: 'numeric' })
  ctx.fillText(date, cx, cy + 30)
}
