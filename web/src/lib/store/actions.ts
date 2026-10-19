import { inspectApp } from '../apps/host'
import type { AppManifest } from '../apps/manifest'
import { fetchModuleSource, type CatalogEntry } from './catalog'
import { install, type InstallOrigin, type InstalledApp } from './installed'

export interface Inspected {
  manifest: AppManifest
  source: string
  warnings: string[]
}

/** Load a module in a throwaway sandbox and validate its manifest. Throws with all problems. */
export async function inspectSource(source: string): Promise<Inspected> {
  if (source.length > 512 * 1024) throw new Error('apps must be under 512 KB')
  const { manifest, errors } = await inspectApp(source)
  if (!manifest) throw new Error(errors.join('\n'))
  const warnings: string[] = []
  if (/\bfetch\s*\(|WebSocket|XMLHttpRequest/.test(source) && !manifest.permissions?.includes('network')) {
    warnings.push('Uses the network but does not declare permissions: ["network"].')
  }
  if (!/export\s+default/.test(source)) warnings.push('Has no default export, so it will not react to anything.')
  return { manifest, source, warnings }
}

export async function installFromCatalog(entry: CatalogEntry): Promise<InstalledApp> {
  const { manifest, source } = await inspectSource(await fetchModuleSource(entry.url))
  if (manifest.id !== entry.id) throw new Error(`catalog says "${entry.id}" but the module's manifest id is "${manifest.id}"`)
  return save(manifest, source, 'store', entry.url)
}

export function save(manifest: AppManifest, source: string, origin: InstallOrigin, sourceUrl?: string): InstalledApp {
  const app: InstalledApp = { manifest, source, origin, sourceUrl, installedAt: Date.now() }
  install(app)
  return app
}
