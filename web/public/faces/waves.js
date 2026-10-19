// Animated ocean waves with time displayed on the horizon.
export const face = {
  id: 'waves',
  name: 'Ocean Waves',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Calming ocean waves that ripple across your wrist. The sun or moon rises based on the time.',
  tags: ['nature', 'calm', 'live'],
  clock: { style: 0, x: 158, y: 200, color: '#ffffff' },
  settings: [
    { key: 'waveColor', label: 'Wave color', type: 'color', default: '#0077b6' },
  ],
}

export default function draw(ctx, { size, settings, now }) {
  const waveColor = settings.waveColor || '#0077b6'
  const hour = now.getHours()
  const sec = now.getSeconds()
  const ms = now.getMilliseconds()
  const t = (sec + ms / 1000) / 60

  const isNight = hour < 6 || hour >= 20

  const sky = ctx.createLinearGradient(0, 0, 0, size * 0.5)
  if (isNight) {
    sky.addColorStop(0, '#0a1628')
    sky.addColorStop(1, '#1a365d')
  } else if (hour < 8 || hour >= 18) {
    sky.addColorStop(0, '#ff7e5f')
    sky.addColorStop(1, '#feb47b')
  } else {
    sky.addColorStop(0, '#56ccf2')
    sky.addColorStop(1, '#2f80ed')
  }
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, size, size)

  if (isNight) {
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`
      ctx.beginPath()
      ctx.arc(Math.random() * size, Math.random() * size * 0.4, Math.random() * 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const celestialY = 100 + Math.sin((hour % 12) / 12 * Math.PI) * 60
  const celestialX = size / 2

  if (isNight) {
    ctx.fillStyle = '#f5f5dc'
    ctx.shadowColor = '#f5f5dc'
    ctx.shadowBlur = 20
    ctx.beginPath()
    ctx.arc(celestialX, celestialY, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0a1628'
    ctx.beginPath()
    ctx.arc(celestialX + 10, celestialY - 5, 25, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const sun = ctx.createRadialGradient(celestialX, celestialY, 0, celestialX, celestialY, 40)
    sun.addColorStop(0, '#fff9c4')
    sun.addColorStop(0.5, '#ffeb3b')
    sun.addColorStop(1, '#ff9800')
    ctx.fillStyle = sun
    ctx.shadowColor = '#ffeb3b'
    ctx.shadowBlur = 30
    ctx.beginPath()
    ctx.arc(celestialX, celestialY, 35, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0

  const horizonY = size * 0.45
  const waveColors = [
    waveColor + 'cc',
    waveColor + 'aa',
    waveColor + '88',
    waveColor,
  ]

  for (let layer = 0; layer < 4; layer++) {
    const amplitude = 15 - layer * 2
    const frequency = 0.015 + layer * 0.003
    const speed = t * Math.PI * 2 * (1 + layer * 0.3)
    const yOffset = horizonY + layer * 50

    ctx.fillStyle = waveColors[layer]
    ctx.beginPath()
    ctx.moveTo(0, size)

    for (let x = 0; x <= size; x += 5) {
      const y = yOffset + Math.sin(x * frequency + speed) * amplitude
                       + Math.sin(x * frequency * 2 + speed * 1.5) * amplitude * 0.5
      ctx.lineTo(x, y)
    }

    ctx.lineTo(size, size)
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  const date = now.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
  ctx.fillText(date, size / 2, size - 45)
}
