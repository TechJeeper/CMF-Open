/**
 * Native sync plugin interface for Android app.
 * Provides background sync capabilities for live watchface updates.
 */
import { registerPlugin } from '@capacitor/core'

export interface SyncOptions {
  moonEnabled: boolean
  weatherEnabled: boolean
  weatherCity: string | null
  lastSync: number
}

export interface ConnectionStatus {
  state: 'connected' | 'connecting' | 'scanning' | 'disconnected' | 'error'
  deviceName: string | null
}

export interface CMFSyncPlugin {
  startBackgroundSync(): Promise<{ success: boolean }>
  stopBackgroundSync(): Promise<{ success: boolean }>
  isBackgroundSyncEnabled(): Promise<{ enabled: boolean; running: boolean }>
  
  configureSyncOptions(options: {
    moonEnabled?: boolean
    weatherEnabled?: boolean
    weatherCity?: string
  }): Promise<{ success: boolean }>
  getSyncOptions(): Promise<SyncOptions>
  
  syncNow(): Promise<{ success: boolean }>
  
  sendNotification(options: {
    title: string
    body: string
    icon?: number
  }): Promise<{ success: boolean }>
  
  getConnectionStatus(): Promise<ConnectionStatus>
  connect(): Promise<{ success: boolean }>
  disconnect(): Promise<{ success: boolean }>
  
  getDeviceInfo(): Promise<{
    manufacturer: string
    model: string
    sdkVersion: number
    isAndroid: boolean
    hasBluetoothPermissions: boolean
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
