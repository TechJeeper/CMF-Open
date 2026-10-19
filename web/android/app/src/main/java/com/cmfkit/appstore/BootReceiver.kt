package com.cmfkit.appstore

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Receives BOOT_COMPLETED broadcast to restart sync service after device reboot.
 */
class BootReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Check if background sync is enabled in preferences
            val prefs = context.getSharedPreferences("cmf_prefs", Context.MODE_PRIVATE)
            val syncEnabled = prefs.getBoolean("background_sync_enabled", false)
            
            if (syncEnabled) {
                WatchSyncService.start(context)
            }
        }
    }
}
