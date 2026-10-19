import { useState } from 'react'
import { Terminal, Battery, Thermometer, Activity, Vibrate, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWatch } from '@/state/watch-context'
import { cn } from '@/lib/utils'

interface ShellResult {
  command: string
  response: string
  timestamp: number
  error?: boolean
}

export function ShellPanel() {
  const { session, status } = useWatch()
  const connected = status === 'connected'
  const [history, setHistory] = useState<ShellResult[]>([])
  const [command, setCommand] = useState('')
  const [busy, setBusy] = useState(false)

  const addResult = (result: Omit<ShellResult, 'timestamp'>) => {
    setHistory((h) => [...h.slice(-49), { ...result, timestamp: Date.now() }])
  }

  async function runShell(cmd: string) {
    if (!session || busy) return
    setBusy(true)
    try {
      const response = await session.shell(cmd)
      addResult({ command: cmd, response })
    } catch (e) {
      addResult({ command: cmd, response: (e as Error).message, error: true })
    } finally {
      setBusy(false)
    }
  }

  async function runHelper(name: string, fn: () => Promise<string>) {
    if (!session || busy) return
    setBusy(true)
    try {
      const response = await fn()
      addResult({ command: name, response })
    } catch (e) {
      addResult({ command: name, response: (e as Error).message, error: true })
    } finally {
      setBusy(false)
    }
  }

  const helpers = [
    {
      icon: Battery,
      label: 'Battery',
      action: () => runHelper('GETBATLV', async () => {
        const mv = await session!.getBatteryVoltage()
        return `${mv} mV (${(mv / 1000).toFixed(2)} V)`
      }),
    },
    {
      icon: Thermometer,
      label: 'Temperature',
      action: () => runHelper('GETNTCTEMP', async () => {
        const temp = await session!.getNtcTemperature()
        return `${(temp / 100).toFixed(1)}°C`
      }),
    },
    {
      icon: Activity,
      label: 'Accelerometer',
      action: () => runHelper('GETGSENSOR', async () => {
        const { x, y, z } = await session!.getAccelerometer()
        return `X: ${x}, Y: ${y}, Z: ${z}`
      }),
    },
    {
      icon: Vibrate,
      label: 'Vibrate',
      action: () => runHelper('SETMOTOR50', async () => {
        await session!.vibrate(50)
        return 'Motor activated'
      }),
    },
    {
      icon: RefreshCw,
      label: 'Version',
      action: () => runHelper('GETVERSION', async () => {
        return await session!.getFirmwareVersionShell()
      }),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Terminal className="size-5" /> AT Shell
        </h2>
        <p className="text-sm text-muted-foreground">
          Direct access to the watch's factory AT command interface.
        </p>
      </div>

      {!connected && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-400">
          Connect to a watch to use the AT shell.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {helpers.map((h) => (
          <Button
            key={h.label}
            variant="outline"
            size="sm"
            disabled={!connected || busy}
            onClick={h.action}
          >
            {busy ? <Loader2 className="animate-spin" /> : <h.icon className="size-4" />}
            {h.label}
          </Button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (command.trim()) {
            void runShell(command.trim())
            setCommand('')
          }
        }}
      >
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="AT GETSECRET"
          disabled={!connected || busy}
          className="font-mono"
        />
        <Button type="submit" disabled={!connected || busy || !command.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : 'Send'}
        </Button>
      </form>

      <div className="flex max-h-64 flex-col gap-1 overflow-auto rounded-lg border bg-black/30 p-3 font-mono text-xs">
        {history.length === 0 && (
          <span className="text-muted-foreground">Shell output will appear here...</span>
        )}
        {history.map((r, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span className="text-blue-400">&gt; {r.command}</span>
            <span className={cn(r.error ? 'text-red-400' : 'text-emerald-400', 'whitespace-pre-wrap')}>
              {r.response}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Common commands: <code>AT GETSECRET</code>, <code>AT GETVERSION</code>, <code>AT GETBATLV</code>,{' '}
        <code>AT GETGSENSOR</code>, <code>AT GETNTCTEMP</code>, <code>AT SETMOTOR50</code>
      </p>
    </div>
  )
}
