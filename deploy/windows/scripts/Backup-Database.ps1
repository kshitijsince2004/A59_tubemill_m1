#Requires -Version 5.1
<#
.SYNOPSIS
  pg_dump custom-format backup, checksum, optional off-server copy.
#>
param(
  [string]$PgDump = 'pg_dump',
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupDir = 'C:\Zedral\backups',
  [string]$OffServerPath = '',
  [int]$KeepLocalDays = 7
)
$ErrorActionPreference = 'Stop'
if (-not $DatabaseUrl) { throw 'DATABASE_URL is required' }

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outFile = Join-Path $BackupDir "zedral_prod_$stamp.dump"
& $PgDump --format=custom --file=$outFile $DatabaseUrl
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with $LASTEXITCODE" }

$hash = (Get-FileHash -Algorithm SHA256 $outFile).Hash
Set-Content -Path "$outFile.sha256" -Value "$hash  $(Split-Path $outFile -Leaf)"

if ($OffServerPath) {
  New-Item -ItemType Directory -Path $OffServerPath -Force | Out-Null
  Copy-Item $outFile $OffServerPath -Force
  Copy-Item "$outFile.sha256" $OffServerPath -Force
}

Get-ChildItem $BackupDir -Filter 'zedral_prod_*.dump' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepLocalDays) } |
  ForEach-Object {
    Remove-Item $_.FullName -Force
    Remove-Item "$($_.FullName).sha256" -Force -ErrorAction SilentlyContinue
  }

try {
  Write-EventLog -LogName Application -Source Zedral -EntryType Information -EventId 2001 -Message "Backup OK: $outFile"
} catch {}
Write-Host "Backup written: $outFile"
