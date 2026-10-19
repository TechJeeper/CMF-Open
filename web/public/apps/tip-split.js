// Tip calculator and bill splitter.
export const manifest = {
  id: 'tip-split',
  name: 'Tip & Split',
  version: '1.0.0',
  author: 'cmfkit',
  icon: '🧾',
  description: 'Work out tip and per-person totals from the bill. Volume keys change tip %; next/prev change party size.',
  tickInterval: null,
  tags: ['finance', 'utility'],
  buttons: { vol_up: 'Tip +1%', vol_down: 'Tip -1%', next: 'More people', prev: 'Fewer people', play: 'Show totals card' },
  settings: [
    { key: 'bill', label: 'Bill amount', type: 'number', default: 48 },
    { key: 'tip', label: 'Tip percent', type: 'number', default: 18 },
    { key: 'people', label: 'People', type: 'number', default: 2 },
    { key: 'symbol', label: 'Currency symbol', type: 'text', default: '£' },
  ],
}

function totals(watch) {
  const bill = Math.max(0, Number(watch.settings.bill) || 0)
  const tip = Math.max(0, Number(watch.settings.tip) || 0)
  const people = Math.max(1, Math.min(20, Number(watch.settings.people) || 1))
  const tipAmt = (bill * tip) / 100
  const total = bill + tipAmt
  return { bill, tip, people, tipAmt, total, each: total / people, sym: String(watch.settings.symbol || '£') }
}

const fmt = (n, sym) => `${sym}${n.toFixed(2)}`

async function render(watch) {
  const t = totals(watch)
  await watch.status(fmt(t.each, t.sym), `${t.people} × ${fmt(t.total, t.sym)} (${t.tip}% tip)`, { playing: false })
  await watch.ticker(`${t.tip}% tip ${fmt(t.tipAmt, t.sym)}`)
}

export default {
  start: render,
  async onButton(watch, button) {
    const s = watch.settings
    if (button === 'vol_up') s.tip = Math.min(50, Number(s.tip) + 1)
    else if (button === 'vol_down') s.tip = Math.max(0, Number(s.tip) - 1)
    else if (button === 'next') s.people = Math.min(20, Number(s.people) + 1)
    else if (button === 'prev') s.people = Math.max(1, Number(s.people) - 1)
    else if (button === 'play' || button === 'pause') {
      const t = totals(watch)
      await watch.card('Bill', `${fmt(t.bill, t.sym)} + ${t.tip}% = ${fmt(t.total, t.sym)}`)
    }
    await render(watch)
  },
}
