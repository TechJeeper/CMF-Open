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
import androidx.core.app.NotificationCompat
import java.util.Timer
import java.util.TimerTask
import java.util.concurrent.TimeUnit

/**
 * Background service for syncing live watchface data to CMF Watch.
 * Handles periodic updates for moon phases, weather, and other live data.
 */
class WatchSyncService : Service() {
    
    companion object {
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
    }
    
    private var wakeLock: PowerManager.WakeLock? = null
    private var syncTimer: Timer? = null
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())
        startSyncTimer()
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        stopSyncTimer()
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
    
    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CMF App Store")
            .setContentText("Syncing live watchface data")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
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
    
    private fun startSyncTimer() {
        syncTimer?.cancel()
        syncTimer = Timer().apply {
            scheduleAtFixedRate(object : TimerTask() {
                override fun run() {
                    performSync()
                }
            }, 0, SYNC_INTERVAL_MS)
        }
    }
    
    private fun stopSyncTimer() {
        syncTimer?.cancel()
        syncTimer = null
    }
    
    private fun performSync() {
        // This will be called from JavaScript via Capacitor bridge
        // The actual sync logic runs in the WebView
        val intent = Intent("com.cmfkit.appstore.SYNC_TRIGGER")
        sendBroadcast(intent)
    }
}
