#Requires -Version 5.1
<#
.SYNOPSIS
  Runs every quality gate (lint, format, types, migrations, tests, build) inside the containers.
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Invoke-Step([string]$Name, [string[]]$Command) {
    Write-Host ''
    Write-Host "== $Name" -ForegroundColor Cyan
    & docker compose exec -T @Command
    if ($LASTEXITCODE -ne 0) { throw "FAILED: $Name" }
}

Invoke-Step 'backend: ruff lint'        @('backend', 'ruff', 'check', '.')
Invoke-Step 'backend: ruff format'      @('backend', 'ruff', 'format', '--check', '.')
Invoke-Step 'backend: mypy'             @('backend', 'mypy', '.')
Invoke-Step 'backend: migrations'       @('backend', 'python', 'manage.py', 'makemigrations', '--check', '--dry-run')
Invoke-Step 'backend: pytest'           @('backend', 'pytest')
Invoke-Step 'frontend: eslint'          @('frontend', 'npm', 'run', 'lint')
Invoke-Step 'frontend: prettier'        @('frontend', 'npm', 'run', 'format:check')
Invoke-Step 'frontend: typecheck'       @('frontend', 'npm', 'run', 'typecheck')
Invoke-Step 'frontend: vitest'          @('frontend', 'npm', 'test')
Invoke-Step 'frontend: build'           @('frontend', 'npm', 'run', 'build')

Write-Host ''
Write-Host 'All checks passed.' -ForegroundColor Green
