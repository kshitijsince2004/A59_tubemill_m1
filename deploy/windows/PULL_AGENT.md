# Pull-agent contract
#
# The production Windows Server never accepts inbound CI/CD connections.
# After the GitHub `production` environment is approved, the workflow publishes
# `approved.json` (attached to the GitHub Release for tag builds).
#
# On the server, Task Scheduler runs every 5 minutes:
#
#   Pull-ApprovedRelease.ps1 -ManifestUrl "https://.../approved.json"
#
# Manifest shape:
# {
#   "version": "1.4.2",
#   "environment": "production",
#   "url": "https://github.com/<org>/<repo>/releases/download/v1.4.2/zedral-m1-1.4.2.zip",
#   "sha256": "<hex>",
#   "approved_at": "2026-09-26T10:00:00Z"
# }
#
# Agent behavior: if version != local pull-state.json → download → checksum →
# Deploy-Release.ps1 (backup → migrate → swap current → restart → health) →
# on health failure Rollback-Release.ps1.
#
# Auth: prefer a fine-scoped GitHub PAT or release asset on an internal HTTPS
# share mirrored from the release. Pass Authorization header via -HeadersJson
# if the manifest/asset is private.
#
# GitHub Environments to create in repo settings:
#   - uat
#   - production  (required reviewers enabled)
