#Requires -Version 5.1
param(
  [int]$WarnPercent = 80,
  [int]$CritPercent = 90,
  [string]$Drive = 'C'
)
$ErrorActionPreference = 'Stop'
$vol = Get-Volume -DriveLetter $Drive -ErrorAction Stop
$usedPct = [math]::Round((($vol.Size - $vol.SizeRemaining) / $vol.Size) * 100, 1)
$msg = "Disk ${Drive}: ${usedPct}% used"
if ($usedPct -ge $CritPercent) {
  try { Write-EventLog -LogName Application -Source Zedral -EntryType Error -EventId 4001 -Message $msg } catch {}
  Write-Error $msg
  exit 2
}
if ($usedPct -ge $WarnPercent) {
  try { Write-EventLog -LogName Application -Source Zedral -EntryType Warning -EventId 4002 -Message $msg } catch {}
  Write-Warning $msg
  exit 1
}
Write-Host $msg
exit 0
