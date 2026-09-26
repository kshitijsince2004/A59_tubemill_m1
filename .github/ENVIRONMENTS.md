# GitHub Environments

Create these Environments in the repository settings (Settings → Environments):

## `uat`
- No required reviewers (or optional)
- Used by `release.yml` job `publish-uat`

## `production`
- **Required reviewers**: enable (Client sign-off + Zedral DevOps)
- Used by `release.yml` job `approve-production`
- Publishes `approved.json` for the on-box pull agent

Do not grant the production environment to pull_request workflows.
