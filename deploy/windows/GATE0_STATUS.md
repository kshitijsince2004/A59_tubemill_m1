# Gate 0 status

| Prerequisite | Status | Notes |
|---|---|---|
| Client questionnaire (§29) | OPEN | Template: [CLIENT_QUESTIONNAIRE.md](CLIENT_QUESTIONNAIRE.md) |
| RDP access | BLOCKED | Awaiting client IT |
| TLS cert path | BLOCKED | Awaiting client IT / CA |
| Off-server backup target | BLOCKED | Awaiting client IT |
| Repo deploy artifacts | READY | See this `deploy/windows/` tree |
| App production readiness | READY | Phase 1 code in `Code/` |
| CI release packaging | READY | `.github/workflows/release.yml` |

Live runbook execution (Phase 4) starts only after Required questionnaire rows are closed and RDP is proven.
