#Requires -Version 5.1
param(
  [int]$RetainDays = 30,
  [string]$AppLogs = 'C:\Zedral\logs',
  [string]$IisLogs = 'C:\inetpub\logs\LogFiles'
)
$ErrorActionPreference = 'Stop'
$cutoff = (Get-Date).AddDays(-$RetainDays)

function Clear-OldFiles([string]$Path, [string]$Filter) {
  if (-not (Test-Path $Path)) { return }
  Get-ChildItem -Path $Path -Filter $Filter -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
      Remove-Item $_.FullName -Force
      Write-Host "Removed $($_.FullName)"
    }
}

Clear-OldFiles $AppLogs '*.log'
Clear-OldFiles $AppLogs '*.log.*'
Clear-OldFiles $IisLogs '*.log'
Write-Host "Log cleanup done (older than $RetainDays days)"
