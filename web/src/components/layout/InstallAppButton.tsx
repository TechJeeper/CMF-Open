import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/hooks/usePwaInstall'

export function InstallAppButton() {
  const { canInstall, installed, install } = usePwaInstall()
  if (installed || !canInstall) return null

  return (
    <Button
      variant="outline"
      size="sm"
      className="hidden sm:inline-flex"
      onClick={() =>
        void install().then((ok) => {
          if (ok) toast.success('App installed', { description: 'Open CMF App Store from your home screen or app list.' })
        })
      }
    >
      <Download />
      Install app
    </Button>
  )
}
