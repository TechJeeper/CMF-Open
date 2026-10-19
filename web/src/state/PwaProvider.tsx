import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { trackEvent } from '@/lib/analytics'
import { isStandalone } from '@/lib/pwa'

type PwaContextValue = {
  canInstall: boolean
  installed: boolean
  install: () => Promise<boolean>
}

const PwaContext = createContext<PwaContextValue | null>(null)

export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onChange = () => setInstalled(isStandalone())
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onChange)
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => {
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', onChange)
      window.removeEventListener('beforeinstallprompt', onPrompt)
    }
  }, [])

  const install = useCallback(async () => {
    if (!prompt) return false
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setPrompt(null)
      setInstalled(true)
      trackEvent('pwa/install')
      return true
    }
    return false
  }, [prompt])

  const value = useMemo(
    () => ({ canInstall: Boolean(prompt) && !installed, installed, install }),
    [prompt, installed, install],
  )

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>
}

export function usePwaInstall() {
  const ctx = useContext(PwaContext)
  if (!ctx) throw new Error('usePwaInstall must be used within PwaProvider')
  return ctx
}
