package com.cmfkit.appstore

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.cmfkit.appstore.ble.BleManager
import com.cmfkit.appstore.sync.DataSyncManager
import kotlinx.coroutines.*
import java.util.concurrent.TimeUnit

/**
 * Background service for syncing live watchface data to CMF Watch.
 * Handles periodic updates for moon phases, weather, and other live data.
 */
class WatchSyncService : Service() {
    
    companion object {
        private const val TAG = "WatchSyncService"
        private const val CHANNEL_ID = "cmf_sync_channel"
        private const val NOTIFICATION_ID = 1001
        private const val SYNC_INTERVAL_MS = 15 * 60 * 1000L // 15 minutes
        
        fun start(context: Context) {
            val intent = Intent(context, WatchSyncService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
        
        fun stop(context: Context) {
            context.stopService(Intent(context, WatchSyncService::class.java))
        }
        
        fun isRunning(context: Context): Boolean {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            @Suppress("DEPRECATION")
            return manager.getRunningServices(Int.MAX_VALUE)
                .any { it.service.className == WatchSyncService::class.java.name }
        }
    }
    
    private var wakeLock: PowerManager.WakeLock? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var syncJob: Job? = null
    
    private lateinit var bleManager: BleManager
    private lateinit var syncManager: DataSyncManager
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")
        createNotificationChannel()
        
        bleManager = BleManager(applicationContext)
        syncManager = DataSyncManager(applicationContext, bleManager)
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service started")
        startForeground(NOTIFICATION_ID, createNotification("Starting sync..."))
        acquireWakeLock()
        startSyncLoop()
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        Log.d(TAG, "Service destroyed")
        stopSyncLoop()
        bleManager.disconnect()
        syncManager.cleanup()
        releaseWakeLock()
        super.onDestroy()
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "CMF Watch Sync",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps live watchface data updated"
                setShowBadge(false)
            }
            
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(status: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        
        val lastSync = syncManager.getLastSync()
        val lastSyncText = if (lastSync > 0) {
            val ago = (System.currentTimeMillis() - lastSync) / 60000
            if (ago < 1) "just now" else "${ago}m ago"
        } else {
            "never"
        }
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CMF App Store")
            .setContentText(status)
            .setSubText("Last sync: $lastSyncText")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }
    
    private fun updateNotification(status: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, createNotification(status))
    }
    
    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "CMFAppStore::SyncWakeLock"
        ).apply {
            acquire(TimeUnit.HOURS.toMillis(24))
        }
    }
    
    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }
    
    private fun startSyncLoop() {
        syncJob?.cancel()
        syncJob = scope.launch {
            while (isActive) {
                try {
                    updateNotification("Syncing...")
                    
                    val success = syncManager.performSync()
                    
                    if (success) {
                        val deviceName = bleManager.getDeviceName() ?: "CMF Watch"
                        updateNotification("Connected to $deviceName")
                    } else {
                        updateNotification("Waiting for watch...")
                    }
                    
                } catch (e: Exception) {
                    Log.e(TAG, "Sync error", e)
                    updateNotification("Sync error: ${e.message}")
                }
                
                delay(SYNC_INTERVAL_MS)
            }
        }
    }
    
    private fun stopSyncLoop() {
        syncJob?.cancel()
        syncJob = null
        scope.cancel()
    }
}
