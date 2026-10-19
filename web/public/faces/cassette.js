// A retro cassette tape where the reels spin with seconds.
export const face = {
  id: 'cassette',
  name: 'Cassette',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A spinning cassette tape from the 80s. The reels rotate with the seconds, bringing retro vibes.',
  tags: ['retro', 'music', 'fun'],
  clock: { style: 1, x: 158, y: 180, color: '#ff6b35' },
  settings: [
    { key: 'label', label: 'Tape label', type: 'text', default: 'AWESOME MIX' },
    { key: 'tapeColor', label: 'Tape color', type: 'color', default: '#1a1a2e' },
  ],
}

function drawReel(ctx, x, y, r, rotation, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
  ctx.fill()

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.arc(Math.cos(angle) * r * 0.55, Math.sin(angle) * r * 0.55, r * 0.15, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

export default function draw(ctx, { size, settings, now }) {
  const label = settings.label || 'AWESOME MIX'
  const tapeColor = settings.tapeColor || '#1a1a2e'

  ctx.fillStyle = '#0f0f0f'
  ctx.fillRect(0, 0, size, size)

  const tapeW = 380
  const tapeH = 240
  const tapeX = (size - tapeW) / 2
  const tapeY = 220

  ctx.fillStyle = tapeColor
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(tapeX, tapeY, tapeW, tapeH, 12)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#f5f5dc'
  ctx.fillRect(tapeX + 30, tapeY + 20, tapeW - 60, 50)

  ctx.fillStyle = '#333'
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label.toUpperCase().slice(0, 20), size / 2, tapeY + 50)

  ctx.fillStyle = '#222'
  ctx.fillRect(tapeX + 60, tapeY + 90, tapeW - 120, 100)

  const sec = now.getSeconds()
  const ms = now.getMilliseconds()
  const rotation = ((sec + ms / 1000) / 60) * Math.PI * 2

  const leftProgress = 1 - (now.getMinutes() / 60)
  const rightProgress = now.getMinutes() / 60
  const leftR = 30 + leftProgress * 15
  const rightR = 30 + rightProgress * 15

  drawReel(ctx, tapeX + 120, tapeY + 140, leftR, rotation, '#8b4513')
  drawReel(ctx, tapeX + tapeW - 120, tapeY + 140, rightR, -rotation, '#8b4513')

  ctx.strokeStyle = '#8b4513'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(tapeX + 120 + leftR, tapeY + 140)
  ctx.lineTo(tapeX + 60, tapeY + 180)
  ctx.lineTo(tapeX + tapeW - 60, tapeY + 180)
  ctx.lineTo(tapeX + tapeW - 120 - rightR, tapeY + 140)
  ctx.stroke()

  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = '#444'
    ctx.beginPath()
    ctx.arc(tapeX + 50 + i * (tapeW - 100), tapeY + tapeH - 30, 8, 0, Math.PI * 2)
    ctx.fill()
  }
}
