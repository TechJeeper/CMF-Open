# 7. The web app store: making and publishing apps

The CMF App Store (`web/`) is a static site, deployable to GitHub Pages. It installs and runs
apps on a CMF Watch 3 Pro straight from the browser over Web Bluetooth. A built-in
simulator covers browsers and machines without Bluetooth. This guide covers everything
needed to write an app, test it, share it as a file, and publish it to a store.

## How it works

The stock firmware can't load third-party code (see [03](03-sideloading-paths.md)), so an
app runs in the browser tab and draws on screens the watch already has:

```
your app (JS module) ──► sandboxed Web Worker ──► store page ──► Web Bluetooth ──► watch
        ▲                                                                          │
        └──────────── button events (media controls, "find phone") ◄───────────────┘
```

| Surface | Firmware screen | Budget | Notes |
|---|---|---|---|
| `watch.status(l1, l2, {playing})` | Music player | 64 B per line | Silent, updates in place. The main "app screen" |
| `watch.card(title, body)` | Notification | 20 B / 128 B | Buzzes the wrist |
| `watch.ticker(text, tempC)` | Weather tile city name | 32 B | Visible on faces with a weather complication |
| `watch.menu(rows)` | Contacts list | 20 rows × (32 B + 25 B) | Scrollable list |
| `watch.buzz()` | Vibration motor | n/a | Uses the AT shell |

Input comes from the watch's music controls, which arrive as `play`, `pause`, `next`,
`prev`, `vol_up` and `vol_down`, plus `find_phone` from the find-my-phone tile.

> **Unconfirmed on hardware:** the protocol code is checked against the community's Watch
> Pro 2 spec and the cmfkit simulator. Which raw byte each media button sends has not been
> confirmed on a Watch 3 Pro. Unknown codes reach your app as `raw:XX`. Press each button
> once and check the **Bluetooth** log tab to see what your watch sends.

## Your first app in five minutes

1. Open the store, go to **Develop**, and press **Run**. The template runs on the simulator.
2. Use the button pad (or the play/next icons on the simulated music screen) to send
   presses. Each press goes through the real encrypted protocol to the simulated watch
   and back.
3. Edit, then press **Run** again. Your draft is saved in the browser.
4. Press **Download .js**. That file is your app.

## App format

An app is **one ES module** with no imports. It exports a `manifest` and a default
handler object:

```js
export const manifest = {
  id: 'hello-wrist',          // unique: 2-40 chars of a-z, 0-9, "-"
  name: 'Hello Wrist',
  version: '0.1.0',           // semver; bump it to ship an update
  description: 'Counts button presses.',
  author: 'you',
  icon: '👋',                 // one emoji
  tickInterval: 1,            // seconds between tick() calls; null = no ticking (min 0.25)
  buttons: { next: 'Count +1', prev: 'Reset' },   // shown to users as the app's controls
  settings: [                 // rendered as a form, delivered as watch.settings
    { key: 'greeting', label: 'Greeting', type: 'text', default: 'Hello wrist' },
  ],
  permissions: ['network'],   // declare if you call fetch()
  tags: ['utility'],
}

let count = 0

export default {
  async start(watch) {
    count = watch.storage.get('count', 0)
    await watch.status(watch.settings.greeting, `${count} presses`)
  },
  async onButton(watch, button) {
    if (button === 'next') count++
    if (button === 'prev') count = 0
    watch.storage.set('count', count)
    await watch.status(watch.settings.greeting, `${count} presses`)
  },
  async tick(watch) {},
  async stop(watch) {},
}
```

### Lifecycle

* `start(watch)` runs once.
* `onButton(watch, button)` runs on every press.
* `tick(watch)` runs every `tickInterval` seconds. A tick is skipped if the previous one
  is still running.
* `stop(watch)` runs when the user stops the app, starts another one, or disconnects. It
  gets 1.5 s before the worker is killed.
* Calls never overlap. Each handler finishes before the next one starts, so you don't need
  locks.
* An exception in a handler is shown in the **App log** and the app keeps running.

### The `watch` object

| Member | Description |
|---|---|
| `status(line1, line2?, { playing? })` | Music screen. `playing` toggles the play/pause icon |
| `card(title, body?)` | Notification, with a buzz. Not deduplicated, so don't call it every tick |
| `ticker(text, tempC?)` | Weather city name plus temperature |
| `menu(rows)` | Rows are `'text'`, `[name, detail]` or `{ name, detail }`. Max 20 |
| `buzz()` | Vibrate once |
| `settings` | Read-only values of `manifest.settings` |
| `storage.get(key, fallback)` / `storage.set(key, value)` | JSON storage private to your app, kept across runs and restarts |
| `log(...args)` | Prints to the App log panel |
| `exit()` | Stops the app |

Every draw call returns a promise that resolves once the watch has the data. `await` it
if ordering matters. `status`, `ticker` and `menu` skip values that haven't changed, so you
can redraw on every tick without flooding Bluetooth.

All text is UTF-8 and cut to the byte budget without splitting characters. Emoji and
accents cost 2–4 bytes each, and the firmware font may not draw every emoji.

### Setting types

