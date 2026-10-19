// Glowing neon sign clock with flickering effect.
export const face = {
  id: 'neon',
  name: 'Neon Sign',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A glowing neon sign that flickers occasionally. Brings the vibe of a late-night diner to your wrist.',
  tags: ['retro', 'nerd', 'fun'],
  clock: { style: 0, x: 180, y: 400, color: '#ff0080' },
  settings: [
    { key: 'color', label: 'Neon color', type: 'color', default: '#ff0080' },
    { key: 'flicker', label: 'Flicker effect', type: 'boolean', default: true },
  ],
}

function drawNeonText(ctx, text, x, y, color, glow, flicker) {
  const alpha = flicker && Math.random() > 0.95 ? 0.3 : 1

  ctx.save()
  ctx.globalAlpha = alpha

  ctx.shadowColor = color
  ctx.shadowBlur = glow
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.font = '700 72px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(text, x, y)

  ctx.shadowBlur = glow * 2
  ctx.strokeText(text, x, y)

  ctx.fillStyle = '#fff'
  ctx.shadowBlur = 0
  ctx.globalAlpha = alpha * 0.9
  ctx.fillText(text, x, y)

  ctx.restore()
}

export default function draw(ctx, { size, settings, now }) {
  const color = settings.color || '#ff0080'
  const flicker = settings.flicker !== false

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = '#1a1a1a'
  for (let y = 0; y < size; y += 40) {
    ctx.fillRect(0, y, size, 2)
  }

  const cx = size / 2
  const h = now.getHours()
  const m = now.getMinutes()
  const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

  drawNeonText(ctx, timeStr, cx, size / 2, color, 25, flicker)

  const sec = now.getSeconds()
  const colonAlpha = sec % 2 === 0 ? 1 : 0.3

  ctx.globalAlpha = colonAlpha
  ctx.shadowColor = color
  ctx.shadowBlur = 15
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, size / 2 - 18, 5, 0, Math.PI * 2)
  ctx.arc(cx, size / 2 + 18, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  const date = now.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
  ctx.font = '500 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  ctx.fillText(date, cx, size / 2 + 80)
  ctx.shadowBlur = 0

  const ampm = h >= 12 ? 'PM' : 'AM'
  ctx.font = '600 24px sans-serif'
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 15
  ctx.fillText(ampm, cx, size / 2 - 70)
  ctx.shadowBlur = 0

  ctx.strokeStyle = color + '40'
  ctx.lineWidth = 8
  ctx.strokeRect(40, 100, size - 80, size - 200)
}
