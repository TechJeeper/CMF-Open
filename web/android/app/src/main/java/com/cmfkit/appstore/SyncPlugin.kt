package com.cmfkit.appstore

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor plugin for controlling background sync service and native features.
 */
@CapacitorPlugin(name = "CMFSync")
class SyncPlugin : Plugin() {
    
    private var syncReceiver: BroadcastReceiver? = null
    
    override fun load() {
        super.load()
        registerSyncReceiver()
    }
    
    override fun handleOnDestroy() {
        unregisterSyncReceiver()
        super.handleOnDestroy()
    }
    
    @PluginMethod
    fun startBackgroundSync(call: PluginCall) {
        val context = activity.applicationContext
        
        // Save preference
        context.getSharedPreferences("cmf_prefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("background_sync_enabled", true)
            .apply()
        
        WatchSyncService.start(context)
        
        call.resolve(JSObject().put("success", true))
    }
    
    @PluginMethod
    fun stopBackgroundSync(call: PluginCall) {
        val context = activity.applicationContext
        
        // Save preference
        context.getSharedPreferences("cmf_prefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("background_sync_enabled", false)
            .apply()
        
        WatchSyncService.stop(context)
        
        call.resolve(JSObject().put("success", true))
    }
    
    @PluginMethod
    fun isBackgroundSyncEnabled(call: PluginCall) {
        val prefs = activity.applicationContext
            .getSharedPreferences("cmf_prefs", Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("background_sync_enabled", false)
        
        call.resolve(JSObject().put("enabled", enabled))
    }
    
    @PluginMethod
    fun getDeviceInfo(call: PluginCall) {
        val result = JSObject()
        result.put("manufacturer", Build.MANUFACTURER)
        result.put("model", Build.MODEL)
        result.put("sdkVersion", Build.VERSION.SDK_INT)
        result.put("isAndroid", true)
        call.resolve(result)
    }
    
    private fun registerSyncReceiver() {
        syncReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == "com.cmfkit.appstore.SYNC_TRIGGER") {
                    notifyListeners("syncTrigger", JSObject())
                }
            }
        }
        
        val filter = IntentFilter("com.cmfkit.appstore.SYNC_TRIGGER")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(syncReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            activity.registerReceiver(syncReceiver, filter)
        }
    }
    
    private fun unregisterSyncReceiver() {
        syncReceiver?.let {
            activity.unregisterReceiver(it)
        }
        syncReceiver = null
    }
}
