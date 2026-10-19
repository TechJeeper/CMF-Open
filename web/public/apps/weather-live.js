// Real weather on the weather tile, from Open-Meteo (free, no API key).
export const manifest = {
  id: 'weather-live',
  name: 'Live Weather',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🌤️',
  description: 'Current conditions and an hourly forecast for any city, refreshed every 10 minutes. Needs internet.',
  tickInterval: 600,
  permissions: ['network'],
  tags: ['travel', 'network', 'utility'],
  buttons: { next: 'Refresh now', play: 'Show forecast card' },
  settings: [
    { key: 'city', label: 'City', type: 'text', default: 'London' },
    { key: 'fahrenheit', label: 'Fahrenheit', type: 'boolean', default: false },
  ],
}

// WMO weather interpretation codes, condensed.
const CODES = [
  [0, 'Clear'],
  [2, 'Partly cloudy'],
  [3, 'Overcast'],
  [48, 'Fog'],
  [57, 'Drizzle'],
  [67, 'Rain'],
  [77, 'Snow'],
  [82, 'Showers'],
  [86, 'Snow showers'],
  [99, 'Thunderstorm'],
]
const describe = (code) => (CODES.find(([max]) => code <= max) ?? [0, 'Unknown'])[1]

let place, forecast

async function locate(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(name)}`
  const hit = (await (await fetch(url)).json()).results?.[0]
  if (!hit) throw new Error(`can't find "${name}"`)
  return { name: hit.name, lat: hit.latitude, lon: hit.longitude }
}

async function refresh(watch) {
  const f = Boolean(watch.settings.fahrenheit)
  const unit = f ? '°F' : '°C'
  try {
    place = place ?? (await locate(String(watch.settings.city || 'London')))
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&forecast_hours=12&timezone=auto` +
      (f ? '&temperature_unit=fahrenheit' : '')
    const data = await (await fetch(url)).json()
    const now = data.current
    const tempC = f ? ((now.temperature_2m - 32) * 5) / 9 : now.temperature_2m
    forecast = data.hourly.time.map((t, i) => [
      t.slice(11, 16),
      `${Math.round(data.hourly.temperature_2m[i])}${unit} ${describe(data.hourly.weather_code[i])}`,
    ])
    await watch.ticker(place.name, tempC)
    await watch.status(
      `${place.name} ${Math.round(now.temperature_2m)}${unit}`,
      `${describe(now.weather_code)} - wind ${Math.round(now.wind_speed_10m)} km/h`,
    )
    await watch.menu(forecast)
  } catch (e) {
    watch.log('weather failed:', e.message)
    await watch.status('Weather unavailable', e.message, { playing: false })
  }
}

export default {
  start: refresh,
  tick: refresh,
  async onButton(watch, button) {
    if (button === 'next') await refresh(watch)
    else if ((button === 'play' || button === 'pause') && forecast?.length) {
      const pick = [0, 3, 6, 9].map((i) => forecast[i]).filter(Boolean)
      await watch.card(`${place.name} forecast`, pick.map(([t, d]) => `${t} ${d}`).join(', '))
    }
  },
}
