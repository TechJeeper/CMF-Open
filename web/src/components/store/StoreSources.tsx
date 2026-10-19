import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { catalogSources, OFFICIAL_CATALOG, saveCatalogSources } from '@/lib/store/catalog'

/** Add third-party catalogs: any HTTPS URL serving an index.json in the store format. */
export function StoreSources({ onChange }: { onChange: () => void }) {
  const [sources, setSources] = useState(catalogSources)
  const [url, setUrl] = useState('')

  const commit = (next: string[]) => {
    saveCatalogSources(next)
    setSources(catalogSources())
    onChange()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Add a store
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>App stores</DialogTitle>
          <DialogDescription>
            Anyone can host a store: an <code>index.json</code> plus app modules on GitHub Pages or any HTTPS host with
            CORS. Only add stores you trust.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {sources.map((s) => (
            <li key={s} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {s === OFFICIAL_CATALOG ? 'Official (this site)' : s}
              </span>
              {s !== OFFICIAL_CATALOG && (
                <Button size="icon" variant="ghost" aria-label={`Remove ${s}`} onClick={() => commit(sources.filter((x) => x !== s))}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const u = url.trim()
            if (!u || sources.includes(u)) return
            commit([...sources, u])
            setUrl('')
          }}
        >
          <Input placeholder="https://you.github.io/my-apps/index.json" value={url} onChange={(e) => setUrl(e.target.value)} type="url" />
          <Button type="submit">Add</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
