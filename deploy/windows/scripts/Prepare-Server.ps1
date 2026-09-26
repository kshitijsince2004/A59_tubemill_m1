#Requires -Version 5.1
<#
.SYNOPSIS
  Create C:\Zedral layout, Event Log source, and copy scripts.
#>
$ErrorActionPreference = 'Stop'
$Root = 'C:\Zedral'
$Dirs = @('app', 'config', 'logs', 'backups', 'scripts', 'releases', 'temp', 'app\supertokens')

foreach ($d in $Dirs) {
  $path = Join-Path $Root $d
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Path $path | Out-Null
    Write-Host "Created $path"
  }
}

try {
  if (-not [System.Diagnostics.EventLog]::SourceExists('Zedral')) {
    New-EventLog -LogName Application -Source Zedral
    Write-Host 'Registered Event Log source Zedral'
  }
} catch {
  Write-Warning "Event Log source registration failed (run as admin): $_"
}

$repoScripts = Join-Path $PSScriptRoot '.'
Get-ChildItem -Path $repoScripts -Filter '*.ps1' | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $Root 'scripts') -Force
}

Write-Host 'Prepare-Server complete. Next: install Node LTS, JRE, PostgreSQL 16, IIS+ARR+URL Rewrite, PowerShell 7.'
