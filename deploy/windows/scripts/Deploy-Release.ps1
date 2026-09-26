#Requires -Version 5.1
param(
  [string]$ReleaseZip,
  [string]$ReleasesDir = 'C:\Zedral\releases',
  [string]$CurrentLink = 'C:\Zedral\app\current',
  [string]$NodeExe = 'node',
  [switch]$SkipBackup,
  [switch]$SkipMigrate
)
$ErrorActionPreference = 'Stop'
$scripts = 'C:\Zedral\scripts'

if (-not $ReleaseZip -or -not (Test-Path $ReleaseZip)) {
  throw "ReleaseZip not found: $ReleaseZip"
}

$version = [IO.Path]::GetFileNameWithoutExtension($ReleaseZip)
$target = Join-Path $ReleasesDir $version
New-Item -ItemType Directory -Path $ReleasesDir -Force | Out-Null
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Path $target | Out-Null

Expand-Archive -Path $ReleaseZip -DestinationPath $target -Force

$previous = $null
if (Test-Path $CurrentLink) {
  $previous = (Get-Item $CurrentLink).Target
  if (-not $previous) { $previous = (Get-Item $CurrentLink).FullName }
}

# Load backend.env into process for migrate/backup if present
$envFile = 'C:\Zedral\config\backend.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $pair = $_.Split('=', 2)
    if ($pair.Count -eq 2) {
      [Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim(), 'Process')
    }
  }
}

if (-not $SkipBackup) {
  & (Join-Path $scripts 'Backup-Database.ps1')
}

if (-not $SkipMigrate) {
  Push-Location $target
  try {
    & $NodeExe 'server\dist\db\migrate.js'
    if ($LASTEXITCODE -ne 0) { throw "migrate failed: $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

# Repoint current junction
if (Test-Path $CurrentLink) {
  cmd /c rmdir "$CurrentLink"
}
cmd /c mklink /J "$CurrentLink" "$target"

Restart-Service ZedralBackend -Force
Start-Sleep -Seconds 3

$health = & (Join-Path $scripts 'Invoke-HealthCheck.ps1')
if ($LASTEXITCODE -ne 0) {
  Write-Warning 'Health failed — rolling back'
  & (Join-Path $scripts 'Rollback-Release.ps1') -PreviousPath $previous
  throw 'Deploy aborted after failed health check'
}

Write-Host "Deployed $version"
try {
  Write-EventLog -LogName Application -Source Zedral -EntryType Information -EventId 3001 -Message "Deployed $version"
} catch {}
