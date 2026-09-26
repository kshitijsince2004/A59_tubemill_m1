# Production readiness checklist (APK/MDM deferred)

Mark each Required item. APK/MDM Required items are deferred and tracked at the bottom.

## Required — this go-live

| Area | Item | Status |
|---|---|---|
| Server | Supported Windows edition confirmed | |
| Server | Patched; capacity reserve respected | |
| Network | Static IP/DNS; LAN posture confirmed | |
| Firewall | Default deny inbound; allowlist applied; RDP mgmt-only | |
| Backend | WinSW service; loopback; `/health` OK; graceful shutdown | |
| Backend | Release-based deploy + rollback rehearsed | |
| Database | Loopback only; `m1_app` unprivileged; tuned | |
| Security | No default secrets; ST required; TLS 1.2/1.3 + HSTS | |
| CI/CD | Hosted build; pull agent (no inbound mgmt ports); prod approval gate | |
| UAT | Client UAT sign-off (file ERP adapter OK if BC UAT pending) | |
| Monitoring | Health/disk/backup watchdogs scheduled | |
| Logging | pino JSON + request_id; rotation | |
| Backup | Nightly dump + WAL; off-server; restore tested | |
| DR | RPO/RTO agreed; rebuild runbook delivered | |
| Tablets | Browser PWA: login, capture, offline, sync | |
| Docs | Runbook + questionnaire delivered | |
| Go-live | Required green + on-call agreed | |

## Deferred — APK / MDM phase

| Item | Owner |
|---|---|
| Capacitor Android project + signing CI | Zedral Mobile |
| MDM enrollment, kiosk, wipe, forced update | Client IT + Mobile |
| Secure native token storage | Zedral Mobile |
| Min supported app version endpoint | Zedral Backend |
