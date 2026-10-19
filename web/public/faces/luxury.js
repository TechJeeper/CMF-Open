// A luxury watch face inspired by classic timepieces.
export const face = {
  id: 'luxury',
  name: 'Luxury Classic',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'An elegant analog watch inspired by classic luxury timepieces. Polished metal and refined details.',
  tags: ['classic', 'elegant'],
  clock: null,
  settings: [
    { key: 'metal', label: 'Metal finish', type: 'select', options: ['Gold', 'Silver', 'Rose Gold'], default: 'Gold' },
  ],
}

const METALS = {
  Gold: { main: '#d4af37', light: '#f4e4bc', dark: '#8b7355', accent: '#1a1a2e' },
  Silver: { main: '#c0c0c0', light: '#e8e8e8', dark: '#707070', accent: '#1a1a2e' },
  'Rose Gold': { main: '#b76e79', light: '#e8c4c4', dark: '#8b6969', accent: '#2e1a1a' },
}

export default function draw(ctx, { size, settings, now }) {
  const metal = METALS[settings.metal] || METALS.Gold
  const cx = size / 2
  const cy = size / 2

  const bg = ctx.createRadialGradient(cx, cy - 50, 0, cx, cy, size * 0.5)
  bg.addColorStop(0, '#faf8f5')
  bg.addColorStop(0.7, '#e8e4dc')
  bg.addColorStop(1, '#d4d0c8')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const bezel = ctx.createLinearGradient(0, 0, size, size)
  bezel.addColorStop(0, metal.light)
  bezel.addColorStop(0.3, metal.main)
  bezel.addColorStop(0.7, metal.dark)
  bezel.addColorStop(1, metal.main)
  ctx.strokeStyle = bezel
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.arc(cx, cy, 220, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = metal.accent
  ctx.font = '600 14px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 1; i <= 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
    const r = 185
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r

    if (i % 3 === 0) {
      ctx.font = '600 22px serif'
      ctx.fillText(i.toString(), x, y)
    } else {
      ctx.fillStyle = metal.main
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = metal.accent
    }
  }

  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue
    const angle = (i / 60) * Math.PI * 2 - Math.PI / 2
    const r1 = 200
    const r2 = 205
    ctx.strokeStyle = metal.dark + '60'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1)
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2)
    ctx.stroke()
  }

  const h = now.getHours() % 12
  const m = now.getMinutes()
  const s = now.getSeconds()

  const hourAngle = ((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2
  const minAngle = ((m + s / 60) / 60) * Math.PI * 2 - Math.PI / 2
  const secAngle = (s / 60) * Math.PI * 2 - Math.PI / 2

  ctx.lineCap = 'round'

  ctx.strokeStyle = metal.accent
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(hourAngle) * 90, cy + Math.sin(hourAngle) * 90)
  ctx.stroke()

  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(minAngle) * 130, cy + Math.sin(minAngle) * 130)
  ctx.stroke()

  ctx.strokeStyle = metal.main
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - Math.cos(secAngle) * 30, cy - Math.sin(secAngle) * 30)
  ctx.lineTo(cx + Math.cos(secAngle) * 150, cy + Math.sin(secAngle) * 150)
  ctx.stroke()

  ctx.fillStyle = metal.main
  ctx.beginPath()
  ctx.arc(cx, cy, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = metal.accent
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = metal.accent
  ctx.font = '500 11px sans-serif'
  const date = now.getDate()
  ctx.fillText(date.toString(), cx + 70, cy + 2)

  ctx.strokeStyle = metal.dark
  ctx.lineWidth = 1
  ctx.strokeRect(cx + 55, cy - 10, 30, 20)
}
