import { Bluetooth, Copy, Cpu, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { webBluetoothAvailable } from '@/lib/transport/webble'
import { useWatch } from '@/state/watch-context'

export function ConnectDialog() {
  const w = useWatch()
  const busy = w.status === 'connecting'
  const ble = webBluetoothAvailable()

  return (
    <Dialog open={w.connectOpen} onOpenChange={(o) => !busy && w.setConnectOpen(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a watch</DialogTitle>
          <DialogDescription>
            Apps run in this browser tab and draw on your watch over Bluetooth. Keep the tab open while an app runs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <button
            disabled={!ble || busy}
            onClick={() => void w.connectBle()}
            className="flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-foreground/30 hover:bg-secondary/50 disabled:pointer-events-none disabled:opacity-50"
          >
            <Bluetooth className="mt-0.5 size-5 shrink-0 text-brand" />
            <span className="flex flex-col gap-1">
              <span className="font-medium">CMF Watch 3 Pro over Bluetooth</span>
              <span className="text-sm text-muted-foreground">
                First disconnect the Nothing X app. Pairing reads the watch's factory secret, so no account is needed.
              </span>
            </span>
          </button>

          <button
            disabled={busy}
            onClick={() => void w.connectSim()}
            className="flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-foreground/30 hover:bg-secondary/50 disabled:opacity-50"
          >
            <Cpu className="mt-0.5 size-5 shrink-0" />
            <span className="flex flex-col gap-1">
              <span className="font-medium">Simulated watch</span>
              <span className="text-sm text-muted-foreground">
                Runs the full encrypted protocol in your browser. Use it to try apps or develop without hardware.
              </span>
            </span>
          </button>

          {!ble && (
            <Alert>
              <TriangleAlert />
              <AlertTitle>Web Bluetooth isn't available here</AlertTitle>
              <AlertDescription>
                Use Chrome or Edge on desktop or Android (Bluefy on iOS), over HTTPS. The simulator works everywhere.
              </AlertDescription>
            </Alert>
          )}
          {w.error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Couldn't connect</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>{w.error}</span>
                {w.wire.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const text = w.wire.map((l) => `${new Date(l.at).toISOString()} ${l.dir} ${l.text}`).join('\n')
                      void navigator.clipboard.writeText(text).then(() => toast.success('Bluetooth log copied'))
                    }}
                  >
                    <Copy /> Copy Bluetooth log
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Pairing and syncing time…
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
