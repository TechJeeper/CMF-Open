package com.cmfkit.appstore.ble

import android.annotation.SuppressLint
import android.bluetooth.*
import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.*

/**
 * BLE Manager for CMF Watch communication.
 * Handles scanning, connecting, and data transfer.
 */
@SuppressLint("MissingPermission")
class BleManager(private val context: Context) {
    
    companion object {
        private const val TAG = "BleManager"
        
        // CMF Watch BLE Service UUIDs
        val SERVICE_COMMAND = UUID.fromString("0000fff0-0000-1000-8000-00805f9b34fb")
        val SERVICE_DATA = UUID.fromString("02f00000-0000-0000-0000-00000000ffe0")
        
        // Characteristic UUIDs
        val CHAR_COMMAND_WRITE = UUID.fromString("0000fff2-0000-1000-8000-00805f9b34fb")
        val CHAR_COMMAND_NOTIFY = UUID.fromString("0000fff1-0000-1000-8000-00805f9b34fb")
        val CHAR_DATA_WRITE = UUID.fromString("02f00000-0000-0000-0000-00000000ffe1")
        val CHAR_DATA_NOTIFY = UUID.fromString("02f00000-0000-0000-0000-00000000ffe2")
        
        // Client Characteristic Configuration Descriptor
        val CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        
        const val NAME_PREFIX = "CMF Watch"
    }
    
    sealed class ConnectionState {
        object Disconnected : ConnectionState()
        object Scanning : ConnectionState()
        object Connecting : ConnectionState()
        object Connected : ConnectionState()
        data class Error(val message: String) : ConnectionState()
    }
    
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState
    
    private val _connectedDevice = MutableStateFlow<BluetoothDevice?>(null)
    val connectedDevice: StateFlow<BluetoothDevice?> = _connectedDevice
    
