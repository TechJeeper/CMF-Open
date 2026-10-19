// Tonight's moon, shaded as a sphere from the real phase (no network).
export const face = {
  id: 'moon',
  name: 'Moon Phase',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A starfield with the moon exactly as it looks tonight, plus how lit it is and when the next full moon rises.',
  tags: ['live', 'nature', 'space'],
  live: 'The moon phase on the day you install it',
  clock: { style: 0, x: 113, y: 52, color: '#eef1ff' },
  settings: [
    { key: 'south', label: 'Southern hemisphere view', type: 'boolean', default: false },
    { key: 'tint', label: 'Moon colour', type: 'color', default: '#f3efe3' },
    { key: 'seed', label: 'Star pattern', type: 'number', default: 7 },
  ],
}

const SYNODIC = 29.530588853
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
const NAMES = [
  [0.0339, 'New moon'],
  [0.216, 'Waxing crescent'],
  [0.284, 'First quarter'],
  [0.466, 'Waxing gibbous'],
  [0.534, 'Full moon'],
  [0.716, 'Waning gibbous'],
  [0.784, 'Last quarter'],
  [0.966, 'Waning crescent'],
  [1.01, 'New moon'],
]

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0)

export default function draw(ctx, { size, settings, now, random, noise }) {
  const phase = ((((now.getTime() - NEW_MOON) / 864e5 / SYNODIC) % 1) + 1) % 1
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2

  const bg = ctx.createRadialGradient(size / 2, 300, 40, size / 2, size / 2, size * 0.7)
  bg.addColorStop(0, '#141a33')
  bg.addColorStop(1, '#03040a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 260; i++) {
    const x = random() * size
    const y = random() * size
    const r = random() ** 3 * 1.6 + 0.3
    ctx.fillStyle = `rgba(${random() < 0.15 ? '255,220,190' : '220,230,255'},${0.3 + random() * 0.7})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const cx = size / 2
  const cy = 282
  const R = 98
  const [tr, tg, tb] = hexRgb(settings.tint || '#f3efe3')
  const flip = settings.south ? -1 : 1
  // Sun direction: behind the moon at new, behind the viewer at full, from the right while waxing.
  const sa = 2 * Math.PI * phase
  const sun = [Math.sin(sa) * flip, 0, -Math.cos(sa)]
  const img = ctx.getImageData(cx - R, cy - R, R * 2, R * 2)
  const d = img.data
  for (let py = 0; py < R * 2; py++) {
    for (let px = 0; px < R * 2; px++) {
      const x = (px - R + 0.5) / R
      const y = (py - R + 0.5) / R
      const rr = x * x + y * y
      if (rr > 1) continue
      const z = Math.sqrt(1 - rr)
      const light = Math.max(0, x * sun[0] + y * sun[1] + z * sun[2])
      // Maria (dark seas) at low frequency, craters at high frequency.
      const maria = noise(x * 1.6 + 3, y * 1.6 + 1) < -0.15 ? 0.72 : 1
      const albedo = maria * (0.82 + 0.18 * noise(x * 9, y * 9))
      const b = Math.min(1, Math.pow(light, 0.7) * albedo + 0.045)
      const edge = Math.min(1, (1 - Math.sqrt(rr)) * R)
      const i = (py * R * 2 + px) * 4
      d[i] = d[i] * (1 - edge) + tr * b * edge
      d[i + 1] = d[i + 1] * (1 - edge) + tg * b * edge
      d[i + 2] = d[i + 2] * (1 - edge) + tb * b * edge
    }
  }
  ctx.putImageData(img, cx - R, cy - R)

  if (lit > 0.05) {
    const halo = ctx.createRadialGradient(cx, cy, R, cx, cy, R + 40)
    halo.addColorStop(0, `rgba(${tr},${tg},${tb},${0.18 * lit})`)
    halo.addColorStop(1, `rgba(${tr},${tg},${tb},0)`)
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(cx, cy, R + 40, 0, Math.PI * 2)
    ctx.arc(cx, cy, R, 0, Math.PI * 2, true)
    ctx.fill()
  }

  const name = NAMES.find(([max]) => phase < max)[1]
  const toFull = (((0.5 - phase + 1) % 1) * SYNODIC)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#e8ecff'
  ctx.font = '600 17px sans-serif'
  ctx.fillText(`${name} · ${Math.round(lit * 100)}%`, cx, 412)
  ctx.fillStyle = 'rgba(232,236,255,0.6)'
  ctx.font = '500 12px sans-serif'
  ctx.fillText(toFull < 0.5 || toFull > SYNODIC - 0.5 ? 'Full tonight' : `Full moon in ${Math.round(toFull)} days`, cx, 433)
}
