#Requires -Version 5.1
param(
  [string]$PreviousPath,
  [string]$CurrentLink = 'C:\Zedral\app\current'
)
$ErrorActionPreference = 'Stop'
if (-not $PreviousPath -or -not (Test-Path $PreviousPath)) {
  throw "PreviousPath invalid: $PreviousPath"
}
if (Test-Path $CurrentLink) { cmd /c rmdir "$CurrentLink" }
cmd /c mklink /J "$CurrentLink" "$PreviousPath"
Restart-Service ZedralBackend -Force
Start-Sleep -Seconds 3
& 'C:\Zedral\scripts\Invoke-HealthCheck.ps1'
Write-Host "Rolled back to $PreviousPath"
try {
  Write-EventLog -LogName Application -Source Zedral -EntryType Warning -EventId 3002 -Message "Rollback to $PreviousPath"
} catch {}
