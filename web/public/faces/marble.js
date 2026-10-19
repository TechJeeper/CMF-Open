export const face = {
  id: 'marble',
  name: 'Marble',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'Swirled stone texture like Carrara marble. Every seed cuts the block differently.',
  tags: ['generative', 'art'],
  clock: { style: 3, x: 108, y: 58, color: '#1a1a1a' },
  settings: [
    { key: 'seed', label: 'Vein pattern', type: 'number', default: 19 },
    { key: 'light', label: 'Light tone', type: 'color', default: '#f5f3ef' },
    { key: 'dark', label: 'Vein tone', type: 'color', default: '#8a8580' },
  ],
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0)

export default function draw(ctx, { size, settings, noise }) {
  const L = rgb(settings.light || '#f5f3ef')
  const D = rgb(settings.dark || '#8a8580')
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise(x * 0.008, y * 0.008) + 0.4 * noise(x * 0.03, y * 0.03)
      const t = (Math.sin(n * 2.5 + x * 0.02) + 1) / 2
      const i = (y * size + x) * 4
      d[i] = L[0] + (D[0] - L[0]) * t
      d[i + 1] = L[1] + (D[1] - L[1]) * t
      d[i + 2] = L[2] + (D[2] - L[2]) * t
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const pool = ctx.createRadialGradient(233, 130, 10, 233, 130, 140)
  pool.addColorStop(0, 'rgba(245,243,239,0.7)')
  pool.addColorStop(1, 'rgba(245,243,239,0)')
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, size, size)
}
