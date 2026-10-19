// Topographic map: contour lines traced from noise with marching squares.
export const face = {
  id: 'topo',
  name: 'Topographic',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Contour lines of an imaginary landscape with a "you are here" pin. Forest night or paper map, your choice.',
  tags: ['generative', 'nature'],
  clock: { style: 0, x: 113, y: 92, color: '#eafff4' },
  settings: [
    { key: 'seed', label: 'Terrain', type: 'number', default: 12 },
    { key: 'paper', label: 'Paper map style', type: 'boolean', default: false, help: 'Pick a dark clock colour with this' },
    { key: 'label', label: 'Pin label', type: 'text', default: 'You are here' },
  ],
}

// For each corner pattern, which cell edges a contour crosses (0 top, 1 right, 2 bottom, 3 left).
const SEGMENTS = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]], [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []]

export default function draw(ctx, { size, settings, random, noise }) {
  const paper = Boolean(settings.paper)
  const ink = paper ? [120, 78, 40] : [159, 226, 191]
  ctx.fillStyle = paper ? '#efe6d2' : '#0e231c'
  ctx.fillRect(0, 0, size, size)

  const step = 5
  const n = Math.ceil(size / step) + 1
  const field = new Float32Array(n * n)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * step
      const y = j * step
      field[j * n + i] = noise(x * 0.006, y * 0.006) + 0.45 * noise(x * 0.017 + 9, y * 0.017) + 0.15 * noise(x * 0.05, y * 0.05 + 4)
    }
  }
  const v = (i, j) => field[j * n + i]
  ctx.lineCap = 'round'
  for (let li = 0, level = -1.2; level <= 1.2; level += 0.075, li++) {
    const major = li % 5 === 0
    ctx.strokeStyle = `rgba(${ink.join(',')},${major ? 0.9 : 0.45})`
    ctx.lineWidth = major ? 1.6 : 0.8
    ctx.beginPath()
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = v(i, j)
        const b = v(i + 1, j)
        const c = v(i + 1, j + 1)
        const d = v(i, j + 1)
        const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0)
        if (idx === 0 || idx === 15) continue
        const x = i * step
        const y = j * step
        const lerp = (p, q) => (level - p) / (q - p)
        const pt = (edge) =>
          edge === 0 ? [x + step * lerp(a, b), y] : edge === 1 ? [x + step, y + step * lerp(b, c)] : edge === 2 ? [x + step * lerp(d, c), y + step] : [x, y + step * lerp(a, d)]
        for (const [e1, e2] of SEGMENTS[idx]) {
          const [x1, y1] = pt(e1)
          const [x2, y2] = pt(e2)
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
        }
      }
    }
    ctx.stroke()
  }

  // Keep the clock area calm.
  const calm = ctx.createRadialGradient(233, 140, 10, 233, 140, 150)
  const base = paper ? '239,230,210' : '14,35,28'
  calm.addColorStop(0, `rgba(${base},0.8)`)
  calm.addColorStop(1, `rgba(${base},0)`)
  ctx.fillStyle = calm
  ctx.fillRect(0, 0, size, size)

  const px = 200 + random() * 110
  const py = 300 + random() * 50
  ctx.fillStyle = '#ff4f3a'
  ctx.beginPath()
  ctx.arc(px, py - 16, 9, Math.PI, 0)
  ctx.lineTo(px, py)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = paper ? '#efe6d2' : '#0e231c'
  ctx.beginPath()
  ctx.arc(px, py - 16, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = paper ? '#5b3a1c' : '#eafff4'
  ctx.font = '600 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(settings.label ?? '').slice(0, 24), px, py + 16)

  // A small north arrow.
  ctx.strokeStyle = `rgba(${ink.join(',')},0.9)`
  ctx.fillStyle = `rgba(${ink.join(',')},0.9)`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(118, 330)
  ctx.lineTo(118, 300)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(112, 306)
  ctx.lineTo(118, 294)
  ctx.lineTo(124, 306)
  ctx.closePath()
  ctx.fill()
  ctx.font = '700 11px sans-serif'
  ctx.fillText('N', 118, 345)
}
