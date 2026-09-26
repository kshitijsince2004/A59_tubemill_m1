# Operator APK — size / startup measurement notes (P6)

Run after `npm run build:operator -w client`:

```
# Bundle sizes
Get-ChildItem Code/client/dist-operator -Recurse -File |
  Sort-Object Length -Descending |
  Select-Object -First 20 FullName, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}
```

After `npx cap sync` + Gradle assemble:

| Metric | How to measure | Target |
|---|---|---|
| APK download size | `*-debug.apk` / `*-release.apk` file size | Record in release notes |
| Installed size | Android Settings → Apps → Zedral M1 Operator | Record |
| Startup to interactive | Manual stopwatch: cold launch → login usable | Prefer &lt; 3s on plant tablet |
| Initial JS chunks | Vite build report / `dist-operator/assets` | Consoles lazy-loaded |

Consoles are already `React.lazy` in both `App.jsx` and `OperatorApp.jsx`.
Read timeouts: 15s default in `http.js` (`AbortController`).
