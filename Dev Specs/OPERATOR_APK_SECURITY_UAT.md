# Operator APK — Security matrix & UAT checklist (P8)

## Security matrix

| Check | Expected | Status |
|---|---|---|
| Non-OPERATOR login on APK | 403 / discarded session + locked message | Client gate + `/operator/context` `requireOperator` |
| Header role in production | Impossible | `allowHeaderRole` false when `isProduction` |
| Null hash PIN | Deny | `pinService.verifyPin` |
| Demo password map | Removed | `authService.ensureSuperTokensUser` |
| Windows plant without ST | Boot failure | `assertProductionSecrets` |
| Tokens in APK binary | None | Preferences / session only; no secrets in env baked into release without MDM config |
| Secrets in logs | Redacted | logger discipline; never log PIN/token |
| Bundle purity | No admin/plant modules | CI `check:operator-purity` |
| Idempotency | Retries do not duplicate | `txn.idempotency_key` + 409 = success |

## Offline drill (acceptance)

1. Airplane mode: badge+PIN for cached operator succeeds.
2. Open run, capture entry + stoppage + defect — badge shows pending.
3. Kill app from recents, relaunch — queue intact (SQLite/IDB).
4. Airplane off — badge drains; server has each record once.
5. Force mid-queue 5xx then recover — no duplicates.
6. Force 4xx validation — parks; other aggregates continue; supervisor discard works.
7. Change plan on server while offline — appears after reconnect pull.

## Full-shift UAT

- [ ] Login / logout on target tablet hardware
- [ ] Capture on assigned process only
- [ ] Shift handover outgoing
- [ ] Weak Wi-Fi / airplane drill above
- [ ] Kiosk lock task holds; maintenance exit with supervisor PIN
- [ ] MDM push of new APK version (when enrolled)

## Signed release

- Keystore stored in vault / DPAPI; never in git
- `npm run android:apk:release -w client` after `cap sync`
- Record version + APK hash in release notes
