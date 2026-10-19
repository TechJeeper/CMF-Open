const API: [string, string][] = [
  ['watch.status(line1, line2?, { playing? })', 'Music screen. Two 64-byte lines, silent, updates in place.'],
  ['watch.card(title, body?)', 'Notification with a buzz. 20-byte title, 128-byte body.'],
  ['watch.ticker(text, tempC?)', "Weather tile's city name (32 bytes) plus a temperature."],
  ['watch.menu(rows)', 'Contacts list: up to 20 rows of [name, detail] (32 + 25 bytes).'],
  ['watch.buzz()', 'Vibrate once.'],
  ['watch.settings', 'Values from manifest.settings, set by the user.'],
  ['watch.storage.get(k, fallback) / set(k, v)', 'Private JSON storage that persists across runs.'],
  ['watch.log(...args)', 'Writes to the App log panel.'],
  ['watch.exit()', 'Stops the app.'],
]

export function ApiReference() {
  return (
    <dl className="flex flex-col gap-3 text-sm">
      {API.map(([sig, what]) => (
        <div key={sig}>
          <dt className="font-mono text-xs text-foreground">{sig}</dt>
          <dd className="text-muted-foreground">{what}</dd>
        </div>
      ))}
    </dl>
  )
}
