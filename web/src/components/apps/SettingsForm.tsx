import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { defaultSettings, type AppManifest, type SettingValues } from '@/lib/apps/manifest'
import { loadSettings, saveSettings } from '@/lib/store/installed'

export function SettingsForm({ manifest, onSaved }: { manifest: AppManifest; onSaved?: () => void }) {
  const [values, setValues] = useState<SettingValues>(() => loadSettings(manifest))
  const specs = manifest.settings ?? []
  if (!specs.length) return <p className="text-sm text-muted-foreground">This app has no settings.</p>

  const set = (k: string, v: string | number | boolean) => setValues((s) => ({ ...s, [k]: v }))

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        saveSettings(manifest.id, values)
        toast.success('Settings saved', { description: 'They apply the next time the app starts.' })
        onSaved?.()
      }}
    >
      {specs.map((s) => {
        const id = `setting-${s.key}`
        const v = values[s.key]
        return (
          <div key={s.key} className="flex flex-col gap-1.5">
            {s.type === 'boolean' ? (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={id}>{s.label}</Label>
                <Switch id={id} checked={Boolean(v)} onCheckedChange={(c) => set(s.key, c)} />
              </div>
            ) : (
              <>
                <Label htmlFor={id}>{s.label}</Label>
                {s.type === 'textarea' ? (
                  <Textarea id={id} rows={5} value={String(v ?? '')} onChange={(e) => set(s.key, e.target.value)} />
                ) : (
                  <Input
                    id={id}
                    type={s.type === 'number' ? 'number' : 'text'}
                    value={String(v ?? '')}
                    onChange={(e) => set(s.key, s.type === 'number' ? Number(e.target.value) : e.target.value)}
                  />
                )}
              </>
            )}
            {s.help && <p className="text-xs text-muted-foreground">{s.help}</p>}
          </div>
        )
      })}
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save settings
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setValues(defaultSettings(manifest))}>
          Reset to defaults
        </Button>
      </div>
    </form>
  )
}
