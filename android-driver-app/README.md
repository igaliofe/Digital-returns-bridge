# Android Driver App — Digital Returns Bridge

Native Android Java app for drivers to manage pickups, scan barcodes, and upload photos.

## Prerequisites

- Android Studio Hedgehog (2023.1.1) or later
- Android SDK 34
- Java 17
- Device or emulator with Android 7.0+ (minSdk 24)

## Build

```bash
cd android-driver-app
./gradlew :app:assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

## Configuration

The API base URL is set in `app/build.gradle`:
```groovy
buildConfigField "String", "API_BASE_URL", '"http://10.0.2.2:8080/"'
```

- `10.0.2.2` is the Android emulator's alias for `localhost` on the host machine.
- Change this to your server's actual IP/hostname for real device testing.

## Permissions

- `INTERNET` — REST API calls
- `CAMERA` — barcode scanning (ZXing) and photo capture

## Barcode Assignment Flow

1. Driver receives a pickup in the list
2. Opens pickup details
3. Sticks a physical barcode label on the product
4. Taps "Assign Barcode"
5. Types or scans the barcode into the text field
6. Taps "Assign" — the barcode is linked to the return request server-side
7. Status changes to `BARCODE_ASSIGNED`
8. Driver can now confirm pickup

## Running Tests

```bash
cd android-driver-app
./gradlew :app:test
```
