// A pulsing heart with time - perfect for fitness lovers.
export const face = {
  id: 'heartbeat',
  name: 'Heartbeat',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A glowing heart that pulses with each second. Shows time with a health-focused aesthetic.',
  tags: ['fitness', 'health', 'fun'],
  clock: { style: 2, x: 130, y: 340, color: '#ff4757' },
  settings: [
    { key: 'heartColor', label: 'Heart color', type: 'color', default: '#ff4757' },
    { key: 'pulseSpeed', label: 'Pulse with seconds', type: 'boolean', default: true },
  ],
}

function drawHeart(ctx, cx, cy, size, color) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(size / 30, size / 30)
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.bezierCurveTo(-15, -25, -30, -5, -15, 10)
  ctx.lineTo(0, 25)
  ctx.lineTo(15, 10)
  ctx.bezierCurveTo(30, -5, 15, -25, 0, -8)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

export default function draw(ctx, { size, settings, now }) {
  const heartColor = settings.heartColor || '#ff4757'
  const pulseWithSec = settings.pulseSpeed !== false

  const bg = ctx.createRadialGradient(size/2, size/2, 50, size/2, size/2, size*0.6)
  bg.addColorStop(0, '#1a0a0a')
  bg.addColorStop(1, '#0a0505')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const cx = size / 2
  const cy = 180

  const sec = now.getSeconds()
  const ms = now.getMilliseconds()
  const beat = pulseWithSec ? Math.sin((sec + ms/1000) * Math.PI * 2) : Math.sin(Date.now() / 500 * Math.PI)
  const scale = 3.2 + beat * 0.15

  ctx.globalAlpha = 0.15 + beat * 0.1
  ctx.shadowColor = heartColor
  ctx.shadowBlur = 40
  drawHeart(ctx, cx, cy, scale * 1.3, heartColor)
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1

  drawHeart(ctx, cx, cy, scale, heartColor)

  const grad = ctx.createLinearGradient(cx - 80, cy - 60, cx + 80, cy + 60)
  grad.addColorStop(0, 'rgba(255,255,255,0.3)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  drawHeart(ctx, cx, cy, scale, grad)

  ctx.strokeStyle = 'rgba(255,71,87,0.3)'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.arc(cx, cy, 100, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '500 13px sans-serif'
  ctx.textAlign = 'center'
  const date = now.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })
  ctx.fillText(date, cx, 410)
}
