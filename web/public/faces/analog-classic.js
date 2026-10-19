// Classic analog watch with rotating hands - the firmware draws the hands!
export const face = {
  id: 'analog-classic',
  name: 'Classic Analog',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A timeless analog dial. Note: This is a static preview — for true animated hands, use a structured dial (.bin) with analog hand widgets.',
  tags: ['analog', 'classic', 'minimal'],
  clock: { style: 0, x: 0, y: 0, color: '#ffffff' }, // Hidden - we use analog hands
  settings: [
    { key: 'dialColor', label: 'Dial colour', type: 'color', default: '#1a1a1a' },
    { key: 'accentColor', label: 'Accent colour', type: 'color', default: '#ff4f3a' },
    { key: 'showIndices', label: 'Hour markers', type: 'boolean', default: true },
    { key: 'showNumbers', label: 'Hour numbers', type: 'boolean', default: false },
  ],
}

export default function draw(ctx, { size, settings, now }) {
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.45
  
  const dialColor = settings.dialColor || '#1a1a1a'
  const accent = settings.accentColor || '#ff4f3a'
  const showIndices = settings.showIndices !== false
  const showNumbers = settings.showNumbers === true

  // Background gradient
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.1)
  bg.addColorStop(0, dialColor)
  bg.addColorStop(1, '#000000')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  // Outer ring
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()

  // Inner ring
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2)
  ctx.stroke()

  // Hour markers or numbers
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * (Math.PI / 180)
    const markerRadius = radius * 0.85
    const x = cx + Math.cos(angle) * markerRadius
    const y = cy + Math.sin(angle) * markerRadius

    if (showNumbers) {
      ctx.font = `bold ${size * 0.06}px sans-serif`
      ctx.fillStyle = i === 0 ? accent : '#ffffff'
      ctx.fillText(i === 0 ? '12' : String(i), x, y)
    } else if (showIndices) {
      const innerRadius = radius * (i % 3 === 0 ? 0.75 : 0.80)
      const ix = cx + Math.cos(angle) * innerRadius
      const iy = cy + Math.sin(angle) * innerRadius
      
      ctx.strokeStyle = i % 3 === 0 ? '#ffffff' : '#666'
      ctx.lineWidth = i % 3 === 0 ? 3 : 1
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ix, iy)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  // Minute tick marks
  if (showIndices) {
    for (let i = 0; i < 60; i++) {
      if (i % 5 !== 0) {
        const angle = (i * 6 - 90) * (Math.PI / 180)
        const outerR = radius * 0.85
        const innerR = radius * 0.82
        const ox = cx + Math.cos(angle) * outerR
        const oy = cy + Math.sin(angle) * outerR
        const ix = cx + Math.cos(angle) * innerR
        const iy = cy + Math.sin(angle) * innerR
        
        ctx.strokeStyle = '#444'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(ix, iy)
        ctx.lineTo(ox, oy)
        ctx.stroke()
      }
    }
  }

  // Draw hands (preview only - firmware draws these with smooth animation)
  const hours = now.getHours() % 12
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()

  // Hour hand
  const hourAngle = ((hours + minutes / 60) * 30 - 90) * (Math.PI / 180)
  drawHand(ctx, cx, cy, hourAngle, radius * 0.5, 6, '#ffffff')

  // Minute hand
  const minuteAngle = ((minutes + seconds / 60) * 6 - 90) * (Math.PI / 180)
  drawHand(ctx, cx, cy, minuteAngle, radius * 0.7, 4, '#ffffff')

  // Second hand
  const secondAngle = (seconds * 6 - 90) * (Math.PI / 180)
  drawHand(ctx, cx, cy, secondAngle, radius * 0.75, 2, accent)
  
  // Second hand tail
  const tailAngle = secondAngle + Math.PI
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(tailAngle) * radius * 0.15, cy + Math.sin(tailAngle) * radius * 0.15)
  ctx.stroke()

  // Center cap
  ctx.fillStyle = '#333'
  ctx.beginPath()
  ctx.arc(cx, cy, 8, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  // Brand text
  ctx.font = `${size * 0.025}px sans-serif`
  ctx.fillStyle = '#666'
  ctx.fillText('CMF', cx, cy - radius * 0.3)
}

function drawHand(ctx, cx, cy, angle, length, width, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length)
  ctx.stroke()
}
