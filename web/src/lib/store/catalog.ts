/** App catalogs ("stores"): any static `index.json` listing app modules. Format in docs/07. */

export interface CatalogEntry {
  id: string
  name: string
  version: string
  description: string
  author?: string
  icon?: string
  tags?: string[]
  entry: string
  /** Absolute URL of the module, resolved against the catalog URL. */
  url: string
  source: string
}

export interface Catalog {
  name: string
  url: string
  apps: CatalogEntry[]
}

export const OFFICIAL_CATALOG = 'apps/index.json'
const SOURCES_KEY = 'cmf.sources.v1'

export function catalogSources(): string[] {
  try {
    const extra = JSON.parse(localStorage.getItem(SOURCES_KEY) ?? '[]') as string[]
    return [OFFICIAL_CATALOG, ...extra.filter((s) => s !== OFFICIAL_CATALOG)]
  } catch {
    return [OFFICIAL_CATALOG]
  }
}

export function saveCatalogSources(sources: string[]) {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources.filter((s) => s !== OFFICIAL_CATALOG)))
}

export async function fetchCatalog(source: string): Promise<Catalog> {
  const base = new URL(source, document.baseURI)
  const res = await fetch(base, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const data = (await res.json()) as { name?: string; apps?: Omit<CatalogEntry, 'url' | 'source'>[] }
  if (!Array.isArray(data.apps)) throw new Error('index.json has no "apps" array')
  return {
    name: data.name ?? base.host,
    url: base.href,
    apps: data.apps
      .filter((a) => a && typeof a.id === 'string' && typeof a.entry === 'string')
      .map((a) => ({ ...a, url: new URL(a.entry, base).href, source: base.href })),
  }
}

export async function fetchModuleSource(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`could not download ${url}: ${res.status}`)
  return res.text()
}
