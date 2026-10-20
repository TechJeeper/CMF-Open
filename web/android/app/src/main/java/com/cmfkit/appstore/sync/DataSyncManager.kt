package com.cmfkit.appstore.sync

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.cmfkit.appstore.ble.BleManager
import com.cmfkit.appstore.protocol.CmfProtocol
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import org.json.JSONObject
import java.net.URL

/**
 * Manages syncing live data to the CMF Watch.
 * Handles moon phase, weather, and other periodic updates.
 */
class DataSyncManager(
    private val context: Context,
    private val bleManager: BleManager
) {
    companion object {
        private const val TAG = "DataSyncManager"
        private const val PREFS_NAME = "cmf_sync_prefs"
        private const val KEY_AUTH_KEY = "auth_key"
        private const val KEY_LAST_SYNC = "last_sync"
        private const val KEY_MOON_ENABLED = "moon_enabled"
        private const val KEY_WEATHER_ENABLED = "weather_enabled"
        private const val KEY_WEATHER_CITY = "weather_city"
    }
    
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private var sessionKey: ByteArray? = null
    
    /**
     * Store the auth key derived from the watch secret.
     */
    fun setAuthKey(authKey: ByteArray) {
        prefs.edit().putString(KEY_AUTH_KEY, authKey.toHex()).apply()
    }
    
    /**
     * Get the stored auth key.
     */
    fun getAuthKey(): ByteArray? {
        return prefs.getString(KEY_AUTH_KEY, null)?.hexToBytes()
    }
    
    /**
     * Configure sync options.
     */
    fun configure(moonEnabled: Boolean, weatherEnabled: Boolean, weatherCity: String?) {
        prefs.edit()
            .putBoolean(KEY_MOON_ENABLED, moonEnabled)
            .putBoolean(KEY_WEATHER_ENABLED, weatherEnabled)
            .putString(KEY_WEATHER_CITY, weatherCity)
            .apply()
    }
    
    fun isMoonEnabled(): Boolean = prefs.getBoolean(KEY_MOON_ENABLED, true)
    fun isWeatherEnabled(): Boolean = prefs.getBoolean(KEY_WEATHER_ENABLED, false)
    fun getWeatherCity(): String? = prefs.getString(KEY_WEATHER_CITY, null)
    fun getLastSync(): Long = prefs.getLong(KEY_LAST_SYNC, 0)
    
    /**
     * Perform a full sync of all enabled data.
     */
    suspend fun performSync(): Boolean {
        Log.d(TAG, "Starting sync...")
        
        if (!bleManager.isConnected()) {
            Log.d(TAG, "Not connected, attempting to connect...")
            bleManager.scanAndConnect()
            
            // Wait for connection with timeout
            withTimeoutOrNull(30000) {
                while (bleManager.connectionState.value != BleManager.ConnectionState.Connected) {
                    if (bleManager.connectionState.value is BleManager.ConnectionState.Error) {
                        return@withTimeoutOrNull null
                    }
                    delay(100)
                }
            } ?: run {
                Log.e(TAG, "Connection timeout")
                return false
            }
        }
        
        try {
            // Sync time first
            syncTime()
            
            // Sync moon phase if enabled
            if (isMoonEnabled()) {
                syncMoonPhase()
            }
            
            // Sync weather if enabled and city is set
            val city = getWeatherCity()
            if (isWeatherEnabled() && !city.isNullOrEmpty()) {
                syncWeather(city)
            }
            
            prefs.edit().putLong(KEY_LAST_SYNC, System.currentTimeMillis()).apply()
            Log.d(TAG, "Sync complete")
            return true
            
        } catch (e: Exception) {
            Log.e(TAG, "Sync failed", e)
            return false
        }
    }
    
    /**
     * Sync current time to watch.
     */
    private suspend fun syncTime() {
        Log.d(TAG, "Syncing time...")
        val payload = CmfProtocol.buildTimeSync()
        val frames = CmfProtocol.buildFrame(CmfProtocol.Ops.TIME_SYNC, payload, sessionKey)
        for (frame in frames) {
            bleManager.writeCommand(frame)
            delay(20)
        }
    }
    
    /**
     * Sync moon phase as weather city name.
     */
    private suspend fun syncMoonPhase() {
        Log.d(TAG, "Syncing moon phase...")
        val (emoji, name) = CmfProtocol.getMoonPhase()
        val moonCity = "$emoji $name"
        val payload = CmfProtocol.buildWeather(moonCity)
        val frames = CmfProtocol.buildFrame(CmfProtocol.Ops.WEATHER_SET, payload, sessionKey)
        for (frame in frames) {
            bleManager.writeCommand(frame)
            delay(20)
        }
    }
    
    /**
     * Sync weather data for a city.
     */
    private suspend fun syncWeather(city: String) {
        Log.d(TAG, "Syncing weather for $city...")
        
        // Try to fetch real weather data
        val (temp, condition) = try {
            fetchWeather(city)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch weather, using defaults", e)
            20 to 1
        }
        
        val payload = CmfProtocol.buildWeather(city, temp, condition)
        val frames = CmfProtocol.buildFrame(CmfProtocol.Ops.WEATHER_SET, payload, sessionKey)
        for (frame in frames) {
            bleManager.writeCommand(frame)
            delay(20)
        }
    }
    
    /**
     * Fetch weather from Open-Meteo API (free, no API key needed).
     */
    private suspend fun fetchWeather(city: String): Pair<Int, Int> = withContext(Dispatchers.IO) {
        try {
            // First, geocode the city
            val geoUrl = "https://geocoding-api.open-meteo.com/v1/search?name=${city.encodeUrl()}&count=1"
            val geoResponse = URL(geoUrl).readText()
            val geoJson = JSONObject(geoResponse)
            val results = geoJson.optJSONArray("results")
            
            if (results == null || results.length() == 0) {
                return@withContext 20 to 1
            }
            
            val location = results.getJSONObject(0)
            val lat = location.getDouble("latitude")
            val lon = location.getDouble("longitude")
            
            // Fetch weather
            val weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m,weather_code"
            val weatherResponse = URL(weatherUrl).readText()
            val weatherJson = JSONObject(weatherResponse)
            val current = weatherJson.getJSONObject("current")
            
            val temp = current.getDouble("temperature_2m").toInt()
            val weatherCode = current.getInt("weather_code")
            val condition = weatherCodeToCondition(weatherCode)
            
            temp to condition
        } catch (e: Exception) {
            Log.e(TAG, "Weather fetch failed", e)
            20 to 1
        }
    }
    
    /**
     * Map Open-Meteo weather code to CMF condition code.
     */
    private fun weatherCodeToCondition(code: Int): Int {
        return when (code) {
            0 -> 1 // Clear sky -> Sunny
            1, 2, 3 -> 2 // Partly cloudy -> Cloudy
            45, 48 -> 3 // Fog
            51, 53, 55, 56, 57 -> 4 // Drizzle -> Light rain
            61, 63, 65, 66, 67 -> 5 // Rain
            71, 73, 75, 77 -> 6 // Snow
            80, 81, 82 -> 5 // Showers -> Rain
            85, 86 -> 6 // Snow showers -> Snow
            95, 96, 99 -> 7 // Thunderstorm
            else -> 1
        }
    }
    
    /**
     * Send a notification to the watch.
     */
    suspend fun sendNotification(title: String, body: String, icon: Int = 0xFF): Boolean {
        if (!bleManager.isConnected()) return false
        
        val payload = CmfProtocol.buildNotification(title, body, icon)
        val frames = CmfProtocol.buildFrame(CmfProtocol.Ops.NOTIFICATION, payload, sessionKey)
        
        for (frame in frames) {
            if (!bleManager.writeCommand(frame)) return false
            delay(20)
        }
        return true
    }
    
    fun cleanup() {
        scope.cancel()
    }
    
    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
    
    private fun String.hexToBytes(): ByteArray {
        return chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }
    
    private fun String.encodeUrl(): String = java.net.URLEncoder.encode(this, "UTF-8")
}
