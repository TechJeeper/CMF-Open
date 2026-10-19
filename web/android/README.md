# CMF App Store - Android App

Native Android app for the CMF Watch App Store. Provides background sync capabilities and native BLE performance.

## Features

- **Background Sync**: Keep live watchface data updated even when the app is closed
- **Native BLE**: Better Bluetooth performance than Web Bluetooth
- **Boot Persistence**: Automatically restart sync service after device reboot
- **Multi-Watch Support**: Works with CMF Watch 3 Pro and CMF Watch Pro 2

## Requirements

- Android Studio Arctic Fox or newer
- Android SDK 24+ (Android 7.0)
- JDK 17+
- CMF Watch 3 Pro or CMF Watch Pro 2

## Building

### Development Build

1. Open the `android` folder in Android Studio
2. Let Gradle sync complete
3. Connect your Android device or start an emulator
4. Click Run (▶)

### Release Build

```bash
cd web
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

The APK will be at `app/build/outputs/apk/release/app-release-unsigned.apk`

### Signed Release

For Play Store or distribution, create a keystore and configure signing in `app/build.gradle`.

## Architecture

```
android/
├── app/src/main/java/com/cmfkit/appstore/
│   ├── MainActivity.kt      # Main Capacitor activity
│   ├── SyncPlugin.kt        # Capacitor plugin for sync control
│   ├── WatchSyncService.kt  # Background foreground service
│   └── BootReceiver.kt      # Restart service on boot
└── app/src/main/
    ├── AndroidManifest.xml  # Permissions and components
    └── assets/public/       # Web app (from dist/)
```

## Permissions

The app requires:

- **Bluetooth**: Connect to CMF Watch
- **Location**: Required for BLE scanning on Android
- **Foreground Service**: Keep sync running in background
- **Boot Completed**: Restart service after reboot

## Development

### Adding Native Features

1. Create a Capacitor plugin in `SyncPlugin.kt`
2. Add TypeScript interface in `web/src/lib/native/sync.ts`
3. Add web fallback in `web/src/lib/native/sync-web.ts`
4. Rebuild and sync: `npm run build && npx cap sync android`

### Updating Web Code

```bash
cd web
npm run build
npx cap sync android
```

Then rebuild in Android Studio.

## License

MIT - See root LICENSE file
