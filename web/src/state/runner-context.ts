import { createContext, useContext } from 'react'
import type { AppLog } from '@/lib/apps/host'
import type { AppManifest, Button } from '@/lib/apps/manifest'
import type { InstalledApp } from '@/lib/store/installed'

export interface RunnerContextValue {
  running: AppManifest | null
  starting: boolean
  logs: AppLog[]
  /** Starts the app, opening the connect dialog first if no watch is connected. */
  run: (app: InstalledApp, opts?: { simulateIfDisconnected?: boolean }) => Promise<void>
  stop: () => Promise<void>
  /** Press a button: through the simulated watch when simulating, else injected directly. */
  press: (b: Button) => void
  clearLogs: () => void
}

export const RunnerContext = createContext<RunnerContextValue | null>(null)

export function useRunner(): RunnerContextValue {
  const ctx = useContext(RunnerContext)
  if (!ctx) throw new Error('useRunner outside <RunnerProvider>')
  return ctx
}
