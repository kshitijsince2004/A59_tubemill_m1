#Requires -Version 5.1
<#
.SYNOPSIS
  Install WinSW-wrapped Windows Services for backend and SuperTokens.
.PARAMETER WinSwExe
  Path to WinSW.exe (download from WinSW releases).
#>
param(
  [string]$WinSwExe = 'C:\Zedral\scripts\WinSW.exe',
  [string]$ServiceDir = 'C:\Zedral\app\services'
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $WinSwExe)) {
  throw "WinSW.exe not found at $WinSwExe. Download WinSW and place it there."
}

New-Item -ItemType Directory -Path $ServiceDir -Force | Out-Null
$repoWinsw = Join-Path (Split-Path $PSScriptRoot -Parent) 'winsw'
if (-not (Test-Path $repoWinsw)) {
  $repoWinsw = Join-Path $PSScriptRoot '..\winsw'
}

foreach ($name in @('ZedralBackend', 'ZedralSuperTokens')) {
  $xmlSrc = Join-Path $repoWinsw "$name.xml"
  if (-not (Test-Path $xmlSrc)) { $xmlSrc = "C:\Zedral\scripts\$name.xml" }
  if (-not (Test-Path $xmlSrc)) { throw "Missing $name.xml" }

  $exe = Join-Path $ServiceDir "$name.exe"
  $xml = Join-Path $ServiceDir "$name.xml"
  Copy-Item $WinSwExe $exe -Force
  Copy-Item $xmlSrc $xml -Force

  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  if (-not $svc) {
    & $exe install
    Write-Host "Installed service $name"
  } else {
    Write-Host "Service already installed: $name"
  }
}

Write-Host 'Set secrets in C:\Zedral\config\backend.env then: Start-Service ZedralSuperTokens; Start-Service ZedralBackend'
