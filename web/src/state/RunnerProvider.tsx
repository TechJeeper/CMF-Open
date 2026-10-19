import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { AppHost, type AppLog } from '@/lib/apps/host'
import type { AppManifest, Button } from '@/lib/apps/manifest'
import { Screen } from '@/lib/apps/screen'
import { loadAppData, loadSettings, saveAppData, type InstalledApp } from '@/lib/store/installed'
import { RunnerContext } from './runner-context'
import { useWatch } from './watch-context'

export function RunnerProvider({ children }: { children: ReactNode }) {
  const watch = useWatch()
  const [running, setRunning] = useState<AppManifest | null>(null)
  const [starting, setStarting] = useState(false)
  const [logs, setLogs] = useState<AppLog[]>([])
  const host = useRef<AppHost | null>(null)
  const pending = useRef<InstalledApp | null>(null)

  const addLog = useCallback((l: AppLog) => setLogs((all) => [...all.slice(-299), l]), [])

  const stop = useCallback(async () => {
    const h = host.current
    host.current = null
    setRunning(null)
    await h?.stop()
  }, [])

  const launch = useCallback(
    async (app: InstalledApp) => {
      if (!watch.session) return
      await stop()
      setStarting(true)
      const m = app.manifest
      const screen = new Screen(watch.session, watch.mode === 'sim' ? null : watch.display)
      const h = new AppHost(m, {
        screen: (c) => screen.apply(c),
        log: addLog,
        storage: (k, v) => saveAppData(m.id, k, v),
        exited: () => {
          if (host.current === h) {
            host.current = null
            setRunning(null)
          }
        },
      })
      host.current = h
      addLog({ at: Date.now(), level: 'info', text: `starting ${m.name} ${m.version}` })
      try {
        await h.start(app.source, loadSettings(m), loadAppData(m.id))
        setRunning(m)
      } catch (e) {
        host.current = null
        toast.error(`${m.name} failed to start`, { description: (e as Error).message })
      } finally {
        setStarting(false)
      }
    },
    [watch.session, watch.mode, watch.display, stop, addLog],
  )

  const run = useCallback(
    async (app: InstalledApp, opts?: { simulateIfDisconnected?: boolean }) => {
      if (watch.status !== 'connected') {
        pending.current = app
        if (opts?.simulateIfDisconnected) await watch.connectSim()
        else watch.setConnectOpen(true)
        return
      }
      await launch(app)
    },
    [watch, launch],
  )

  useEffect(() => {
    if (watch.status === 'connected' && pending.current) {
      const app = pending.current
      pending.current = null
      void launch(app)
    }
    if (watch.status === 'disconnected' && host.current) void stop()
  }, [watch.status, launch, stop])

  useEffect(() => {
    if (!watch.connectOpen && watch.status !== 'connecting' && watch.status !== 'connected') pending.current = null
  }, [watch.connectOpen, watch.status])

  useEffect(() => watch.onButton((b) => host.current?.press(b)), [watch])

  const value = useMemo(
    () => ({
      running,
      starting,
      logs,
      run,
      stop,
      clearLogs: () => setLogs([]),
      press: (b: Button) => {
        if (watch.mode === 'sim') watch.pressOnWatch(b)
        else host.current?.press(b)
      },
    }),
    [running, starting, logs, run, stop, watch],
  )

  return <RunnerContext.Provider value={value}>{children}</RunnerContext.Provider>
}
