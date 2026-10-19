// Lava lamp: metaballs melting into each other, shaded per pixel.
export const face = {
  id: 'lava',
  name: 'Lava Lamp',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Warm blobs of wax merging and splitting in a dark lamp. Pick your own wax and glass colours.',
  tags: ['generative', 'retro'],
  clock: { style: 1, x: 70, y: 118, color: '#fff4e8' },
  settings: [
    { key: 'seed', label: 'Blobs', type: 'number', default: 5 },
    { key: 'hot', label: 'Wax (top)', type: 'color', default: '#ffb347' },
    { key: 'cold', label: 'Wax (bottom)', type: 'color', default: '#ff3f6c' },
    { key: 'glass', label: 'Glass', type: 'color', default: '#2a0d3a' },
  ],
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0)

export default function draw(ctx, { size, settings, random, now }) {
  const hot = rgb(settings.hot || '#ffb347')
  const cold = rgb(settings.cold || '#ff3f6c')
  const glass = rgb(settings.glass || '#2a0d3a')
  
  const t = (now.getSeconds() + now.getMilliseconds() / 1000) / 60
  
  // Blobs favour the right half so the clock on the left stays clear.
  // Each blob oscillates vertically with a unique phase
  const balls = Array.from({ length: 8 }, (_, i) => {
    const baseX = 210 + random() * 190
    const baseY = 50 + random() * 360
    const phase = random() * Math.PI * 2
    const speed = 0.5 + random() * 1.5
    const amplitude = 30 + random() * 50
    return {
      x: baseX + Math.sin(t * Math.PI * 2 * speed + phase) * 15,
      y: baseY + Math.sin(t * Math.PI * 2 * speed * 0.7 + phase) * amplitude,
      r: 16 + random() * 30 + Math.sin(t * Math.PI * 4 + phase) * 5,
    }
  })
  balls.push({ x: 233, y: 500, r: 105 }, { x: 260, y: -40, r: 60 })
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    const t = y / size
    const wax = hot.map((v, k) => v + (cold[k] - v) * t)
    const back = glass.map((v) => v * (1 - t * 0.6))
    for (let x = 0; x < size; x++) {
      let f = 0
      for (const b of balls) {
        const dx = x - b.x
        const dy = y - b.y
        f += (b.r * b.r) / (dx * dx + dy * dy + 1)
      }
      const i = (y * size + x) * 4
      let c
      if (f >= 1) {
        // Brighter towards each blob's core, like light through the wax.
        const core = Math.min(1, (f - 1) / 3)
        c = wax.map((v) => Math.min(255, v * (0.85 + core * 0.35)))
      } else {
        const glow = Math.pow(f, 6) * 0.4
        c = back.map((v, k) => v + (wax[k] - v) * glow)
      }
      d[i] = c[0]
      d[i + 1] = c[1]
      d[i + 2] = c[2]
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const sheen = ctx.createLinearGradient(0, 0, size, 0)
  sheen.addColorStop(0.15, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.3, 'rgba(255,255,255,0.07)')
  sheen.addColorStop(0.42, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, size, size)
}
