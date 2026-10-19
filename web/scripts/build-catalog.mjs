#!/usr/bin/env node
// Regenerates public/apps/index.json from the `manifest` export of every app module.
// Usage: npm run catalog            (write)
//        npm run catalog -- --check (exit 1 if index.json is stale)
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/apps')
const indexPath = path.join(dir, 'index.json')
const FIELDS = ['id', 'name', 'version', 'author', 'icon', 'description', 'tags']
const ORDER = ['pomodoro', 'stopwatch', 'checklist', 'navigate', 'teleprompter', 'tally', 'dice', 'crypto-ticker']

const files = (await readdir(dir)).filter((f) => f.endsWith('.js'))
const apps = []
for (const file of files) {
  const { manifest } = await import(pathToFileURL(path.join(dir, file)).href)
  if (!manifest?.id) throw new Error(`${file}: missing \`export const manifest\` with an id`)
  if (apps.some((a) => a.id === manifest.id)) throw new Error(`${file}: duplicate app id "${manifest.id}"`)
  const entry = Object.fromEntries(FIELDS.filter((k) => manifest[k] !== undefined).map((k) => [k, manifest[k]]))
  apps.push({ ...entry, entry: file })
}
const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length)
apps.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name))

const json = JSON.stringify({ name: 'CMF App Store', apps }, null, 2) + '\n'
if (process.argv.includes('--check')) {
  const current = await readFile(indexPath, 'utf8').catch(() => '')
  if (current !== json) {
    console.error('public/apps/index.json is out of date: run `npm run catalog`')
    process.exit(1)
  }
  console.log(`catalog ok (${apps.length} apps)`)
} else {
  await writeFile(indexPath, json)
  console.log(`wrote ${apps.length} apps to public/apps/index.json`)
}
