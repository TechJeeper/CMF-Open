// Time displayed in binary - for the true nerds.
export const face = {
  id: 'binary',
  name: 'Binary Clock',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Time displayed in binary. Each column shows hours, minutes, seconds as illuminated dots. A true nerd flex.',
  tags: ['nerd', 'minimal', 'animated'],
  clock: { style: 0, x: 180, y: 400, color: '#00ff88' },
  settings: [
    { key: 'onColor', label: 'On color', type: 'color', default: '#00ff88' },
    { key: 'offColor', label: 'Off color', type: 'color', default: '#1a2a1f' },
    { key: 'showSeconds', label: 'Show seconds', type: 'boolean', default: true },
    { key: 'showDecimal', label: 'Show decimal hint', type: 'boolean', default: true },
  ],
}

export default function draw(ctx, { size, settings, now }) {
  const onColor = settings.onColor || '#00ff88'
  const offColor = settings.offColor || '#1a2a1f'
  const showSec = settings.showSeconds !== false
  const showDec = settings.showDecimal !== false

  ctx.fillStyle = '#0a0f0c'
  ctx.fillRect(0, 0, size, size)

  const h = now.getHours()
  const m = now.getMinutes()
  const s = now.getSeconds()

  const cols = showSec ? 6 : 4
  const digits = showSec ? [Math.floor(h/10), h%10, Math.floor(m/10), m%10, Math.floor(s/10), s%10]
                         : [Math.floor(h/10), h%10, Math.floor(m/10), m%10]
  const maxBits = [2, 4, 3, 4, 3, 4]

  const dotR = 18
  const gapX = 58
  const gapY = 52
  const startX = size / 2 - ((cols - 1) * gapX) / 2
  const startY = size / 2 - 1.5 * gapY + 20

  ctx.shadowColor = onColor
  ctx.shadowBlur = 12

  for (let col = 0; col < cols; col++) {
    const val = digits[col]
    const bits = maxBits[col]
    
    for (let row = 0; row < 4; row++) {
      const bitVal = 3 - row
      const x = startX + col * gapX
      const y = startY + row * gapY
      
      if (bitVal >= bits) continue
      
      const isOn = (val >> bitVal) & 1
      ctx.fillStyle = isOn ? onColor : offColor
      ctx.shadowBlur = isOn ? 12 : 0
      
      ctx.beginPath()
      ctx.arc(x, y, dotR, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.shadowBlur = 0

  if (showDec) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '500 14px monospace'
    ctx.textAlign = 'center'
    const timeStr = showSec 
      ? `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
      : `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`
    ctx.fillText(timeStr, size/2, size - 60)
  }

  ctx.fillStyle = 'rgba(0,255,136,0.15)'
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('8', startX - 30, startY + 0 * gapY + 4)
  ctx.fillText('4', startX - 30, startY + 1 * gapY + 4)
  ctx.fillText('2', startX - 30, startY + 2 * gapY + 4)
  ctx.fillText('1', startX - 30, startY + 3 * gapY + 4)
}
