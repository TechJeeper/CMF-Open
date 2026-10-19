// Live price on the weather tile, via CoinGecko's public API (no key needed).
export const manifest = {
  id: 'crypto-ticker',
  name: 'Crypto Ticker',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '📈',
  description: 'Shows a coin price on the weather tile and music card, refreshed every minute. Needs internet.',
  tickInterval: 60,
  permissions: ['network'],
  tags: ['finance', 'network'],
  buttons: { next: 'Refresh now' },
  settings: [
    { key: 'coin', label: 'CoinGecko coin id', type: 'text', default: 'bitcoin' },
    { key: 'currency', label: 'Currency', type: 'text', default: 'usd' },
  ],
}

async function refresh(watch) {
  const coin = String(watch.settings.coin || 'bitcoin').toLowerCase()
  const cur = String(watch.settings.currency || 'usd').toLowerCase()
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=${encodeURIComponent(cur)}&include_24hr_change=true`
    const data = await (await fetch(url)).json()
    const price = data?.[coin]?.[cur]
    if (price == null) throw new Error(`unknown coin "${coin}"`)
    const change = data[coin][`${cur}_24h_change`] ?? 0
    const text = `${coin.slice(0, 3).toUpperCase()} ${price.toLocaleString('en-US')} ${cur.toUpperCase()}`
    await watch.ticker(text, Math.round(change))
    await watch.status(text, `24h ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`)
  } catch (e) {
    watch.log('fetch failed:', e.message)
    await watch.status('Price unavailable', e.message)
  }
}

export default {
  start: refresh,
  tick: refresh,
  async onButton(watch, button) {
    if (button === 'next') await refresh(watch)
  },
}
