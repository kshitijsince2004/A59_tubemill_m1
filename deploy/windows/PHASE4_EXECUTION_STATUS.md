# Phase 4 — Live server execution status

## What is delivered in-repo

- Full runbook: [RUNBOOK.md](RUNBOOK.md)
- PowerShell automation under `scripts/`
- IIS / WinSW / Postgres provisioning artifacts
- Pull-agent contract: [PULL_AGENT.md](PULL_AGENT.md)
- Go-live checklist: [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md)

## Live execution (blocked on Gate 0)

| Step | Status | Blocker |
|---|---|---|
| RDP to plant Windows Server | BLOCKED | Client IT access (§29 R5) |
| Prepare-Server / firewall / IIS / TLS | BLOCKED | RDP + TLS cert path |
| PostgreSQL 16 native install | BLOCKED | RDP + admin |
| WinSW services start | BLOCKED | Secrets + SuperTokens jar on box |
| Scheduled backup / watchdogs | BLOCKED | Off-server backup target (§29 R8) |
| UAT on separate host | READY TO START | Can use Zedral infra with release artifact once Gate 0 partial answers exist |
| Production pull-agent apply | BLOCKED | Prod server + GitHub Environments | 

## Operator instructions when access is granted

1. Close [CLIENT_QUESTIONNAIRE.md](CLIENT_QUESTIONNAIRE.md) Required rows; update [GATE0_STATUS.md](GATE0_STATUS.md).
2. RDP in; run `Prepare-Server.ps1` then follow [RUNBOOK.md](RUNBOOK.md) steps 4–18.
3. Create GitHub Environments `uat` and `production` (required reviewers on production).
4. Tag `vX.Y.Z` → Release workflow → approve production → point pull agent at `approved.json`.
5. Complete [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md); browser PWA tablet validation (APK deferred).

This file is the Phase 4 deliverable until plant RDP is available; scripts are production-ready and do not require further repo work to execute.
