// This month's calendar with today circled.
export const face = {
  id: 'month',
  name: 'Month',
  version: '1.0.0',
  author: 'cmfkit',
  description: "A clean calendar of the current month under the clock, with today circled. Reinstall on the 1st.",
  tags: ['live', 'minimal'],
  live: 'The calendar of the month you install it in',
  clock: { style: 3, x: 104, y: 56, color: '#ffffff' },
  settings: [
    { key: 'accent', label: 'Accent', type: 'color', default: '#ff4f3a' },
    { key: 'mondayFirst', label: 'Weeks start on Monday', type: 'boolean', default: true },
  ],
}

export default function draw(ctx, { size, settings, now }) {
  const accent = String(settings.accent || '#ff4f3a')
  const monFirst = settings.mondayFirst !== false
  const cx = size / 2
  const bg = ctx.createRadialGradient(cx, 120, 20, cx, cx, size * 0.7)
  bg.addColorStop(0, '#1e1e22')
  bg.addColorStop(1, '#09090b')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const y = now.getFullYear()
  const m = now.getMonth()
  const first = new Date(y, m, 1)
  const daysIn = new Date(y, m + 1, 0).getDate()
  const offset = monFirst ? (first.getDay() + 6) % 7 : first.getDay()
  const rows = Math.ceil((offset + daysIn) / 7)
  const cw = 38
  const ch = rows > 5 ? 30 : 33
  const x0 = cx - 3 * cw
  const top = 226

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = accent
  ctx.font = '700 14px sans-serif'
  ctx.fillText(first.toLocaleDateString('en', { month: 'long', year: 'numeric' }).toUpperCase().split('').join(' '), cx, 170)

  const heads = monFirst ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  ctx.font = '600 11px sans-serif'
  heads.forEach((h, i) => {
    const weekend = monFirst ? i >= 5 : i === 0 || i === 6
    ctx.fillStyle = weekend ? 'rgba(255,120,100,0.6)' : 'rgba(255,255,255,0.45)'
    ctx.fillText(h, x0 + i * cw, 198)
  })

  for (let d = 1; d <= daysIn; d++) {
    const idx = offset + d - 1
    const col = idx % 7
    const x = x0 + col * cw
    const yy = top + Math.floor(idx / 7) * ch
    const isToday = d === now.getDate()
    const weekend = monFirst ? col >= 5 : col === 0 || col === 6
    if (isToday) {
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(x, yy, 15, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.font = `${isToday ? 700 : 500} 15px sans-serif`
    ctx.fillStyle = isToday ? '#fff' : d < now.getDate() ? 'rgba(255,255,255,0.32)' : weekend ? 'rgba(255,150,130,0.9)' : 'rgba(255,255,255,0.88)'
    ctx.fillText(String(d), x, yy + 1)
  }
}
