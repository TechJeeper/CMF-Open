# CMF App Store - Android App

Native Android companion app for CMF Watch 3 Pro and Watch Pro 2. Provides background sync capabilities and native BLE performance that the web app can't achieve.

## Features

### Background Sync
- **Moon Phase Updates**: Automatically sync current moon phase to the watch's weather widget
- **Weather Updates**: Fetch real weather data and push to watch (uses Open-Meteo API, no API key needed)
- **Time Sync**: Keep watch time synchronized
- **Boot Persistence**: Sync service restarts automatically after device reboot

### Native BLE
- Direct Bluetooth Low Energy connection without browser limitations
- Background operation even when app is closed
- Automatic reconnection when watch is in range

### Multi-Watch Support
- CMF Watch 3 Pro
- CMF Watch Pro 2
- Same BLE protocol for both models

## Requirements

- Android Studio Hedgehog or newer
- Android SDK 24+ (Android 7.0 Nougat)
- JDK 17+
- CMF Watch 3 Pro or Watch Pro 2

## Building

### Open in Android Studio

1. Open Android Studio
2. File → Open → Navigate to `web/android` folder
3. Let Gradle sync complete (may take a few minutes first time)
4. Connect your Android device via USB (enable USB debugging)
5. Click Run (▶) or press Shift+F10

### Command Line Build

```bash
# From the web directory
cd web

# Build web assets first
npm run build

# Sync to Android
npx cap sync android

# Build APK
cd android
./gradlew assembleDebug

# APK location
# app/build/outputs/apk/debug/app-debug.apk
```

### Release Build

```bash
cd android
./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release-unsigned.apk
```

For Play Store, you'll need to sign the APK with a keystore.

## Architecture

```
android/app/src/main/java/com/cmfkit/appstore/
├── MainActivity.kt          # Main Capacitor activity
├── SyncPlugin.kt            # Capacitor plugin - JS bridge
├── WatchSyncService.kt      # Foreground service for background sync
├── BootReceiver.kt          # Restart service on device boot
├── ble/
│   └── BleManager.kt        # BLE connection management
├── protocol/
│   └── CmfProtocol.kt       # CMF Watch BLE protocol
└── sync/
    └── DataSyncManager.kt   # Data sync logic (moon, weather, etc.)
```

## Permissions

The app requests these permissions:

| Permission | Purpose |
|------------|---------|
| BLUETOOTH_SCAN | Find CMF Watch devices |
| BLUETOOTH_CONNECT | Connect to watch |
| ACCESS_FINE_LOCATION | Required for BLE on older Android |
| FOREGROUND_SERVICE | Background sync service |
| RECEIVE_BOOT_COMPLETED | Restart sync after reboot |
| INTERNET | Fetch weather data |

## How It Works

1. **Connection**: The app scans for devices starting with "CMF Watch" and connects via BLE
2. **Authentication**: Uses the same protocol as the web app (SHA-256 challenge-response)
3. **Sync Loop**: Every 15 minutes, syncs enabled data:
   - Current time
   - Moon phase (displayed as weather city)
   - Weather data (if city configured)
4. **Notifications**: Persistent notification shows sync status

## Configuration

In the app, go to Develop → Auto-Sync to configure:

- **Moon Phase**: Push current moon phase to weather widget
- **Weather**: Enter city name to sync real weather data
- **Background Sync**: Enable/disable the background service

## Troubleshooting

### App won't connect to watch
1. Make sure Nothing X app is disconnected from the watch
2. Check Bluetooth permissions are granted
3. Try toggling Bluetooth off/on
4. Ensure watch is not in DND mode

### Background sync not working
1. Check battery optimization settings - disable for CMF App Store
2. Ensure the app has the "Background sync" toggle enabled
3. Check the notification shows "Connected to CMF Watch"

### Build errors
1. Clean and rebuild: `./gradlew clean assembleDebug`
2. Sync Gradle files in Android Studio
3. Invalidate caches: File → Invalidate Caches

## Development

### Adding New Data Sources

1. Add sync method in `DataSyncManager.kt`
2. Add protocol builder in `CmfProtocol.kt`
3. Expose via `SyncPlugin.kt`
4. Update TypeScript interface in `web/src/lib/native/sync.ts`

### Testing

```bash
# Run on device
./gradlew installDebug

# View logs
adb logcat | grep -E "(CMF|BleManager|SyncPlugin)"
```

## License

MIT - See root LICENSE file
