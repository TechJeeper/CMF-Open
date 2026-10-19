#!/usr/bin/env node
// Regenerates public/apps/index.json and public/faces/index.json from the manifests that
// every app (`export const manifest`) and watchface (`export const face`) module exports.
// Usage: npm run catalog            (write)
//        npm run catalog -- --check (exit 1 if an index is stale)
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')
const check = process.argv.includes('--check')

const CATALOGS = [
  {
    dir: 'apps',
    exportName: 'manifest',
    listKey: 'apps',
    title: 'CMF App Store',
    fields: ['id', 'name', 'version', 'author', 'icon', 'description', 'tags'],
    order: ['pomodoro', 'stopwatch', 'checklist', 'navigate', 'teleprompter', 'tally', 'dice', 'crypto-ticker'],
  },
  {
    dir: 'faces',
    exportName: 'face',
    listKey: 'faces',
    title: 'CMF Watchfaces',
    fields: ['id', 'name', 'version', 'author', 'description', 'tags', 'clock', 'settings', 'live'],
    order: ['daylight', 'moon', 'year-bloom', 'synthwave', 'flow', 'terminal'],
  },
]

let stale = false
for (const c of CATALOGS) {
  const dir = path.join(root, c.dir)
  const indexPath = path.join(dir, 'index.json')
  const items = []
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.js'))) {
    const m = (await import(pathToFileURL(path.join(dir, file)).href))[c.exportName]
    if (!m?.id) throw new Error(`${c.dir}/${file}: missing \`export const ${c.exportName}\` with an id`)
    if (items.some((a) => a.id === m.id)) throw new Error(`${c.dir}/${file}: duplicate id "${m.id}"`)
    items.push({ ...Object.fromEntries(c.fields.filter((k) => m[k] !== undefined).map((k) => [k, m[k]])), entry: file })
  }
  const rank = (id) => (c.order.includes(id) ? c.order.indexOf(id) : c.order.length)
  items.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name))
  const json = JSON.stringify({ name: c.title, [c.listKey]: items }, null, 2) + '\n'
  const rel = `public/${c.dir}/index.json`
  if (check) {
    if ((await readFile(indexPath, 'utf8').catch(() => '')) !== json) {
      console.error(`${rel} is out of date: run \`npm run catalog\``)
      stale = true
    } else console.log(`${c.dir} catalog ok (${items.length})`)
  } else {
    await writeFile(indexPath, json)
    console.log(`wrote ${items.length} ${c.listKey} to ${rel}`)
  }
}
if (stale) process.exit(1)
