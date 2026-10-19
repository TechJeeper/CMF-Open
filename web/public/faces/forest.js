// A peaceful forest scene that changes with time of day.
export const face = {
  id: 'forest',
  name: 'Forest',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A serene forest that shifts from dawn to dusk. Trees sway gently and the sky changes with real time.',
  tags: ['nature', 'live', 'calm'],
  clock: { style: 0, x: 160, y: 70, color: '#ffffff' },
  settings: [
    { key: 'season', label: 'Season', type: 'select', options: ['Spring', 'Summer', 'Autumn', 'Winter'], default: 'Summer' },
  ],
}

const SEASONS = {
  Spring: { leaf: '#7cb342', ground: '#8bc34a', sky: ['#87ceeb', '#b3e5fc'] },
  Summer: { leaf: '#2e7d32', ground: '#4caf50', sky: ['#64b5f6', '#81d4fa'] },
  Autumn: { leaf: '#e65100', ground: '#bf360c', sky: ['#ffcc80', '#ffab91'] },
  Winter: { leaf: '#546e7a', ground: '#eceff1', sky: ['#90a4ae', '#b0bec5'] },
}

function drawTree(ctx, x, y, height, leafColor, sway) {
  ctx.fillStyle = '#5d4037'
  ctx.fillRect(x - 8, y - height * 0.4, 16, height * 0.4)

  const layers = 4
  for (let i = 0; i < layers; i++) {
    const layerY = y - height * 0.35 - i * height * 0.18
    const layerW = 60 - i * 12 + Math.sin(sway + i) * 3
    ctx.fillStyle = leafColor
    ctx.beginPath()
    ctx.moveTo(x, layerY - height * 0.22)
    ctx.lineTo(x - layerW / 2, layerY)
    ctx.lineTo(x + layerW / 2, layerY)
    ctx.closePath()
    ctx.fill()
  }
}

export default function draw(ctx, { size, settings, now }) {
  const season = SEASONS[settings.season] || SEASONS.Summer
  const hour = now.getHours()
  const sway = now.getSeconds() / 10

  let skyTop, skyBottom
  if (hour >= 6 && hour < 12) {
    skyTop = '#ffcc80'
    skyBottom = '#81d4fa'
  } else if (hour >= 12 && hour < 18) {
    skyTop = season.sky[0]
    skyBottom = season.sky[1]
  } else if (hour >= 18 && hour < 21) {
    skyTop = '#ff7043'
    skyBottom = '#7e57c2'
  } else {
    skyTop = '#1a237e'
    skyBottom = '#311b92'
  }

  const sky = ctx.createLinearGradient(0, 0, 0, size)
  sky.addColorStop(0, skyTop)
  sky.addColorStop(0.6, skyBottom)
  sky.addColorStop(1, season.ground)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, size, size)

  if (hour >= 21 || hour < 6) {
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`
      ctx.beginPath()
      ctx.arc(Math.random() * size, Math.random() * size * 0.5, Math.random() * 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const groundY = size * 0.75
  ctx.fillStyle = season.ground
  ctx.fillRect(0, groundY, size, size - groundY)

  const trees = [
    { x: 60, y: groundY + 20, h: 180 },
    { x: 150, y: groundY + 40, h: 220 },
    { x: 250, y: groundY + 10, h: 200 },
    { x: 340, y: groundY + 30, h: 190 },
    { x: 420, y: groundY + 50, h: 170 },
  ]

  trees.forEach(({ x, y, h }, i) => {
    drawTree(ctx, x, y, h, season.leaf, sway + i * 0.5)
  })

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '500 14px sans-serif'
  ctx.textAlign = 'center'
  const date = now.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })
  ctx.fillText(date, size / 2, size - 40)
}