    private var bluetoothGatt: BluetoothGatt? = null
    private var commandWriteChar: BluetoothGattCharacteristic? = null
    private var dataWriteChar: BluetoothGattCharacteristic? = null
    
    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        manager.adapter
    }
    
    private var notifyCallback: ((ByteArray) -> Unit)? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    Log.d(TAG, "Connected to ${gatt.device.name}")
                    _connectedDevice.value = gatt.device
                    gatt.discoverServices()
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d(TAG, "Disconnected")
                    _connectionState.value = ConnectionState.Disconnected
                    _connectedDevice.value = null
                    cleanup()
                }
            }
        }
        
        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                Log.d(TAG, "Services discovered")
                setupCharacteristics(gatt)
            } else {
                _connectionState.value = ConnectionState.Error("Service discovery failed")
            }
        }
        
        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            Log.d(TAG, "Received ${value.size} bytes from ${characteristic.uuid}")
            notifyCallback?.invoke(value)
        }
        
        @Deprecated("Deprecated in API 33")
        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic
        ) {
            characteristic.value?.let { value ->
                Log.d(TAG, "Received ${value.size} bytes from ${characteristic.uuid}")
                notifyCallback?.invoke(value)
            }
        }
    }
    
    private fun setupCharacteristics(gatt: BluetoothGatt) {
        val commandService = gatt.getService(SERVICE_COMMAND)
        val dataService = gatt.getService(SERVICE_DATA)
        
        if (commandService == null) {
            _connectionState.value = ConnectionState.Error("CMF command service not found")
            return
        }
        
        commandWriteChar = commandService.getCharacteristic(CHAR_COMMAND_WRITE)
        dataWriteChar = dataService?.getCharacteristic(CHAR_DATA_WRITE)
        
        // Enable notifications on command channel
        val notifyChar = commandService.getCharacteristic(CHAR_COMMAND_NOTIFY)
        if (notifyChar != null) {
            gatt.setCharacteristicNotification(notifyChar, true)
            val descriptor = notifyChar.getDescriptor(CCCD)
            descriptor?.let {
                it.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                gatt.writeDescriptor(it)
            }
        }
        
        // Enable notifications on data channel
        dataService?.getCharacteristic(CHAR_DATA_NOTIFY)?.let { dataNotifyChar ->
            gatt.setCharacteristicNotification(dataNotifyChar, true)
            dataNotifyChar.getDescriptor(CCCD)?.let {
                it.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                gatt.writeDescriptor(it)
            }
        }
        
        _connectionState.value = ConnectionState.Connected
        Log.d(TAG, "Characteristics setup complete")
    }
    
    fun scanAndConnect() {
        val adapter = bluetoothAdapter ?: run {
            _connectionState.value = ConnectionState.Error("Bluetooth not available")
            return
        }
        
        if (!adapter.isEnabled) {
            _connectionState.value = ConnectionState.Error("Bluetooth is disabled")
            return
        }
        
        _connectionState.value = ConnectionState.Scanning
        
        // Check bonded devices first
        val bondedWatch = adapter.bondedDevices.find { it.name?.startsWith(NAME_PREFIX) == true }
        if (bondedWatch != null) {
            connect(bondedWatch)
            return
        }
        
        // Start scanning
        val scanner = adapter.bluetoothLeScanner
        val scanCallback = object : android.bluetooth.le.ScanCallback() {
            override fun onScanResult(callbackType: Int, result: android.bluetooth.le.ScanResult) {
                val device = result.device
                if (device.name?.startsWith(NAME_PREFIX) == true) {
                    scanner.stopScan(this)
                    connect(device)
                }
            }
            
            override fun onScanFailed(errorCode: Int) {
                _connectionState.value = ConnectionState.Error("Scan failed: $errorCode")
            }
        }
        
        val scanFilters = listOf(
            android.bluetooth.le.ScanFilter.Builder()
                .setDeviceName(null) // We'll filter by name prefix in callback
                .build()
        )
        val scanSettings = android.bluetooth.le.ScanSettings.Builder()
            .setScanMode(android.bluetooth.le.ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()
        
        scanner.startScan(scanFilters, scanSettings, scanCallback)
        
        // Stop scan after 30 seconds
        scope.launch {
            delay(30000)
            if (_connectionState.value == ConnectionState.Scanning) {
                scanner.stopScan(scanCallback)
                _connectionState.value = ConnectionState.Error("No CMF Watch found")
            }
        }
    }
    
    private fun connect(device: BluetoothDevice) {
        _connectionState.value = ConnectionState.Connecting
        Log.d(TAG, "Connecting to ${device.name}")
        bluetoothGatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }
    
    fun disconnect() {
        bluetoothGatt?.disconnect()
        cleanup()
    }
    
    private fun cleanup() {
        bluetoothGatt?.close()
        bluetoothGatt = null
        commandWriteChar = null
        dataWriteChar = null
    }
    
    fun setNotifyCallback(callback: (ByteArray) -> Unit) {
        notifyCallback = callback
    }
    
    suspend fun writeCommand(data: ByteArray): Boolean {
        val char = commandWriteChar ?: return false
        val gatt = bluetoothGatt ?: return false
        
        return withContext(Dispatchers.IO) {
            try {
                char.value = data
                char.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                gatt.writeCharacteristic(char)
                true
            } catch (e: Exception) {
                Log.e(TAG, "Write failed", e)
                false
            }
        }
    }
    
    suspend fun writeData(data: ByteArray): Boolean {
        val char = dataWriteChar ?: return false
        val gatt = bluetoothGatt ?: return false
        
        return withContext(Dispatchers.IO) {
            try {
                char.value = data
                char.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                gatt.writeCharacteristic(char)
                true
            } catch (e: Exception) {
                Log.e(TAG, "Write failed", e)
                false
            }
        }
    }
    
    fun isConnected(): Boolean = _connectionState.value == ConnectionState.Connected
    
    fun getDeviceName(): String? = _connectedDevice.value?.name
}
