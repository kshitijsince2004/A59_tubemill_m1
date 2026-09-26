#Requires -Version 5.1
param(
  [string]$HealthUrl = 'http://127.0.0.1:3001/health',
  [int]$TimeoutSec = 10
)
$ErrorActionPreference = 'Stop'
try {
  $r = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec $TimeoutSec
  $status = $r.data.status
  if (-not $status) { $status = $r.status }
  if ($status -ne 'ok') {
    throw "health status: $status"
  }
  Write-Host "Health OK: $status"
  exit 0
} catch {
  try {
    Write-EventLog -LogName Application -Source Zedral -EntryType Error -EventId 5001 -Message "Health check failed: $_"
  } catch {}
  Write-Error $_
  exit 1
}
