// Every day of the year as a seed in a sunflower spiral. The days gone by are lit.
export const face = {
  id: 'year-bloom',
  name: 'Year in Bloom',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Each day of the year is a seed in a sunflower spiral. Days gone by glow, today shines, the rest are waiting.',
  tags: ['live', 'generative'],
  live: 'Progress through the year on the day you install it',
  clock: { style: 4, x: 170, y: 196, color: '#ffffff' },
  settings: [
    { key: 'accent', label: 'Past days', type: 'color', default: '#ff7a45' },
    { key: 'accent2', label: 'Recent days', type: 'color', default: '#ffd166' },
  ],
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`
}

export default function draw(ctx, { size, settings, now }) {
  const year = now.getFullYear()
  const days = (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 864e5
  const today = Math.floor((new Date(year, now.getMonth(), now.getDate()) - new Date(year, 0, 1)) / 864e5)
  const a = String(settings.accent || '#ff7a45')
  const b = String(settings.accent2 || '#ffd166')
  const cx = size / 2
  const cy = size / 2

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  bg.addColorStop(0, '#16110d')
  bg.addColorStop(1, '#050403')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const rMin = 112
  const rMax = 216
  for (let i = 0; i < days; i++) {
    const r = Math.sqrt(rMin * rMin + ((rMax * rMax - rMin * rMin) * i) / (days - 1))
    const ang = i * GOLDEN
    const x = cx + r * Math.cos(ang)
    const y = cy + r * Math.sin(ang)
    const dot = 3.2 + (r - rMin) / 52
    if (i === today) continue
    ctx.fillStyle = i < today ? mix(a, b, Math.pow(i / Math.max(1, today), 3)) : 'rgba(255,255,255,0.09)'
    ctx.beginPath()
    ctx.arc(x, y, dot, 0, Math.PI * 2)
    ctx.fill()
  }
  // Today's seed, drawn last so its glow sits on top.
  const r = Math.sqrt(rMin * rMin + ((rMax * rMax - rMin * rMin) * today) / (days - 1))
  const x = cx + r * Math.cos(today * GOLDEN)
  const y = cy + r * Math.sin(today * GOLDEN)
  ctx.save()
  ctx.shadowColor = b
  ctx.shadowBlur = 18
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x, y, 6.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '600 13px monospace'
  ctx.fillText(`DAY ${today + 1} · ${Math.round(((today + 1) / days) * 100)}%`, cx, 272)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '500 11px monospace'
  ctx.fillText(`${days - today - 1} LEFT IN ${year}`, cx, 290)
}
