param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    [int]$BackendPort = 3001,
    [switch]$PreferClickOnce = $false
)

$ErrorActionPreference = "Stop"

# Enable detailed focus tracing in GameFocusCoordinator.
$env:LILA_FOCUS_LOGS = "1"
Write-Host "[focus-validation] LILA_FOCUS_LOGS=1"

$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $root "start-client-local.ps1"
if (-not (Test-Path $runner))
{
    throw "Script introuvable: $runner"
}

Write-Host "[focus-validation] Launching client..."
& $runner -Configuration $Configuration -BackendPort $BackendPort -PreferClickOnce:$PreferClickOnce
