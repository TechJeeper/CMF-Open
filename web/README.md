# CMF App Store (web)

A static web app that installs and runs apps on a CMF Watch 3 Pro over Web Bluetooth. It
also builds photo watchfaces. A built-in simulated watch makes it usable without hardware.
It deploys to GitHub Pages.

```bash
npm install
npm run dev        # http://127.0.0.1:47321
npm test           # protocol vectors vs. Python cmfkit, simulator session, every sample app
npm run build      # static site in dist/
npm run catalog    # regenerate public/apps/index.json after adding an app
```

The developer guide (app format, `watch` API, publishing, hosting your own store) is
[`docs/07-web-app-store.md`](../docs/07-web-app-store.md).

## Layout

```
public/apps/          sample apps (one ES module each) + generated index.json
public/sdk/           watch-app.d.ts editor types for app authors
scripts/              build-catalog.mjs, gen_vectors.py (cross-language test vectors)
src/lib/protocol/     TypeScript port of cmfkit's frame codec, crypto, opcodes, payloads
src/lib/transport/    Web Bluetooth transport and the in-browser simulated watch
src/lib/session.ts    pairing, login, commands, watchface upload
src/lib/apps/         manifest validation, sandbox worker, host, Screen surface mapping
src/lib/store/        catalogs, installed apps, settings and per-app storage
src/lib/watchface/    LZ4 block codec, RGB565 photo-dial container
src/state/            React providers for the watch connection and the running app
src/pages/            Store, My apps, App detail/runner, Sideload, Watchfaces, Develop
```
