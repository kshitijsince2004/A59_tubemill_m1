#Requires -Version 5.1
<#
.SYNOPSIS
  Register scheduled tasks for backup, health, disk, log cleanup, pull agent.
#>
param(
  [string]$ManifestUrl = '',
  [string]$OffServerBackup = ''
)
$ErrorActionPreference = 'Stop'
$scripts = 'C:\Zedral\scripts'

function Register-ZedralTask($Name, $Script, $Args, $Trigger) {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Script`" $Args"
  Register-ScheduledTask -TaskName $Name -Action $action -Trigger $Trigger -RunLevel Highest -Force | Out-Null
  Write-Host "Scheduled: $Name"
}

$daily = New-ScheduledTaskTrigger -Daily -At 2am
$hourly = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
$fiveMin = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)

$backupArgs = if ($OffServerBackup) { "-OffServerPath `"$OffServerBackup`"" } else { '' }
Register-ZedralTask 'Zedral-Backup' (Join-Path $scripts 'Backup-Database.ps1') $backupArgs $daily
Register-ZedralTask 'Zedral-Cleanup-Logs' (Join-Path $scripts 'Cleanup-Logs.ps1') '' $daily
Register-ZedralTask 'Zedral-Watch-Disk' (Join-Path $scripts 'Watch-Disk.ps1') '' $hourly
Register-ZedralTask 'Zedral-Health' (Join-Path $scripts 'Invoke-HealthCheck.ps1') '' $fiveMin

if ($ManifestUrl) {
  Register-ZedralTask 'Zedral-Pull-Release' (Join-Path $scripts 'Pull-ApprovedRelease.ps1') "-ManifestUrl `"$ManifestUrl`"" $fiveMin
}

Write-Host 'Scheduled tasks registered.'
