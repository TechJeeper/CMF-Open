/**
 * Native sync plugin interface for Android app.
 * Provides background sync capabilities for live watchface updates.
 */
import { registerPlugin } from '@capacitor/core'

export interface CMFSyncPlugin {
  startBackgroundSync(): Promise<{ success: boolean }>
  stopBackgroundSync(): Promise<{ success: boolean }>
  isBackgroundSyncEnabled(): Promise<{ enabled: boolean }>
  getDeviceInfo(): Promise<{
    manufacturer: string
    model: string
    sdkVersion: number
    isAndroid: boolean
  }>
  addListener(
    eventName: 'syncTrigger',
    callback: () => void,
  ): Promise<{ remove: () => void }>
}

const CMFSync = registerPlugin<CMFSyncPlugin>('CMFSync', {
  web: () => import('./sync-web').then((m) => new m.CMFSyncWeb()),
})

export default CMFSync
