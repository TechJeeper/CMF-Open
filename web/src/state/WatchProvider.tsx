import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Button } from '@/lib/apps/manifest'
import { DisplayStore } from '@/lib/display'
import { OPS, sameOp } from '@/lib/protocol/opcodes'
import { AuthError, Session } from '@/lib/session'
import { BUTTON_CODES, SimWatch, type ButtonName } from '@/lib/transport/sim'
import type { Transport } from '@/lib/transport/types'
import { WebBleTransport } from '@/lib/transport/webble'
import { loadAuthkey, saveAuthkey } from './keys'
import { WatchContext, type ConnectionStatus, type WatchInfo, type WireLog } from './watch-context'

const CODE_TO_BUTTON = new Map<number, Button>(Object.entries(BUTTON_CODES).map(([name, code]) => [code, name as Button]))

export function WatchProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [mode, setMode] = useState<'sim' | 'ble' | null>(null)
  const [info, setInfo] = useState<WatchInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [display, setDisplay] = useState(() => new DisplayStore())
  const [wire, setWire] = useState<WireLog[]>([])
  const [connectOpen, setConnectOpen] = useState(false)
  const transport = useRef<Transport | null>(null)
  const buttonListeners = useRef(new Set<(b: Button | `raw:${string}`) => void>())

  const log = useCallback((dir: WireLog['dir'], text: string) => {
    setWire((w) => [...w.slice(-199), { at: Date.now(), dir, text }])
  }, [])

  const attach = useCallback(
    async (t: Transport, m: 'sim' | 'ble', store: DisplayStore) => {
      setStatus('connecting')
      setError(null)
      try {
        transport.current = t
        t.onDisconnect = () => {
          setStatus('disconnected')
          setSession(null)
          toast.message('Watch disconnected')
        }
        await t.connect()
        const s = new Session(t)
        s.log = log
        s.onMessage((msg) => {
          let b: Button | `raw:${string}` | null = null
          if (sameOp(msg.op, OPS.MUSIC_BUTTON) && msg.payload.length) {
            const code = msg.payload[0]
            b = CODE_TO_BUTTON.get(code) ?? `raw:${code.toString(16).padStart(2, '0')}`
          } else if (sameOp(msg.op, OPS.FIND_PHONE)) b = 'find_phone'
          if (b) {
            log('..', `button ${b}`)
            buttonListeners.current.forEach((fn) => fn(b))
          }
        })
        // Every simulator instance has a fresh secret, so its keys are never worth keeping.
        const stored = m === 'ble' ? loadAuthkey(t.id) : null
        let loggedIn = false
        if (stored) {
          try {
            await s.login(stored)
            loggedIn = true
          } catch (e) {
            log('!!', `stored key rejected (${(e as Error).message}); pairing again`)
          }
        }
        if (!loggedIn) {
          log('..', 'pairing via AT GETSECRET')
          await s.pair(undefined, (key) => m === 'ble' && saveAuthkey(t.id, key))
        }
        const [firmware, battery] = await Promise.all([
          s.firmwareVersion().catch(() => undefined),
          s.battery().then((b) => b.level).catch(() => undefined),
        ])
        setInfo({ name: t.name, firmware, battery })
        setDisplay(store)
        setSession(s)
        setMode(m)
        setStatus('connected')
        setConnectOpen(false)
        toast.success(`Connected to ${t.name}`)
      } catch (e) {
        const msg = e instanceof AuthError ? `Pairing failed: ${e.message}` : (e as Error).message
        if ((e as Error).name !== 'NotFoundError') setError(msg)
        setStatus('disconnected')
        await t.disconnect().catch(() => {})
        transport.current = null
      }
    },
    [log],
  )

  const connectSim = useCallback(async () => {
    const sim = new SimWatch()
    sim.onEvent = (text) => log('..', `sim: ${text}`)
    await attach(sim, 'sim', sim.display)
  }, [attach, log])

  const connectBle = useCallback(async () => {
    let t: WebBleTransport
    try {
      t = await WebBleTransport.request()
    } catch (e) {
      if ((e as Error).name !== 'NotFoundError') setError((e as Error).message)
      return
    }
    await attach(t, 'ble', new DisplayStore())
  }, [attach])

  const disconnect = useCallback(async () => {
    const t = transport.current
    transport.current = null
    if (t) t.onDisconnect = undefined
    await t?.disconnect()
    setSession(null)
    setStatus('disconnected')
    setMode(null)
    setInfo(null)
  }, [])

  const value = useMemo(
    () => ({
      status,
      mode,
      info,
      error,
      session,
      display,
      wire,
      connectSim,
      connectBle,
      disconnect,
      connectOpen,
      setConnectOpen,
      forgetKey: () => transport.current && saveAuthkey(transport.current.id, null),
      pressOnWatch: (b: ButtonName) => {
        const t = transport.current
        if (t instanceof SimWatch) void t.press(b)
      },
      onButton: (fn: (b: Button | `raw:${string}`) => void) => {
        buttonListeners.current.add(fn)
        return () => buttonListeners.current.delete(fn)
      },
    }),
    [status, mode, info, error, session, display, wire, connectSim, connectBle, disconnect, connectOpen],
  )

  return <WatchContext.Provider value={value}>{children}</WatchContext.Provider>
}
