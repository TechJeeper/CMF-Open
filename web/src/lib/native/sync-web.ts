/**
 * Web fallback implementation for CMFSync plugin.
 * Used when running in browser instead of native Android app.
 */
import type { CMFSyncPlugin, SyncOptions, ConnectionStatus } from './sync'

export class CMFSyncWeb implements CMFSyncPlugin {
  async startBackgroundSync(): Promise<{ success: boolean }> {
    console.log('[CMFSync] Background sync not available in browser')
    return { success: false }
  }

  async stopBackgroundSync(): Promise<{ success: boolean }> {
    return { success: true }
  }

  async isBackgroundSyncEnabled(): Promise<{ enabled: boolean; running: boolean }> {
    return { enabled: false, running: false }
  }

  async configureSyncOptions(_options: {
    moonEnabled?: boolean
    weatherEnabled?: boolean
    weatherCity?: string
  }): Promise<{ success: boolean }> {
    return { success: false }
  }

  async getSyncOptions(): Promise<SyncOptions> {
    return {
      moonEnabled: false,
      weatherEnabled: false,
      weatherCity: null,
      lastSync: 0,
    }
  }

  async syncNow(): Promise<{ success: boolean }> {
    console.log('[CMFSync] Native sync not available in browser')
    return { success: false }
  }

  async sendNotification(_options: {
    title: string
    body: string
    icon?: number
  }): Promise<{ success: boolean }> {
    console.log('[CMFSync] Native notifications not available in browser')
    return { success: false }
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return { state: 'disconnected', deviceName: null }
  }

  async connect(): Promise<{ success: boolean }> {
    console.log('[CMFSync] Use Web Bluetooth in browser')
    return { success: false }
  }

  async disconnect(): Promise<{ success: boolean }> {
    return { success: true }
  }

  async getDeviceInfo(): Promise<{
    manufacturer: string
    model: string
    sdkVersion: number
    isAndroid: boolean
    hasBluetoothPermissions: boolean
  }> {
    return {
      manufacturer: 'Browser',
      model: navigator.userAgent,
      sdkVersion: 0,
      isAndroid: false,
      hasBluetoothPermissions: false,
    }
  }

  async addListener(
    _eventName: 'syncTrigger',
    _callback: () => void,
  ): Promise<{ remove: () => void }> {
    return { remove: () => {} }
  }
}
