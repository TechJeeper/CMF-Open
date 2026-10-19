import { useEffect, useState } from 'react'
import { Moon, Cloud, RefreshCw, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { loadSyncConfig, saveSyncConfig, getLastSync, type SyncConfig } from '@/lib/sync/auto-sync'

export function AutoSyncSettings() {
  const [config, setConfig] = useState<SyncConfig>(loadSyncConfig)
  const [lastSync, setLastSync] = useState<number | null>(getLastSync)

  useEffect(() => {
    const interval = setInterval(() => setLastSync(getLastSync()), 60000)
    return () => clearInterval(interval)
  }, [])

  const update = (patch: Partial<SyncConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    saveSyncConfig(next)
  }

  const formatLastSync = () => {
    if (!lastSync) return 'Never'
    const mins = Math.floor((Date.now() - lastSync) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return new Date(lastSync).toLocaleDateString()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <RefreshCw className="size-5" /> Auto-Sync
        </h2>
        <p className="text-sm text-muted-foreground">
          Automatically push fresh data when you connect your watch.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Enable auto-sync</span>
          <span className="text-sm text-muted-foreground">
            Sync data on each connection
          </span>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
        />
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-card/50 p-4">
        <Clock className="size-5 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">Last sync</span>
          <span className="text-xs text-muted-foreground">{formatLastSync()}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Data sources</h3>

        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <Moon className="size-5 text-amber-400" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Moon phase</span>
              <span className="text-xs text-muted-foreground">
                Push current moon phase to weather widget
              </span>
            </div>
          </div>
          <Switch
            checked={config.moonPhase ?? false}
            onCheckedChange={(moonPhase) => update({ moonPhase })}
            disabled={!config.enabled}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="size-5 text-blue-400" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Weather</span>
                <span className="text-xs text-muted-foreground">
                  Fetch current temperature for your city
                </span>
              </div>
            </div>
            <Switch
              checked={!!config.weather?.city}
              onCheckedChange={(on) =>
                update({ weather: on ? { city: config.weather?.city || '' } : undefined })
              }
              disabled={!config.enabled}
            />
          </div>
          {config.weather !== undefined && (
            <Input
              placeholder="City name (e.g., London)"
              value={config.weather.city}
              onChange={(e) => update({ weather: { ...config.weather!, city: e.target.value } })}
              disabled={!config.enabled}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Due to Web Bluetooth limitations, we can't sync in the background.
        Data is pushed each time you connect your watch.
      </p>
    </div>
  )
}
