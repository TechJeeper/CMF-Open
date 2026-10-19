export const face = {
  id: 'week-ring',
  name: 'Week Ring',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Seven segments for the days of this week. Past days glow, today is bright, the rest wait in the dark.',
  tags: ['live', 'minimal', 'productivity'],
  live: 'Which day of the week it is when you install',
  clock: { style: 4, x: 198, y: 198, color: '#ffffff' },
  settings: [
    { key: 'accent', label: 'Past days', type: 'color', default: '#4d96ff' },
    { key: 'today', label: 'Today', type: 'color', default: '#ffd93d' },
  ],
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function draw(ctx, { size, settings, now }) {
  const monFirst = (now.getDay() + 6) % 7
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  const R = 175
  const thick = 36
  for (let i = 0; i < 7; i++) {
    const a0 = (i / 7) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / 7) * Math.PI * 2 - Math.PI / 2
    const past = i < monFirst
    const today = i === monFirst
    ctx.strokeStyle = today ? String(settings.today || '#ffd93d') : past ? String(settings.accent || '#4d96ff') : 'rgba(255,255,255,0.12)'
    ctx.lineWidth = today ? thick + 4 : thick
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.arc(cx, cy, R, a0, a1)
    ctx.stroke()
    const mid = (a0 + a1) / 2
    ctx.fillStyle = today ? '#fff' : 'rgba(255,255,255,0.55)'
    ctx.font = `${today ? 600 : 500} 13px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(DAYS[i], cx + Math.cos(mid) * (R - 50), cy + Math.sin(mid) * (R - 50))
  }
}
