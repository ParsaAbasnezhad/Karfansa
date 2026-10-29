#Requires -Version 5.1
<#
.SYNOPSIS
  Creates .env from .env.example and fills in freshly generated secrets.
.PARAMETER Force
  Overwrite an existing .env (this changes the database password: remove the pgdata volume first).
#>
param([switch]$Force)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function New-RandomSecret([int]$ByteCount) {
    $bytes = New-Object byte[] $ByteCount
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}

if ((Test-Path .env) -and -not $Force) {
    Write-Host '.env already exists. Nothing changed. Use -Force to regenerate it.'
    exit 0
}

$content = Get-Content .env.example -Raw
$content = $content -replace '(?m)^DJANGO_SECRET_KEY=.*$', "DJANGO_SECRET_KEY=$(New-RandomSecret 50)"
$content = $content -replace '(?m)^POSTGRES_PASSWORD=.*$', "POSTGRES_PASSWORD=$(New-RandomSecret 24)"

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $content, $utf8NoBom)

Write-Host '.env created with new secrets. Next: .\scripts\up.ps1'
