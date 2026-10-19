// Retro 8-bit pixel art clock.
export const face = {
  id: 'pixel',
  name: 'Pixel Art',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A chunky 8-bit pixel art clock that takes you back to the golden age of gaming.',
  tags: ['retro', 'fun'],
  clock: { style: 0, x: 180, y: 400, color: '#9bbc0f' },
  settings: [
    { key: 'palette', label: 'Palette (Gameboy/NES/CGA/Neon)', type: 'text', default: 'Gameboy' },
  ],
}

const PALETTES = {
  Gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  NES: ['#000000', '#6d6d6d', '#b8b8b8', '#fcfcfc'],
  CGA: ['#000000', '#00aaaa', '#aa00aa', '#ffffff'],
  Neon: ['#0d0221', '#ff00ff', '#00ffff', '#ffff00'],
}

const DIGITS = [
  [0x7c, 0xc6, 0xce, 0xd6, 0xe6, 0xc6, 0x7c], // 0
  [0x30, 0x70, 0x30, 0x30, 0x30, 0x30, 0xfc], // 1
  [0x78, 0xcc, 0x0c, 0x38, 0x60, 0xcc, 0xfc], // 2
  [0x78, 0xcc, 0x0c, 0x38, 0x0c, 0xcc, 0x78], // 3
  [0x1c, 0x3c, 0x6c, 0xcc, 0xfe, 0x0c, 0x1e], // 4
  [0xfc, 0xc0, 0xf8, 0x0c, 0x0c, 0xcc, 0x78], // 5
  [0x38, 0x60, 0xc0, 0xf8, 0xcc, 0xcc, 0x78], // 6
  [0xfc, 0xcc, 0x0c, 0x18, 0x30, 0x30, 0x30], // 7
  [0x78, 0xcc, 0xcc, 0x78, 0xcc, 0xcc, 0x78], // 8
  [0x78, 0xcc, 0xcc, 0x7c, 0x0c, 0x18, 0x70], // 9
]

function drawDigit(ctx, digit, x, y, px, color) {
  const rows = DIGITS[digit]
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 8; col++) {
      if ((rows[row] >> (7 - col)) & 1) {
        ctx.fillStyle = color
        ctx.fillRect(x + col * px, y + row * px, px - 1, px - 1)
      }
    }
  }
}

export default function draw(ctx, { size, settings, now }) {
  const pal = PALETTES[settings.palette] || PALETTES.Gameboy
  const [bg, dark, mid, light] = pal

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const px = 8
  const h = now.getHours()
  const m = now.getMinutes()

  const digits = [Math.floor(h/10), h%10, Math.floor(m/10), m%10]
  const startX = size/2 - (4 * 8 * px + 3 * px * 2) / 2
  const y = size/2 - 3.5 * px

  digits.forEach((d, i) => {
    const x = startX + i * (8 * px + px * 2) + (i >= 2 ? px * 3 : 0)
    drawDigit(ctx, d, x, y, px, light)
  })

  const colonX = startX + 2 * (8 * px + px * 2) - px
  const blink = now.getSeconds() % 2 === 0
  if (blink) {
    ctx.fillStyle = mid
    ctx.fillRect(colonX, y + 2 * px, px, px)
    ctx.fillRect(colonX, y + 4 * px, px, px)
  }

  ctx.fillStyle = dark
  const date = now.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
  ctx.font = `${px * 2}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText(date.toUpperCase(), size/2, y + 10 * px)

  for (let i = 0; i < 12; i++) {
    const bx = 40 + (i % 6) * 66
    const by = i < 6 ? 50 : size - 50
    ctx.fillStyle = i % 3 === 0 ? mid : dark
    ctx.fillRect(bx, by, px * 2, px)
  }
}
