export const face = {
  id: 'warp-stars',
  name: 'Warp Stars',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Hyperspace streaks radiating from the centre — stars zoom past as you travel through space.',
  tags: ['generative', 'space'],
  clock: { style: 0, x: 113, y: 98, color: '#ffffff' },
  settings: [{ key: 'seed', label: 'Star field', type: 'number', default: 21 }],
}

export default function draw(ctx, { size, random, now }) {
  ctx.fillStyle = '#03050a'
  ctx.fillRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  
  const time = (now.getSeconds() + now.getMilliseconds() / 1000) / 60
  
  for (let i = 0; i < 220; i++) {
    const a = random() * Math.PI * 2
    const baseD = random()
    // Stars move outward over time, wrapping around
    const d = ((baseD + time * (0.5 + random() * 1.5)) % 1) * 230
    const len = 8 + d * 0.3 + random() * 20
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d
    
    // Stars get brighter and thicker as they get further out
    const intensity = 0.2 + (d / 230) * 0.8
    ctx.strokeStyle = `rgba(200,220,255,${intensity})`
    ctx.lineWidth = 0.5 + (d / 230) * 2.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    ctx.stroke()
  }
  
  const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130)
  hole.addColorStop(0, 'rgba(3,5,10,0.95)')
  hole.addColorStop(0.7, 'rgba(3,5,10,0.5)')
  hole.addColorStop(1, 'rgba(3,5,10,0)')
  ctx.fillStyle = hole
  ctx.fillRect(0, 0, size, size)
}
