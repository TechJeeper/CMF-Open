/**
 * Web fallback implementation for CMFSync plugin.
 * Used when running in browser instead of native Android app.
 */
import type { CMFSyncPlugin } from './sync'

export class CMFSyncWeb implements CMFSyncPlugin {
  async startBackgroundSync(): Promise<{ success: boolean }> {
    console.log('[CMFSync] Background sync not available in browser')
    return { success: false }
  }

  async stopBackgroundSync(): Promise<{ success: boolean }> {
    return { success: true }
  }

  async isBackgroundSyncEnabled(): Promise<{ enabled: boolean }> {
    return { enabled: false }
  }

  async getDeviceInfo(): Promise<{
    manufacturer: string
    model: string
    sdkVersion: number
    isAndroid: boolean
  }> {
    return {
      manufacturer: 'Browser',
      model: navigator.userAgent,
      sdkVersion: 0,
      isAndroid: false,
    }
  }

  async addListener(
    _eventName: 'syncTrigger',
    _callback: () => void,
  ): Promise<{ remove: () => void }> {
    return { remove: () => {} }
  }
}
