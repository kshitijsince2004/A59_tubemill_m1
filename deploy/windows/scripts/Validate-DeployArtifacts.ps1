#Requires -Version 5.1
<#
.SYNOPSIS
  Validate that deploy/windows artifacts exist in the repo (pre-flight, no plant server needed).
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $root 'deploy\windows'))) {
  $root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
}
$base = Join-Path $root 'deploy\windows'
$required = @(
  'RUNBOOK.md',
  'GO_LIVE_CHECKLIST.md',
  'PULL_AGENT.md',
  'CLIENT_QUESTIONNAIRE.md',
  'config\.env.windows.example',
  'winsw\ZedralBackend.xml',
  'winsw\ZedralSuperTokens.xml',
  'iis\web.config',
  'postgres\provision_roles.sql',
  'scripts\Prepare-Server.ps1',
  'scripts\Set-Firewall.ps1',
  'scripts\Deploy-Release.ps1',
  'scripts\Rollback-Release.ps1',
  'scripts\Pull-ApprovedRelease.ps1',
  'scripts\Backup-Database.ps1',
  'scripts\Invoke-HealthCheck.ps1',
  'scripts\Register-ScheduledTasks.ps1'
)

$missing = @()
foreach ($rel in $required) {
  $p = Join-Path $base $rel
  if (-not (Test-Path $p)) { $missing += $rel }
}

if ($missing.Count -gt 0) {
  Write-Error ("Missing artifacts:`n - " + ($missing -join "`n - "))
  exit 1
}

Write-Host "OK: $($required.Count) deploy/windows artifacts present under $base"
exit 0
