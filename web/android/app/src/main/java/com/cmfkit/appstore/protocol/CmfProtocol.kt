package com.cmfkit.appstore.protocol

import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.experimental.xor

/**
 * CMF Watch BLE Protocol implementation.
 * Handles frame encoding/decoding, authentication, and command building.
 */
object CmfProtocol {
    
    private const val TAG = "CmfProtocol"
    
    // Opcodes (family << 16 | id)
    object Ops {
        const val TIME_SYNC: Int = 0xFF00_0001.toInt()
        const val WEATHER_SET: Int = 0xFFFF_906B.toInt()
        const val NOTIFICATION: Int = 0xFFFF_9065.toInt()
        const val MUSIC_INFO: Int = 0xFFFF_9067.toInt()
        const val BATTERY: Int = 0x00DE_0000.toInt()
        const val AUTH1_REQ: Int = 0xFFFF_0001.toInt()
        const val AUTH1_RET: Int = 0xFFFF_8001.toInt()
        const val AUTH2_REQ: Int = 0xFFFF_0002.toInt()
        const val AUTH2_RET: Int = 0xFFFF_8002.toInt()
    }
    
    /**
     * Derive the auth key from the watch secret.
     * authkey = SHA256(utf8(secret))[:16]
     */
    fun deriveAuthKey(secret: String): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(secret.toByteArray(Charsets.UTF_8)).copyOf(16)
    }
    
    /**
     * Derive session key from nonces and authkey.
     * SHA256(nonceA || nonceB || authkey)[:16]
     */
    fun deriveSessionKey(nonceA: ByteArray, nonceB: ByteArray, authKey: ByteArray): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        digest.update(nonceA)
        digest.update(nonceB)
        digest.update(authKey)
        return digest.digest().copyOf(16)
    }
    
    /**
     * Sign challenge with authkey.
     * SHA256(challenge || authkey)[:16]
     */
    fun sign(challenge: ByteArray, authKey: ByteArray): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        digest.update(challenge)
        digest.update(authKey)
        return digest.digest().copyOf(16)
    }
    
    /**
     * Encrypt payload with AES-128-CBC.
     */
    fun encrypt(data: ByteArray, key: ByteArray): ByteArray {
        val iv = ByteArray(16) // Zero IV as per protocol
        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        return cipher.doFinal(data)
    }
    
    /**
     * Decrypt payload with AES-128-CBC.
     */
    fun decrypt(data: ByteArray, key: ByteArray): ByteArray {
        val iv = ByteArray(16)
        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        return cipher.doFinal(data)
    }
    
    /**
     * CRC-16/XMODEM
     */
    fun crc16(data: ByteArray): Int {
        var crc = 0
        for (byte in data) {
            crc = crc xor ((byte.toInt() and 0xFF) shl 8)
            repeat(8) {
                crc = if (crc and 0x8000 != 0) {
                    (crc shl 1) xor 0x1021
                } else {
                    crc shl 1
                }
            }
        }
        return crc and 0xFFFF
    }
    
    /**
     * Build a command frame.
     */
    fun buildFrame(opcode: Int, payload: ByteArray, sessionKey: ByteArray? = null, mtu: Int = 185): List<ByteArray> {
        val family = (opcode shr 16) and 0xFFFF
        val id = opcode and 0xFFFF
        
        // Build inner frame: opcode (4) + length (2) + payload
        val inner = ByteBuffer.allocate(6 + payload.size).order(ByteOrder.BIG_ENDIAN)
        inner.putShort(family.toShort())
        inner.putShort(id.toShort())
        inner.putShort(payload.size.toShort())
        inner.put(payload)
        
        val innerData = inner.array()
        
        // Encrypt if we have a session key
        val body = if (sessionKey != null) {
            encrypt(innerData, sessionKey)
        } else {
            innerData
        }
        
        // Build outer frame: header (1) + body + CRC (2)
        val encrypted = sessionKey != null
        val headerByte = if (encrypted) 0x01 else 0x00
        
        val frame = ByteBuffer.allocate(1 + body.size + 2).order(ByteOrder.BIG_ENDIAN)
        frame.put(headerByte.toByte())
        frame.put(body)
        frame.putShort(crc16(body).toShort())
        
        val frameData = frame.array()
        
        // Split into MTU-sized chunks
        val chunks = mutableListOf<ByteArray>()
        var offset = 0
        var seq = 0
        
        while (offset < frameData.size) {
            val remaining = frameData.size - offset
            val chunkSize = minOf(remaining, mtu - 2)
            val isFirst = offset == 0
            val isLast = offset + chunkSize >= frameData.size
            
            val flags = (if (isFirst) 0x01 else 0x00) or (if (isLast) 0x02 else 0x00) or (seq shl 2)
            
            val chunk = ByteBuffer.allocate(2 + chunkSize)
            chunk.put(flags.toByte())
            chunk.put((chunkSize and 0xFF).toByte())
            chunk.put(frameData, offset, chunkSize)
            
            chunks.add(chunk.array())
            offset += chunkSize
            seq++
        }
        
        return chunks
    }
    
    /**
     * Build time sync payload.
     */
    fun buildTimeSync(timestampSec: Int = (System.currentTimeMillis() / 1000).toInt()): ByteArray {
        val offset = java.util.TimeZone.getDefault().rawOffset
        val buf = ByteBuffer.allocate(8).order(ByteOrder.BIG_ENDIAN)
        buf.putInt(timestampSec)
        buf.putInt(offset)
        return buf.array()
    }
    
    /**
     * Build weather payload.
     * City name + temperature + conditions for 7 days.
     */
    fun buildWeather(city: String, tempC: Int = 20, condition: Int = 1): ByteArray {
        val buf = ByteBuffer.allocate(199).order(ByteOrder.LITTLE_ENDIAN)
        
        // 7 days of weather (9 bytes each = 63 bytes)
        repeat(7) {
            buf.put(condition.toByte()) // condition
            buf.put((tempC + 100).toByte()) // current temp
            buf.put((tempC - 3 + 100).toByte()) // low
            buf.put((tempC + 3 + 100).toByte()) // high
            buf.put(ByteArray(5)) // padding
        }
        
        // 24 hours of weather (2 bytes each = 48 bytes)
        repeat(24) {
            buf.put(condition.toByte())
            buf.put((tempC + 100).toByte())
        }
        
        // City name (32 bytes, null-padded)
        val cityBytes = city.toByteArray(Charsets.UTF_8).copyOf(32)
        buf.put(cityBytes)
        
        // Sunrise/sunset times for 7 days (8 bytes each = 56 bytes)
        repeat(7) {
            buf.putInt(6 * 3600) // sunrise 6:00
            buf.putInt(18 * 3600) // sunset 18:00
        }
        
        return buf.array()
    }
    
    /**
     * Build notification payload.
     */
    fun buildNotification(title: String, body: String, icon: Int = 0xFF): ByteArray {
        val titleBytes = title.toByteArray(Charsets.UTF_8).take(20).toByteArray()
        val bodyBytes = body.toByteArray(Charsets.UTF_8).take(128).toByteArray()
        val timestamp = (System.currentTimeMillis() / 1000).toInt()
        
        val buf = ByteBuffer.allocate(7 + titleBytes.size + bodyBytes.size).order(ByteOrder.BIG_ENDIAN)
        buf.put(icon.toByte())
        buf.put(0.toByte()) // padding
        buf.putInt(timestamp)
        buf.put(titleBytes.size.toByte())
        buf.put(titleBytes)
        buf.put(bodyBytes)
        
        return buf.array()
    }
    
    /**
     * Get moon phase emoji and name for current date.
     */
    fun getMoonPhase(): Pair<String, String> {
        val now = System.currentTimeMillis()
        val synodicMonth = 29.53058867 * 24 * 60 * 60 * 1000
        val newMoon2000 = 947182440000L // Jan 6, 2000 18:14 UTC
        
        val daysSinceNew = ((now - newMoon2000) % synodicMonth) / (24 * 60 * 60 * 1000)
        val phase = (daysSinceNew / 29.53 * 8).toInt() % 8
        
        return when (phase) {
            0 -> "🌑" to "New Moon"
            1 -> "🌒" to "Waxing Crescent"
            2 -> "🌓" to "First Quarter"
            3 -> "🌔" to "Waxing Gibbous"
            4 -> "🌕" to "Full Moon"
            5 -> "🌖" to "Waning Gibbous"
            6 -> "🌗" to "Last Quarter"
            7 -> "🌘" to "Waning Crescent"
            else -> "🌑" to "New Moon"
        }
    }
}
