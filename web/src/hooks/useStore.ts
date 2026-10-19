import { useCallback, useEffect, useState } from 'react'
import { catalogSources, fetchCatalog, type Catalog } from '@/lib/store/catalog'
import { listInstalled, subscribeInstalled, type InstalledApp } from '@/lib/store/installed'

export function useInstalled(): Record<string, InstalledApp> {
  const [apps, setApps] = useState(listInstalled)
  useEffect(() => subscribeInstalled(() => setApps(listInstalled())), [])
  return apps
}

export interface CatalogState {
  catalogs: Catalog[]
  errors: { source: string; message: string }[]
  loading: boolean
  reload: () => void
}

export function useCatalogs(): CatalogState {
  const [state, setState] = useState<Omit<CatalogState, 'reload'>>({ catalogs: [], errors: [], loading: true })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let live = true
    setState((s) => ({ ...s, loading: true }))
    const sources = catalogSources()
    void Promise.allSettled(sources.map(fetchCatalog)).then((results) => {
      if (!live) return
      setState({
        loading: false,
        catalogs: results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
        errors: results.flatMap((r, i) =>
          r.status === 'rejected' ? [{ source: sources[i], message: (r.reason as Error).message }] : [],
        ),
      })
    })
    return () => {
      live = false
    }
  }, [nonce])
  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) }
}
