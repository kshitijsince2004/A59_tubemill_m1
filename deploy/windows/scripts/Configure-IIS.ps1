#Requires -Version 5.1
<#
.SYNOPSIS
  Configure IIS site for Zedral static + ARR reverse proxy.
#>
param(
  [string]$SiteName = 'Zedral',
  [string]$PhysicalPath = 'C:\Zedral\app\current\client\dist',
  [string]$HostHeader = '',
  [int]$HttpsPort = 443
)
$ErrorActionPreference = 'Stop'
Import-Module WebAdministration

if (-not (Test-Path $PhysicalPath)) {
  New-Item -ItemType Directory -Path $PhysicalPath -Force | Out-Null
}

$webConfigSrc = Join-Path (Split-Path $PSScriptRoot -Parent) 'iis\web.config'
if (Test-Path $webConfigSrc) {
  Copy-Item $webConfigSrc (Join-Path $PhysicalPath 'web.config') -Force
}

if (-not (Get-Website -Name $SiteName -ErrorAction SilentlyContinue)) {
  New-Website -Name $SiteName -PhysicalPath $PhysicalPath -Port 80 -HostHeader $HostHeader | Out-Null
  Write-Host "Created site $SiteName"
} else {
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $PhysicalPath
}

# Enable ARR proxy (requires ARR installed)
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter 'system.webServer/proxy' -name 'enabled' -value 'True' -ErrorAction SilentlyContinue

Write-Host "Bind TLS certificate to port $HttpsPort via IIS Manager or: netsh http add sslcert ..."
Write-Host 'IIS site configured.'
