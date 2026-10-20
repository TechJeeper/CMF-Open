package com.cmfkit.appstore

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import com.cmfkit.appstore.ble.BleManager
import com.cmfkit.appstore.sync.DataSyncManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlinx.coroutines.*

/**
 * Capacitor plugin for controlling background sync service and native features.
 */
@CapacitorPlugin(
    name = "CMFSync",
    permissions = [
        Permission(
            strings = [
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION
            ],
            alias = "bluetooth"
        )
    ]
)
class SyncPlugin : Plugin() {
    
    companion object {
        private const val TAG = "SyncPlugin"
    }
    
    private var syncReceiver: BroadcastReceiver? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    private lateinit var bleManager: BleManager
    private lateinit var syncManager: DataSyncManager
    
    override fun load() {
        super.load()
        bleManager = BleManager(activity.applicationContext)
        syncManager = DataSyncManager(activity.applicationContext, bleManager)
        registerSyncReceiver()
    }
    
    override fun handleOnDestroy() {
        unregisterSyncReceiver()
        scope.cancel()
        super.handleOnDestroy()
    }
    
    @PluginMethod
    fun startBackgroundSync(call: PluginCall) {
        val context = activity.applicationContext
        
        // Check permissions first
        if (!hasBluetoothPermissions()) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback")
            return
        }
        
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
        val running = WatchSyncService.isRunning(activity.applicationContext)
        
        call.resolve(JSObject()
            .put("enabled", enabled)
            .put("running", running))
    }
    
    @PluginMethod
    fun configureSyncOptions(call: PluginCall) {
        val moonEnabled = call.getBoolean("moonEnabled", true) ?: true
        val weatherEnabled = call.getBoolean("weatherEnabled", false) ?: false
        val weatherCity = call.getString("weatherCity")
        
        syncManager.configure(moonEnabled, weatherEnabled, weatherCity)
        
        call.resolve(JSObject().put("success", true))
    }
    
    @PluginMethod
    fun getSyncOptions(call: PluginCall) {
        call.resolve(JSObject()
            .put("moonEnabled", syncManager.isMoonEnabled())
            .put("weatherEnabled", syncManager.isWeatherEnabled())
            .put("weatherCity", syncManager.getWeatherCity())
            .put("lastSync", syncManager.getLastSync()))
    }
    
    @PluginMethod
    fun syncNow(call: PluginCall) {
        if (!hasBluetoothPermissions()) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback")
            return
        }
        
        scope.launch {
            try {
                val success = syncManager.performSync()
                call.resolve(JSObject().put("success", success))
            } catch (e: Exception) {
                call.reject("Sync failed: ${e.message}")
            }
        }
    }
    
    @PluginMethod
    fun sendNotification(call: PluginCall) {
        val title = call.getString("title") ?: ""
        val body = call.getString("body") ?: ""
        val icon = call.getInt("icon", 0xFF) ?: 0xFF
        
        scope.launch {
            try {
                val success = syncManager.sendNotification(title, body, icon)
                call.resolve(JSObject().put("success", success))
            } catch (e: Exception) {
                call.reject("Send failed: ${e.message}")
            }
        }
    }
    
    @PluginMethod
    fun getConnectionStatus(call: PluginCall) {
        val state = when (bleManager.connectionState.value) {
            is BleManager.ConnectionState.Connected -> "connected"
            is BleManager.ConnectionState.Connecting -> "connecting"
            is BleManager.ConnectionState.Scanning -> "scanning"
            is BleManager.ConnectionState.Disconnected -> "disconnected"
            is BleManager.ConnectionState.Error -> "error"
        }
        
        val deviceName = bleManager.getDeviceName()
        
        call.resolve(JSObject()
            .put("state", state)
            .put("deviceName", deviceName))
    }
    
    @PluginMethod
    fun connect(call: PluginCall) {
        if (!hasBluetoothPermissions()) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback")
            return
        }
        
        bleManager.scanAndConnect()
        call.resolve(JSObject().put("success", true))
    }
    
    @PluginMethod
    fun disconnect(call: PluginCall) {
        bleManager.disconnect()
        call.resolve(JSObject().put("success", true))
    }
    
    @PluginMethod
    fun getDeviceInfo(call: PluginCall) {
        val result = JSObject()
        result.put("manufacturer", Build.MANUFACTURER)
        result.put("model", Build.MODEL)
        result.put("sdkVersion", Build.VERSION.SDK_INT)
        result.put("isAndroid", true)
        result.put("hasBluetoothPermissions", hasBluetoothPermissions())
        call.resolve(result)
    }
    
    @PermissionCallback
    private fun permissionCallback(call: PluginCall) {
        if (hasBluetoothPermissions()) {
            // Re-run the original call
            when (call.methodName) {
                "startBackgroundSync" -> startBackgroundSync(call)
                "syncNow" -> syncNow(call)
                "connect" -> connect(call)
                else -> call.resolve(JSObject().put("success", true))
            }
        } else {
            call.reject("Bluetooth permissions denied")
        }
    }
    
    private fun hasBluetoothPermissions(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ActivityCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            ActivityCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        }
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
            try {
                activity.unregisterReceiver(it)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to unregister receiver", e)
            }
        }
        syncReceiver = null
    }
}
