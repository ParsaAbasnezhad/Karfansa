#Requires -Version 5.1
<#
.SYNOPSIS
  Builds and starts the whole development stack, waits until it is healthy, applies migrations.
#>
param([switch]$SkipMigrate)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path .env)) { throw '.env not found. Run .\scripts\setup.ps1 first.' }

docker compose up -d --build --wait
if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed. Check: docker compose logs' }

if (-not $SkipMigrate) {
    docker compose exec backend python manage.py migrate --noinput
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
}

Write-Host ''
Write-Host 'Karfansa is running:'
Write-Host '  Site          http://localhost:5173'
Write-Host '  API docs      http://localhost:8000/api/v1/docs'
