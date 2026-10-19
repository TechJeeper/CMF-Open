import { createContext, useContext, useEffect, useState } from 'react'
import type { Button } from '@/lib/apps/manifest'
import type { DisplayState, DisplayStore } from '@/lib/display'
import type { Session } from '@/lib/session'
import type { ButtonName } from '@/lib/transport/sim'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'
export type WireLog = { at: number; dir: '->' | '<-' | '!!' | '..'; text: string }

export interface WatchInfo {
  name: string
  firmware?: string
  battery?: number
}

export interface WatchContextValue {
  status: ConnectionStatus
  mode: 'sim' | 'ble' | null
  info: WatchInfo | null
  error: string | null
  /** True while the real watch is showing its pairing prompt. */
  awaitingWatch: boolean
  session: Session | null
  display: DisplayStore
  wire: WireLog[]
  connectSim: () => Promise<void>
  connectBle: () => Promise<void>
  disconnect: () => Promise<void>
  forgetKey: () => void
  /** Simulator only: act as the wearer pressing a button. */
  pressOnWatch: (b: ButtonName) => void
  onButton: (fn: (b: Button | `raw:${string}`) => void) => () => void
  connectOpen: boolean
  setConnectOpen: (open: boolean) => void
}

export const WatchContext = createContext<WatchContextValue | null>(null)

export function useWatch(): WatchContextValue {
  const ctx = useContext(WatchContext)
  if (!ctx) throw new Error('useWatch outside <WatchProvider>')
  return ctx
}

export function useDisplay(): DisplayState {
  const { display } = useWatch()
  const [state, setState] = useState(display.state)
  useEffect(() => {
    setState(display.state)
    return display.subscribe(setState)
  }, [display])
  return state
}
