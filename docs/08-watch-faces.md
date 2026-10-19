# Making watchfaces

The CMF Watch 3 Pro supports two types of custom watchfaces:

## 1. Photo Dials (what this store creates)

A **photo dial** is a 466 × 466 background image plus a few bytes saying where the watch
should draw its built-in digital clock (one of five styles, in a colour you choose).
The wire format is in [02-ble-protocol.md](02-ble-protocol.md) and `web/src/lib/watchface/photo.ts`.

**Limitation:** The background is static. The only moving element is the digital clock overlay.

## 2. Structured Dials (animated, with live data)

For **truly dynamic watchfaces** with rotating analog hands, progress arcs, and live
health data, you need **structured dials** — `.bin` files with a TLV widget tree.

Structured dials can have:
- **Rotating analog hands** (hour/minute/second with smooth sweep)
- **Live heart rate** from the PPG sensor
- **Step counter** updating in real-time  
- **Battery percentage**
- **Progress rings** that fill based on goals

Tools for creating structured dials:
- **[WCMF Studio](https://lexp-hub.github.io/wcmf/)** — Full visual editor
- **[FMC Editor](https://fmc.freethinkel.dev/)** — Browser-based with BLE flashing
- **[fmc_go](https://github.com/freethinkel/fmc_go)** — CLI decompiler/compiler

See [09-structured-dials.md](09-structured-dials.md) for the TLV format.

## 3. Video Watchfaces (Watch 3 Pro only)

The CMF Watch 3 Pro officially supports **video backgrounds** via the Nothing X app:
- Upload any video clip (max 5 seconds)
- Choose which segment to display
- Loops continuously

---

# Photo Dial Format (this store)

A still image sounds limiting, but the background can be *computed*. The store's
watchfaces are small JavaScript modules that paint the background on a canvas when you
install them. So a face can be generative art that's different for every seed. It can
be personalised with your name, colours or coordinates. Or it can be **live**, showing
today's moon phase, sun path or calendar. Reinstalling the face redraws it with fresh
data.

## The format

A face is one ES module with two exports:

```js
// web/public/faces/hello.js
export const face = {
  id: 'hello',                 // a-z, 0-9 and "-"; the filename must be `<id>.js`
  name: 'Hello',
  version: '1.0.0',
  author: 'you',
  description: 'One or two sentences for the gallery card.',
  tags: ['minimal'],
  // Where the watch draws its built-in clock: style 0-4, top-left x/y in screen pixels.
  clock: { style: 0, x: 113, y: 92, color: '#ffffff' },
  // Optional. Shown as a form in the editor; values arrive in env.settings.
  settings: [
    { key: 'accent', label: 'Accent', type: 'color', default: '#ff4f3a' },
    { key: 'seed', label: 'Seed', type: 'number', default: 1 },
  ],
  // Optional. Set it if the face draws today's data; the UI suggests reinstalling.
  live: 'The date you install it',
}

export default function draw(ctx, env) {
  const { size, settings, now, random, noise } = env
  ctx.fillStyle = settings.accent
  ctx.beginPath()
  ctx.arc(size / 2, size * 0.7, 40 + random() * 40, 0, Math.PI * 2)
  ctx.fill()
}
```

`draw` gets an `OffscreenCanvasRenderingContext2D`, already filled black, plus `env`:

| Field | What it is |
| --- | --- |
| `size` | Always 466. Draw in these pixel units. |
| `settings` | The user's values for your `settings`, with defaults filled in. Types: `text`, `number`, `boolean`, `color` (`"#rrggbb"`). |
| `now` | A `Date` for the moment of rendering. Live faces read it. Never call `new Date()` yourself, so previews and tests can pin the time. |
| `random()` | A seeded PRNG in [0, 1). It's seeded from the face id plus `settings.seed`, so the same settings always give the same picture. Use it instead of `Math.random()`. |
| `noise(x, y)` | Smooth 2-D gradient noise in about [-1, 1], from the same seed. Good for terrain, flow fields and textures. |

`draw` can be `async`. The page renders the face, keeps a 270 × 270 thumbnail
(the watch's face picker uses it), converts both to RGB565 and uploads them.

## Designing for the watch

* **Round screen.** Everything outside the 233 px radius circle is cut off. Keep text
  inside about 200 px of the centre, and narrower near the top and bottom.
* **Leave room for the clock.** You can't move or restyle digits after install; the
  watch draws them from `clock`. Reserve a calm area at `clock.x, clock.y`. Style 0 is
  roughly 240 × 100 px, style 1 (stacked hours over minutes) about 110 × 180, and style 4
  (small) about 130 × 45. Where the background is busy, a soft radial pool of the
  background colour behind the clock helps (see `flow.js`). Users can override the
  style, colour and position in the editor.
* **AMOLED and RGB565.** Black pixels are off, so dark faces save battery and look
  deep. Colours are quantised to 5-6-5 bits; the editor's large preview shows the exact
  result. Very subtle gradients may band.
* **Fonts.** Faces render in a worker, where only generic families are dependable:
  `sans-serif`, `serif`, `monospace`.
* **Speed.** Rendering happens on the phone or laptop, not the watch, but keep it under
  about 200 ms so the gallery feels instant. A per-pixel loop over the full 466 × 466
  is fine (see `lava.js`).

## The sandbox

Faces run in a dedicated module worker (`web/src/lib/faces/render.worker.ts`). They have
no DOM, no access to the page or its storage, and can't reach the watch. They only
return pixels. That's what lets the gallery render faces from any catalog safely. Don't
fetch from the network in `draw`. Compute data locally, like `daylight.js` (NOAA solar
equations) and `moon.js` (synodic month), so faces work offline and render the same way
every time.

## The sample faces

| Face | File | Technique |
| --- | --- | --- |
| Daylight | `daylight.js` | Sunrise and sunset from latitude/longitude, a 24 h ring with the daylight arc |
| Moon Phase | `moon.js` | Phase from the synodic month; per-pixel sphere shading with noise maria |
| Year in Bloom | `year-bloom.js` | Phyllotaxis (golden-angle spiral) with one dot per day |
| Month | `month.js` | Calendar layout with locale month names and week-start setting |
| Synthwave | `synthwave.js` | Clipping paths for a striped sun, perspective grid, noise mountains |
| Flow Field | `flow.js` | Particles following a noise vector field |
| Topographic | `topo.js` | Marching squares contour lines over layered noise |
| Terminal | `terminal.js` | Text layout around the clock; scanlines and vignette |
| Bauhaus | `bauhaus.js` | Seeded tile composition with a reserved clock cell |
| Lava Lamp | `lava.js` | Metaballs computed per pixel into `ImageData` |
| Aurora | `aurora.js` | Layered translucent bands with `noise` |
| Matrix Rain | `matrix.js` | Column-based text drawing |
| Radar | `radar.js` | Arcs, gradients, and seeded blips |
| Enso | `zen-enso.js` | Single continuous path with noise wobble |
| Marble | `marble.js` | Full-frame `ImageData` from layered noise |
| Skyline | `skyline.js` | Procedural silhouette and window lights |
| Prism | `prism.js` | Fan of semi-transparent colour wedges |
| Week Ring | `week-ring.js` | Live segment ring from `now.getDay()` |
| Glitch | `glitch.js` | Skip a rectangle so the clock stays readable |
| Warp Stars | `warp-stars.js` | Radial streaks and a centre vignette |

## Testing

```bash
cd web
npm run dev          # Watchfaces > Gallery; edits to public/faces/*.js show on reload
npm test             # loads every face, validates `face`, draws it at three dates
```

`src/lib/faces.test.ts` runs every face against a recording fake canvas on midsummer,
midwinter and a leap day. A face that throws, or passes `NaN` to a canvas call, fails
the build. On the simulator, installing a face shows it on the preview's Clock tab with
the clock overlaid.

## Publishing

1. Put your module at `web/public/faces/<id>.js`.
2. Run `npm run catalog`. It regenerates `public/faces/index.json` (and the apps index)
   from the modules' manifests. `npm run build` fails if either index is stale.
3. Run `npm test`, then open a pull request with a screenshot of the face.

Bump `version` when you change how a face looks.
