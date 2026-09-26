# Operator APK README

## Quick start (web operator target)

```bash
cd Code
npm install
npm run dev:operator -w client   # http://localhost:5174
npm run build:operator -w client
npm run check:operator-purity -w client
```

Set `VITE_API_BASE=https://YOUR_PLANT_HOST/api` for absolute API URL (required inside Capacitor WebView).

## Capacitor / Android

```bash
cd Code/client
npm run build:operator
npx cap add android          # once
# Copy android-templates/network_security_config.xml into android/app/src/main/res/xml/
npx cap sync android
npm run android:apk          # debug APK (requires Android SDK / Gradle)
```

App id: `com.zedral.m1.operator`  
Web dir: `dist-operator`

## Offline

SQLite on device (Capacitor Community SQLite); IndexedDB fallback for browser. Sync engine: `src/offline/syncEngine.js`.

## Docs

- `Dev Specs/Operator_Tablet_APK_Implementation_Plan.md`
- `Dev Specs/OPERATOR_APK_ARCHITECTURE_BASELINE.md`
- `Dev Specs/OPERATOR_APK_SECURITY_UAT.md`
- `Dev Specs/OPERATOR_APK_SIZE_BASELINE.md`
