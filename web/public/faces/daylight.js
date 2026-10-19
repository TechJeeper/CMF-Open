// Today's sun path for your location, computed on-device (no network).
export const face = {
  id: 'daylight',
  name: 'Daylight',
  version: '1.0.0',
  author: 'cmfkit',
  description: "Today's real sun path where you live: sunrise, sunset and hours of daylight, worked out on your device.",
  tags: ['live', 'nature'],
  live: 'Sunrise and sunset for the day you install it',
  clock: { style: 3, x: 108, y: 58, color: '#fff4e0' },
  settings: [
    { key: 'lat', label: 'Latitude', type: 'number', default: 51.5, help: 'Positive is north' },
    { key: 'lon', label: 'Longitude', type: 'number', default: -0.13, help: 'Positive is east' },
    { key: 'h12', label: '12-hour labels', type: 'boolean', default: false },
  ],
}

const rad = (d) => (d * Math.PI) / 180

// NOAA's low-precision solar equations: good to a couple of minutes.
function sunTimes(date, lat, lon) {
  const n = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(date.getFullYear(), 0, 0)) / 864e5)
  const B = (2 * Math.PI * (n - 81)) / 365
  const decl = rad(23.44) * Math.sin(B)
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
  const noon = 720 - 4 * lon - eot - date.getTimezoneOffset()
  const cosW = (Math.sin(rad(-0.833)) - Math.sin(rad(lat)) * Math.sin(decl)) / (Math.cos(rad(lat)) * Math.cos(decl))
  if (cosW >= 1) return { noon, len: 0 }
  if (cosW <= -1) return { noon, len: 1440 }
  const half = ((Math.acos(cosW) * 180) / Math.PI) * 4
  return { noon, rise: noon - half, set: noon + half, len: half * 2 }
}

function fmt(mins, h12) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  if (!h12) return `${String(h).padStart(2, '0')}:${mm}`
  return `${h % 12 || 12}:${mm}${h < 12 ? 'am' : 'pm'}`
}

export default function draw(ctx, { size, settings, now }) {
  const lat = Math.max(-89, Math.min(89, Number(settings.lat) || 0))
  const lon = Number(settings.lon) || 0
  const h12 = Boolean(settings.h12)
  const t = sunTimes(now, lat, lon)
  const cx = size / 2
  const cy = 286
  const R = 116
  // Angle 0 is solar noon at the top of the circle; a full turn is 24 h.
  const at = (mins) => {
    const a = ((mins - t.noon) / 1440) * Math.PI * 2
    return [cx + R * Math.sin(a), cy - R * Math.cos(a)]
  }
  const horizon = t.len >= 1440 ? cy + R + 18 : t.len <= 0 ? cy - R - 18 : cy - R * Math.cos((Math.PI * t.len) / 1440)

  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#071330')
  sky.addColorStop(0.55, '#1f3b73')
  sky.addColorStop(0.85, '#d9735b')
  sky.addColorStop(1, '#ffb36b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, size, horizon)
  const ground = ctx.createLinearGradient(0, horizon, 0, size)
  ground.addColorStop(0, '#2a1630')
  ground.addColorStop(1, '#07040c')
  ctx.fillStyle = ground
  ctx.fillRect(0, horizon, size, size - horizon)

  // The night part of the path, dashed, then the daylight arc on top.
  ctx.setLineDash([3, 7])
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(180,190,255,0.35)'
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  if (t.len > 0) {
    const half = (Math.PI * t.len) / 1440
    ctx.save()
    ctx.shadowColor = '#ffcf6b'
    ctx.shadowBlur = 16
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#ffd27a'
    ctx.beginPath()
    ctx.arc(cx, cy, R, -Math.PI / 2 - half, -Math.PI / 2 + half)
    ctx.stroke()
    ctx.restore()
  }

  // Hour ticks, bigger every six hours.
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.textBaseline = 'middle'
  for (let h = 0; h < 24; h++) {
    const [x, y] = at(h * 60)
    ctx.beginPath()
    ctx.arc(x, y, h % 6 ? 1.6 : 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // The sun at its highest point today.
  const [sx, sy] = at(t.noon)
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 46)
  glow.addColorStop(0, 'rgba(255,230,160,0.95)')
  glow.addColorStop(0.3, 'rgba(255,190,90,0.5)')
  glow.addColorStop(1, 'rgba(255,160,60,0)')
  ctx.fillStyle = glow
  ctx.fillRect(sx - 50, sy - 50, 100, 100)
  ctx.fillStyle = '#fff1c9'
  ctx.beginPath()
  ctx.arc(sx, sy, 11, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,210,150,0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(30, horizon)
  ctx.lineTo(size - 30, horizon)
  ctx.stroke()

  ctx.fillStyle = '#ffe2b8'
  ctx.font = '600 15px sans-serif'
  ctx.textAlign = 'center'
  if (t.rise != null) ctx.fillText(`↑ ${fmt(t.rise, h12)}    ${fmt(t.set, h12)} ↓`, cx, 424)
  ctx.font = '500 13px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  const len = t.len >= 1440 ? 'Midnight sun' : t.len <= 0 ? 'Polar night' : `${Math.floor(t.len / 60)}h ${Math.round(t.len % 60)}m of daylight`
  ctx.fillText(len, cx, 446)
}