`text`, `number`, `textarea` (multi-line, e.g. lists) and `boolean`. Users edit settings on
the app's page. They take effect the next time the app starts.

### Sandbox

Each app runs in its own **module Web Worker**:

* **Available:** `fetch`, `WebSocket`, timers, `crypto`, `Intl`, `TextEncoder`, and other
  standard web APIs.
* **Not available:** the DOM, the page's `localStorage`, the Bluetooth session, the
  pairing key, and other apps.
* **Single file:** apps are loaded from a blob URL, so relative `import`s won't resolve.
  Bundle dependencies into the file (e.g. `esbuild app.js --bundle --format=esm`) or
  import absolute HTTPS URLs from a CDN.
* **Size:** apps over 512 KB are rejected.
* **Network:** a network-using app must list `permissions: ['network']`. The store shows
  it as "uses the internet".

Editor types are in [`web/public/sdk/watch-app.d.ts`](../web/public/sdk/watch-app.d.ts),
which the site serves at `/sdk/watch-app.d.ts`:

```js
/** @type {import('./watch-app').WatchApp} */
export default { ... }
```

### Design tips

* **Treat the music screen as your main view.** Line 1 is the headline, line 2 the
  status. Keep line 1 under ~24 characters so the firmware doesn't scroll it.
* **Show what buttons do.** Fill in `manifest.buttons`; the store shows it next to the
  watch.
* **Save state with `watch.storage`.** Users switch apps and close tabs.
* **Use cards sparingly.** Each one vibrates the wrist and adds to the notification list.
* **Keep the tab open.** Browsers throttle timers in background tabs to about once a
  minute. Choose a `tickInterval` that tolerates that, or tell users to keep the tab in
  front.

## Testing

* **In the browser:** **Develop** runs any code on the simulator. The **Bluetooth** tab
  shows each decoded frame.
* **Automated:** `web/src/lib/session.test.ts` runs every app in `web/public/apps/`
  against the simulated watch and checks its manifest. Copy the `runApp` helper to test
  your own logic:

  ```bash
  cd web && npm test
  ```
* **On a watch:** disconnect the Nothing X app first, then **Connect watch → CMF Watch 3
  Pro over Bluetooth**. The first connection pairs through the factory AT shell and saves
  only the derived key in the browser. **Accept the pairing prompt on the watch** when it
  appears; until you do, the connection waits and eventually fails with
  "no AUTH_WATCH_MAC/AUTH_FAILED reply".

## Sharing and sideloading

A downloaded `.js` file is a complete app. Others can install it from **Sideload** in
three ways:

* drag and drop the file;
* paste any HTTPS URL that serves it with CORS, such as a GitHub raw URL, a gist, or a
  Pages site;
* paste the source into **Develop** and press **Run**.

Sideload validates the manifest in a throwaway sandbox before installing. If the `id` is
already installed, it offers to replace that app.

## Publishing to the official store

The official catalog is `web/public/apps/`. To add an app:

1. Put your module at `web/public/apps/<id>.js`. The filename must match `manifest.id`.
2. Run `cd web && npm run catalog`. It regenerates `public/apps/index.json` from every
   module's manifest. `npm run build` fails if the index is stale.
3. Run `npm test`. Your app is then started against the simulator and pressed with
   play/next/next/prev, so it must not throw.
4. Open a pull request. Reviewers check that the app does what it says, declares network
   use, and doesn't spam cards.

To ship an update, bump `version`. Installed copies show **Update** in the store.

## Hosting your own store

A store is just an `index.json` next to the app files, on any static host with CORS
(GitHub Pages works):

```json
{
  "name": "Jane's watch apps",
  "apps": [
    {
      "id": "metronome",
      "name": "Metronome",
      "version": "1.2.0",
      "author": "Jane",
      "icon": "🥁",
      "description": "Buzzes on the beat.",
      "tags": ["music"],
      "entry": "metronome.js"
    }
  ]
}
```

`entry` is resolved relative to the `index.json` URL. Users add your store with **Store →
Add a store**. The store checks that each module's `manifest.id` matches its catalog entry.
To generate the index, copy `web/scripts/build-catalog.mjs` and point it at your folder.

## Deploying the site

`.github/workflows/pages.yml` builds `web/` and publishes it to GitHub Pages on every push
to `main`. Enable it in **Settings → Pages → Source: GitHub Actions**. The build is fully
static and uses relative paths plus hash routing, so it works under
`https://<user>.github.io/<repo>/`.

Local development:

```bash
cd web
npm install
npm run dev        # http://127.0.0.1:47321
npm test           # protocol vectors + simulator + sample apps
npm run build      # dist/ is the deployable site
```

Web Bluetooth requires HTTPS or `localhost`/`127.0.0.1`, and Chrome or Edge on desktop or
Android (Bluefy on iOS). Firefox and Safari don't support it, but the simulator works in
every browser.

## Beyond host-side apps

Watchfaces (**Watchfaces** page) use the photo-dial upload described in
[03](03-sideloading-paths.md). True on-watch apps need custom firmware
([04](04-custom-firmware.md)). Once a firmware build with an app loader exists, this store's
catalog format can carry those packages too: add a `kind` field and an upload path in
`web/src/lib/session.ts`.
