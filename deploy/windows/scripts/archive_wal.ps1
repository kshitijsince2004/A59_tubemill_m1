#Requires -Version 5.1
# Called from PostgreSQL archive_command: archive_wal.ps1 "%p" "%f"
param(
  [Parameter(Mandatory = $true)][string]$WalPath,
  [Parameter(Mandatory = $true)][string]$WalFile
)
$ErrorActionPreference = 'Stop'
$destRoot = 'C:\Zedral\backups\wal'
New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
$dest = Join-Path $destRoot $WalFile
Copy-Item -Path $WalPath -Destination $dest -Force
