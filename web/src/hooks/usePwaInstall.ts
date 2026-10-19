import { useCallback, useEffect, useState } from 'react'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Chrome/Edge/Android install prompt; iOS has no `beforeinstallprompt`. */
export function usePwaInstall() {
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
      return true
    }
    return false
  }, [prompt])

  return { canInstall: Boolean(prompt) && !installed, installed, install }
}
