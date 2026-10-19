export const TEMPLATE = `// A CMF Watch app is one ES module: a manifest plus handlers.
// Full guide: docs/07-web-app-store.md

export const manifest = {
  id: 'hello-wrist',
  name: 'Hello Wrist',
  version: '0.1.0',
  author: 'you',
  icon: '👋',
  description: 'Counts button presses and celebrates every fifth one.',
  tickInterval: 1, // seconds between tick() calls; null to disable
  buttons: { next: 'Count +1', prev: 'Reset' },
  settings: [{ key: 'greeting', label: 'Greeting', type: 'text', default: 'Hello wrist' }],
}

let count = 0

export default {
  // Called once when the app starts.
  async start(watch) {
    count = watch.storage.get('count', 0)
    await watch.status(watch.settings.greeting, \`\${count} presses\`)
  },

  // button: play | pause | next | prev | vol_up | vol_down | find_phone
  async onButton(watch, button) {
    if (button === 'next') count++
    if (button === 'prev') count = 0
    watch.storage.set('count', count)
    await watch.status(watch.settings.greeting, \`\${count} presses\`)
    if (count && count % 5 === 0) await watch.card('Milestone', \`\${count} presses!\`)
  },

  // Called every tickInterval seconds. status/ticker/menu skip unchanged values.
  async tick(watch) {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    await watch.ticker(\`\${t} - \${count} presses\`)
  },
}
`
