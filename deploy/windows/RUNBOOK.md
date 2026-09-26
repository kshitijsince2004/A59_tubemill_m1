# Zedral Windows Production Runbook

Owners: Client IT, Zedral DevOps, Zedral Backend, Zedral Integration, Client ERP (Suraj), Client sign-off.

**Prerequisites:** Close [GATE0_STATUS.md](GATE0_STATUS.md) Required questionnaire items. APK/MDM steps are documented in steps 25–27 — validate on real tablets when the signed APK is ready; browser PWA remains a fallback.

| # | Step | Owner | Action | Verification | Failure |
|---|---|---|---|---|---|
| 1 | Verify Windows Server | Client IT | Confirm edition, 2 cores, 16 GB, ~126 GB free | Specs match | Escalate before proceed |
| 2 | Apply Windows updates | Client IT | Patch + reboot in window | Healthy after reboot | Retry next window |
| 3 | Hostname / network | Client IT | Static IP, DNS, domain if used | Resolves on LAN | Revert network |
| 4 | Firewall | Zedral DevOps | `Set-Firewall.ps1 -ManagementCidr <mgmt>` | Only 443 (+80 redirect) + mgmt RDP | Keep RDP session open |
| 5 | Service accounts | Client IT + DevOps | Low-priv accounts for PG, backend, ST | Scoped rights only | Tighten before continue |
| 6 | Runtimes | Zedral DevOps | Node LTS, JRE, IIS+ARR+URL Rewrite, PS7, PostgreSQL 16 | Versions pinned | Reinstall pinned |
| 7 | Docker | — | **Skip** (native only) | N/A | — |
| 8 | Database | Zedral Backend | Apply `postgres/*.snippet`, restart PG | Listens localhost only | Restore conf |
| 9 | DB roles | Zedral Backend | `provision_roles.sql` with vaulted passwords | `m1_app` unprivileged | Revoke/reapply |
| 10 | Prepare dirs | Zedral DevOps | `Prepare-Server.ps1` | `C:\Zedral\*` exist | Rerun as admin |
| 11 | Secrets | Zedral DevOps | Fill `config\backend.env` from `.env.windows.example` via DPAPI | App boots; no defaults | Rotate if leaked |
| 12 | SuperTokens | Zedral DevOps | Install Core jar; WinSW `ZedralSuperTokens` | `/hello` on 3567 | Check JRE/DB |
| 13 | Deploy first release | Zedral DevOps | Unpack release → `releases\`; junction `app\current` | Files present | Use prior zip |
| 14 | Backend service | Zedral DevOps | `Install-Services.ps1`; start services | `Invoke-HealthCheck.ps1` OK | Check env/logs |
| 15 | IIS | Zedral DevOps | `Configure-IIS.ps1`; bind TLS cert | HTTPS loads UI; `/api/health` proxied | Fix rewrite rules |
| 16 | Monitoring | Zedral DevOps | `Register-ScheduledTasks.ps1`; optional exporters | Tasks in Task Scheduler | Watchdogs alone OK |
| 17 | Backups | Zedral DevOps | Nightly backup + WAL archive + off-server path | Backup + restore test | Block go-live |
| 18 | Pull agent | Zedral DevOps | Schedule `Pull-ApprovedRelease.ps1` with manifest URL | Fetches approved build | Manual Deploy-Release |
| 19 | UAT deploy | Zedral DevOps | Deploy to UAT (separate host or Zedral UAT) | UAT smoke green | Fix before prod |
| 20 | ERP UAT | Integration + Suraj | When BC UAT ready; else file adapter smoke | Masters/orders or file plan OK | Log OQs |
| 21 | Client UAT | Client sign-off | Capture, reports, offline sync in browser | Acceptance recorded | Fix + re-UAT |
| 22 | Prod approval | Client sign-off | GitHub Environment production approval | Approval recorded | Hold |
| 23 | Prod deploy | Zedral DevOps | Pull agent or `Deploy-Release.ps1` | Health OK | Auto-rollback |
| 24 | Migration | Zedral Backend | Included in Deploy-Release after backup | Schema verified | Restore pre-migration dump |
| 25 | APK build | Zedral DevOps | On build machine: `npm run build:operator -w client` then `npx cap sync android` and Gradle `assembleRelease` with vaulted keystore. Set `VITE_API_BASE=https://YOUR_PLANT_HOST/api`. Copy network_security_config from `Code/client/android-templates/` if HTTP interim. | Signed APK installs; operator login works on plant LAN | Fix API URL / CORS_ORIGIN |
| 26 | MDM | Client IT + DevOps | Enroll tablets; push APK; kiosk / lock-task policy; Wi-Fi; managed config for plant URL; device-owner where required | Tablet launches into Zedral M1 Operator only | Screen-pinning OK for bench only |
| 27 | Tablet validation | Zedral + supervisor | APK (preferred) or browser PWA: login, capture, offline drill per `Dev Specs/OPERATOR_APK_SECURITY_UAT.md` | Offline queue flushes; no duplicates | Check API URL / tokens / outbox |
| 28 | Prod smoke | DevOps + Backend | One lot end-to-end; use `X-Request-Id` to trace | Capture + report OK | Rollback if needed |
| 29 | Backup verify | Zedral DevOps | Restore latest dump to scratch DB | Row counts OK | Block sign-off |
| 30 | Go-live sign-off | Client + Zedral | Checklist [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) | Signed acceptance | Schedule open items |

## Rollback

1. `Rollback-Release.ps1 -PreviousPath <prior release folder>`
2. If irreversible migration: restore pre-migration dump from `C:\Zedral\backups` (and off-server copy), then restart services.
