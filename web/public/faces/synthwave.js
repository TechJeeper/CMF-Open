// Outrun sunset: striped sun, neon grid, mountain silhouettes.
export const face = {
  id: 'synthwave',
  name: 'Synthwave',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A striped retro sun with an endless glowing grid rushing towards you. Pure 1986.',
  tags: ['retro', 'generative', 'animated'],
  clock: { style: 2, x: 120, y: 52, color: '#fff0fb' },
  settings: [
    { key: 'grid', label: 'Grid colour', type: 'color', default: '#ff2a6d' },
    { key: 'seed', label: 'Mountains', type: 'number', default: 3 },
  ],
}

export default function draw(ctx, { size, settings, random, noise, now }) {
  const grid = String(settings.grid || '#ff2a6d')
  const H = 268
  const cx = size / 2
  
  const time = (now.getSeconds() + now.getMilliseconds() / 1000) / 60

  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#0b0120')
  sky.addColorStop(0.6, '#3a0a58')
  sky.addColorStop(1, '#a3195b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, size, H)
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${random() * 0.7})`
    ctx.fillRect(random() * size, random() * H * 0.7, 1.4, 1.4)
  }

  // The sun, with horizontal gaps that widen towards the horizon.
  const sy = 232
  const sr = 82
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, size, sy - 8)
  let y = sy - 8
  for (let k = 0; y < sy + sr; k++) {
    const gap = 2 + k * 1.6
    const band = 9 - k * 0.6
    y += gap
    ctx.rect(0, y, size, Math.max(2, band))
    y += Math.max(2, band)
  }
  ctx.clip()
  const sun = ctx.createLinearGradient(0, sy - sr, 0, sy + sr * 0.5)
  sun.addColorStop(0, '#ffe45e')
  sun.addColorStop(0.55, '#ff8a3d')
  sun.addColorStop(1, '#ff2a6d')
  ctx.fillStyle = sun
  ctx.shadowColor = '#ff6a3d'
  ctx.shadowBlur = 40
  ctx.beginPath()
  ctx.arc(cx, sy, sr, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Two mountain ranges from layered noise.
  for (const [amp, base, fill, edge] of [
    [46, H - 6, '#240a3d', 'rgba(255,90,200,0.55)'],
    [26, H, '#12051f', 'rgba(255,42,109,0.8)'],
  ]) {
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (let x = 0; x <= size; x += 4) {
      const n = noise(x * 0.012 + base, base * 0.1) * 0.7 + noise(x * 0.05, base) * 0.3
      ctx.lineTo(x, base - Math.abs(n) * amp * (1 + Math.abs(x - cx) / cx))
    }
    ctx.lineTo(size, H)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = edge
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  const floor = ctx.createLinearGradient(0, H, 0, size)
  floor.addColorStop(0, '#1a0430')
  floor.addColorStop(1, '#05010c')
  ctx.fillStyle = floor
  ctx.fillRect(0, H, size, size - H)
  ctx.save()
  ctx.strokeStyle = grid
  ctx.shadowColor = grid
  ctx.shadowBlur = 10
  ctx.lineWidth = 1.4
  
  // Animated horizontal grid lines rushing towards viewer
  const gridOffset = (time * 8) % 1
  for (let i = 0; i <= 14; i++) {
    const basePos = (i + gridOffset) / 14
    const yy = H + (size - H) * Math.pow(basePos, 2.1)
    if (yy < H || yy > size) continue
    ctx.globalAlpha = 0.35 + 0.65 * basePos
    ctx.beginPath()
    ctx.moveTo(0, yy)
    ctx.lineTo(size, yy)
    ctx.stroke()
  }
  
  ctx.globalAlpha = 0.85
  for (let k = -14; k <= 14; k++) {
    ctx.beginPath()
    ctx.moveTo(cx + k * 6, H)
    ctx.lineTo(cx + k * 62, size)
    ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = 'rgba(255,42,109,0.9)'
  ctx.fillRect(0, H - 1, size, 2)
}
