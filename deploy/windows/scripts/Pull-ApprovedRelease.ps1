#Requires -Version 5.1
<#
.SYNOPSIS
  Pull-based deploy agent: fetch approved release manifest and apply if newer.
.PARAMETER ManifestUrl
  HTTPS URL to approved.json { "version": "...", "url": "...", "sha256": "..." }
.PARAMETER StateFile
  Local file recording last applied version.
#>
param(
  [Parameter(Mandatory = $true)][string]$ManifestUrl,
  [string]$StateFile = 'C:\Zedral\config\pull-state.json',
  [string]$TempDir = 'C:\Zedral\temp',
  [string]$HeadersJson = ''
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

$headerArgs = @{}
if ($HeadersJson) {
  $headers = $HeadersJson | ConvertFrom-Json
  $headers.PSObject.Properties | ForEach-Object { $headerArgs[$_.Name] = $_.Value }
}

$manifest = Invoke-RestMethod -Uri $ManifestUrl -Headers $headerArgs -TimeoutSec 60
if (-not $manifest.version -or -not $manifest.url) {
  throw 'Invalid manifest: need version and url'
}

$current = $null
if (Test-Path $StateFile) {
  $current = (Get-Content $StateFile -Raw | ConvertFrom-Json).version
}
if ($current -eq $manifest.version) {
  Write-Host "Already on $($manifest.version)"
  exit 0
}

$zip = Join-Path $TempDir "zedral-m1-$($manifest.version).zip"
Invoke-WebRequest -Uri $manifest.url -OutFile $zip -Headers $headerArgs -TimeoutSec 600

if ($manifest.sha256) {
  $actual = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLowerInvariant()
  if ($actual -ne $manifest.sha256.ToLowerInvariant()) {
    throw "Checksum mismatch: expected $($manifest.sha256) got $actual"
  }
}

& 'C:\Zedral\scripts\Deploy-Release.ps1' -ReleaseZip $zip
@{ version = $manifest.version; appliedAt = (Get-Date).ToString('o') } |
  ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8
Write-Host "Pull agent applied $($manifest.version)"
