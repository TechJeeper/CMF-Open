// A green-screen terminal where the watch's own clock is the output of `date`.
export const face = {
  id: 'terminal',
  name: 'Terminal',
  version: '1.0.0',
  author: 'cmfkit',
  description: 'A glowing CRT shell session on your wrist. The real clock appears as the output of the date command.',
  tags: ['retro', 'nerd'],
  live: 'The login date and uptime on the day you install it',
  clock: { style: 4, x: 74, y: 250, color: '#39ff7a' },
  settings: [
    { key: 'user', label: 'User name', type: 'text', default: 'you' },
    { key: 'host', label: 'Host name', type: 'text', default: 'cmf' },
    { key: 'color', label: 'Phosphor colour', type: 'color', default: '#39ff7a', help: 'Set the clock colour to match' },
  ],
}

export default function draw(ctx, { size, settings, now }) {
  const color = String(settings.color || '#39ff7a')
  const user = String(settings.user || 'you').replace(/\s+/g, '').slice(0, 10)
  const host = String(settings.host || 'cmf').replace(/\s+/g, '').slice(0, 8)
  const prompt = `${user}@${host}:~$ `
  const bg = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size * 0.62)
  bg.addColorStop(0, '#07180c')
  bg.addColorStop(1, '#010401')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const up = Math.floor((now - startOfYear) / 864e5)
  const login = now.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
  const lines = [
    [96, `Last login: ${login} on ble0`, 0.55],
    [126, `${prompt}uptime`, 1],
    [150, ` up ${up} days, load 0.01`, 0.75],
    [180, `${prompt}cat /proc/watch`, 1],
    [204, ' ATS3089C · 466x466 AMOLED', 0.75],
    [228, `${prompt}date +%H:%M`, 1],
    [330, prompt, 1],
  ]
  ctx.font = '15px monospace'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  for (const [y, text, alpha] of lines) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.fillText(text, 74, y)
  }
  ctx.globalAlpha = 1
  const w = ctx.measureText(prompt).width
  ctx.fillRect(74 + w + 2, 321, 9, 18)
  ctx.shadowBlur = 0

  // Scanlines and a curved-glass vignette.
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  for (let y = 0; y < size; y += 3) ctx.fillRect(0, y, size, 1)
  const glass = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.52)
  glass.addColorStop(0, 'rgba(0,0,0,0)')
  glass.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = glass
  ctx.fillRect(0, 0, size, size)
}
