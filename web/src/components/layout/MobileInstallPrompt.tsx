import { useEffect, useState } from 'react'
import { Download, Share, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { dismissMobilePrompt, isIos, isMobileLayout, mobilePromptDismissed } from '@/lib/pwa'
import { usePwaInstall } from '@/hooks/usePwaInstall'

/** On phones, ask once whether to install the PWA (native prompt on Android, steps on iOS). */
export function MobileInstallPrompt() {
  const { canInstall, installed, install } = usePwaInstall()
  const [open, setOpen] = useState(false)
  const ios = isIos()

  useEffect(() => {
    if (installed || mobilePromptDismissed() || !isMobileLayout()) return

    if (ios) {
      const t = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(t)
    }

    if (canInstall) setOpen(true)
  }, [canInstall, installed, ios])

  const close = (remember: boolean) => {
    if (remember) dismissMobilePrompt()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(true)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="size-5 text-brand" />
            Install on your phone?
          </DialogTitle>
          <DialogDescription>
            {ios
              ? 'Add CMF App Store to your home screen for a full-screen app and easier access when pairing over Bluetooth.'
              : 'Install CMF App Store like an app. It opens full screen and keeps your watch connection handy while you sideload apps and watchfaces.'}
          </DialogDescription>
        </DialogHeader>

        {ios ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Tap <Share className="inline size-3.5 align-text-bottom" />{' '}
              <strong className="font-medium text-foreground">Share</strong> in Safari&apos;s toolbar
            </li>
            <li>
              Choose <strong className="font-medium text-foreground">Add to Home Screen</strong>, then Add
            </li>
            <li>Open CMF App Store from your home screen</li>
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            You&apos;ll get one system confirmation. Web Bluetooth works best from the installed app or Chrome.
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {!ios && canInstall && (
            <Button
              className="w-full"
              onClick={() =>
                void install().then((ok) => {
                  if (ok) {
                    dismissMobilePrompt()
                    toast.success('App installed')
                    setOpen(false)
                  }
                })
              }
            >
              <Download />
              Install app
            </Button>
          )}
          <Button variant={ios || !canInstall ? 'default' : 'outline'} className="w-full" onClick={() => close(true)}>
            {ios ? 'Got it' : 'Not now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
