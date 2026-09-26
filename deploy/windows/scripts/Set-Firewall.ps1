#Requires -Version 5.1
<#
.SYNOPSIS
  Idempotent Windows Defender Firewall allowlist for Zedral (LAN-preferred).
.PARAMETER ManagementCidr
  Remote address for RDP (e.g. 10.0.0.0/24). Required for RDP rule.
.PARAMETER HttpsRemoteAddress
  Optional remote scope for 443. Empty = any (tighten to plant LAN when known).
#>
param(
  [string]$ManagementCidr = '10.0.0.0/24',
  [string]$HttpsRemoteAddress = ''
)
$ErrorActionPreference = 'Stop'

function Set-ZedralRule {
  param([string]$Name, [scriptblock]$Create)
  $existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Rule exists: $Name"
    return
  }
  & $Create
  Write-Host "Created: $Name"
}

Set-ZedralRule 'Zedral HTTPS in' {
  $params = @{
    DisplayName = 'Zedral HTTPS in'
    Direction   = 'Inbound'
    Protocol    = 'TCP'
    LocalPort   = 443
    Action      = 'Allow'
    Profile     = 'Domain', 'Private'
  }
  if ($HttpsRemoteAddress) { $params.RemoteAddress = $HttpsRemoteAddress }
  New-NetFirewallRule @params | Out-Null
}

Set-ZedralRule 'Zedral HTTP redirect in' {
  New-NetFirewallRule -DisplayName 'Zedral HTTP redirect in' -Direction Inbound -Protocol TCP `
    -LocalPort 80 -Action Allow -Profile Domain, Private | Out-Null
}

Set-ZedralRule 'Zedral RDP in (mgmt only)' {
  New-NetFirewallRule -DisplayName 'Zedral RDP in (mgmt only)' -Direction Inbound -Protocol TCP `
    -LocalPort 3389 -RemoteAddress $ManagementCidr -Action Allow -Profile Domain, Private | Out-Null
}

Write-Host 'Firewall rules applied. PostgreSQL/backend/SuperTokens bind loopback — no inbound rules for them.'
