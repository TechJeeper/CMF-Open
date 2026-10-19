export const face = {
  id: 'prism',
  name: 'Prism',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Rainbow light rays that slowly rotate and pulse, casting shifting colors through a dark room.',
  tags: ['art', 'generative', 'animated'],
  clock: { style: 0, x: 113, y: 100, color: '#ffffff' },
  settings: [{ key: 'seed', label: 'Ray spread', type: 'number', default: 8 }],
}

const RAINBOW = ['#ff4f4f', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5']

export default function draw(ctx, { size, now }) {
  const time = (now.getSeconds() + now.getMilliseconds() / 1000) / 60
  
  ctx.fillStyle = '#08080c'
  ctx.fillRect(0, 0, size, size)
  const ox = -20
  const oy = -20
  
  // Slowly rotating offset
  const rotationOffset = time * 0.3
  
  for (let i = 0; i < 36; i++) {
    const baseAngle = (i / 36) * 0.9 + 0.1
    // Add rotation and subtle wave
    const wave = Math.sin(time * Math.PI * 4 + i * 0.2) * 0.01
    const a0 = baseAngle + rotationOffset + wave
    const a1 = a0 + 0.025
    
    // Pulsing opacity
    const pulse = 0.5 + Math.sin(time * Math.PI * 2 + i * 0.3) * 0.2
    const alpha = Math.floor(pulse * 255).toString(16).padStart(2, '0')
    
    ctx.fillStyle = RAINBOW[i % RAINBOW.length] + alpha
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.arc(ox, oy, size * 1.2, a0 * Math.PI, a1 * Math.PI)
    ctx.closePath()
    ctx.fill()
  }
  
  const shade = ctx.createRadialGradient(233, 200, 30, 233, 200, 220)
  shade.addColorStop(0, 'rgba(8,8,12,0)')
  shade.addColorStop(0.55, 'rgba(8,8,12,0.35)')
  shade.addColorStop(1, 'rgba(8,8,12,0.92)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, size, size)
}
