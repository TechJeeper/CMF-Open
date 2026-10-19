import { Battery, Bluetooth, Cpu, Loader2, LogOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWatch } from '@/state/watch-context'

export function ConnectionButton() {
  const w = useWatch()
  if (w.status === 'connecting') {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="animate-spin" /> Connecting
      </Button>
    )
  }
  if (w.status !== 'connected' || !w.info) {
    return (
      <Button size="sm" onClick={() => w.setConnectOpen(true)}>
        <Bluetooth /> Connect watch
      </Button>
    )
  }
  const Icon = w.mode === 'sim' ? Cpu : Bluetooth
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-56">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <span className="truncate">{w.mode === 'sim' ? 'Simulator' : w.info.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Icon className="size-4" /> {w.info.name}
        </DropdownMenuLabel>
        <div className="flex gap-4 px-2 pb-2 font-mono text-xs text-muted-foreground">
          {w.info.firmware && <span>fw {w.info.firmware}</span>}
          {w.info.battery != null && (
            <span className="flex items-center gap-1">
              <Battery className="size-3.5" /> {w.info.battery}%
            </span>
          )}
        </div>
        <DropdownMenuSeparator />
        {w.mode === 'ble' && (
          <DropdownMenuItem
            onClick={() => {
              w.forgetKey()
              void w.disconnect()
            }}
          >
            <RotateCcw /> Forget pairing key
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => void w.disconnect()}>
          <LogOut /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
