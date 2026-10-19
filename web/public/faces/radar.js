export const face = {
  id: 'radar',
  name: 'Radar',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Cold-war radar scope with a sweeping beam that rotates with the seconds. Blips fade in and out.',
  tags: ['retro', 'generative', 'animated'],
  clock: { style: 1, x: 188, y: 118, color: '#7dffb3' },
  settings: [{ key: 'seed', label: 'Blip layout', type: 'number', default: 7 }],
}

export default function draw(ctx, { size, random, now }) {
  const cx = size / 2
  const cy = size / 2 + 20
  const R = 200
  
  // Sweep rotates with seconds (one full rotation per minute)
  const sweep = ((now.getSeconds() + now.getMilliseconds() / 1000) / 60) * Math.PI * 2
  
  ctx.fillStyle = '#041408'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(80,255,140,0.35)'
  ctx.lineWidth = 1
  for (let r = 40; r <= R; r += 40) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(cx - R, cy)
  ctx.lineTo(cx + R, cy)
  ctx.moveTo(cx, cy - R)
  ctx.lineTo(cx, cy + R)
  ctx.stroke()
  
  // Animated sweep beam
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(sweep - Math.PI / 2)
  
  // Sweep trail (fading arc behind the beam)
  for (let i = 0; i < 8; i++) {
    const trailAngle = -0.12 * (i + 1)
    const alpha = 0.15 - i * 0.018
    ctx.fillStyle = `rgba(80,255,140,${alpha})`
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, R, trailAngle - 0.08, trailAngle + 0.02)
    ctx.closePath()
    ctx.fill()
  }
  
  // Main beam
  const g = ctx.createLinearGradient(0, 0, R, 0)
  g.addColorStop(0, 'rgba(80,255,140,0)')
  g.addColorStop(1, 'rgba(80,255,140,0.5)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, R, -0.08, 0.08)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  
  // Blips that brighten when the sweep passes over them
  for (let i = 0; i < 6; i++) {
    const a = random() * Math.PI * 2
    const d = 40 + random() * (R - 50)
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d
    
    // Calculate angle difference from sweep
    let angleDiff = (sweep - a + Math.PI * 2) % (Math.PI * 2)
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff
    const brightness = Math.max(0.2, 1 - angleDiff / 1.5)
    
    ctx.fillStyle = `rgba(120,255,160,${brightness})`
    ctx.shadowColor = 'rgba(120,255,160,0.8)'
    ctx.shadowBlur = brightness > 0.5 ? 10 : 0
    ctx.beginPath()
    ctx.arc(x, y, 4 + brightness * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}
