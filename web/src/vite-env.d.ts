/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}
