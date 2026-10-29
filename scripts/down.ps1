#Requires -Version 5.1
<#
.SYNOPSIS
  Stops the stack. Data is kept. Add -Reset to also delete the database and node_modules volumes.
#>
param([switch]$Reset)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if ($Reset) { docker compose down --volumes } else { docker compose down }
