# UAT / Production sign-off tracker (APK deferred)

## UAT

| Item | Owner | Status | Notes |
|---|---|---|---|
| Release artifact built via GitHub Actions | Zedral DevOps | READY (workflow) | `.github/workflows/release.yml` |
| Deploy to UAT host | Zedral DevOps | PENDING | Needs UAT host + Gate 0 network answers |
| Smoke: `/health` ok, login, one capture | Zedral Backend | PENDING | |
| Offline queue + sync (browser) | Zedral Mobile/FE | PENDING | |
| ERP UAT (or file adapter acceptance) | Integration + Client | PENDING | BC UAT may lag; file adapter allowed for floor UAT |
| Client UAT sign-off | Client | PENDING | |

## Production

| Item | Owner | Status | Notes |
|---|---|---|---|
| GitHub Environment `production` + reviewers | Zedral DevOps | PENDING | Create in repo settings |
| Manual approval recorded | Client sign-off | PENDING | |
| Pull agent applied approved release | Zedral DevOps | PENDING | Blocked on plant server |
| One-lot walkthrough | Floor + Zedral | PENDING | Browser PWA |
| Backup restore test recorded | Zedral DevOps | PENDING | |
| [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) Required green | Joint | PENDING | |
| Formal go-live acceptance | Client + Zedral | PENDING | |

## Deferred

- Capacitor APK / MDM (see GO_LIVE_CHECKLIST deferred section)
