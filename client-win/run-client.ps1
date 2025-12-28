param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",

    [switch]$Watch = $true,

    # Hot reload WPF peut planter (Roslyn DeltaMetadataWriter duplicate key).
    # Par défaut, on le désactive pour un "watch" stable.
    [switch]$HotReload = $false
)

$hasNetwork = -not [string]::IsNullOrWhiteSpace($env:NETWORK_WS_SECRET)
$hasWs = -not [string]::IsNullOrWhiteSpace($env:WS_SHARED_SECRET)
$hasJwt = -not [string]::IsNullOrWhiteSpace($env:JWT_SECRET)

# Par défaut, on force un environnement de dev pour les lancements locaux.
# (En prod, définir explicitement DOTNET_ENVIRONMENT=Production + JWT_STRICT_MODE=true + secrets robustes.)
if ([string]::IsNullOrWhiteSpace($env:DOTNET_ENVIRONMENT)) {
    $env:DOTNET_ENVIRONMENT = "Development"
}
if ([string]::IsNullOrWhiteSpace($env:JWT_STRICT_MODE)) {
    $env:JWT_STRICT_MODE = "false"
}
if ([string]::IsNullOrWhiteSpace($env:LOG_PATH)) {
    $env:LOG_PATH = Join-Path $PSScriptRoot "client\\log"
}
if ([string]::IsNullOrWhiteSpace($env:LOG_LEVEL)) {
    $env:LOG_LEVEL = "Debug"
}

if (-not $hasNetwork) {
    $env:NETWORK_WS_SECRET = "remote-ws-shared-secret-2025"
}
if (-not $hasWs) {
    $env:WS_SHARED_SECRET = $env:NETWORK_WS_SECRET
}
if (-not $hasJwt) {
    $env:JWT_SECRET = "change-me-in-prod"
}

New-Item -ItemType Directory -Force -Path $env:LOG_PATH | Out-Null

Push-Location $PSScriptRoot
try {
    if ($Watch) {
        if ($HotReload) {
            dotnet watch --project ".\\client-win\\client-win.csproj" run -c $Configuration
        }
        else {
            dotnet watch --no-hot-reload --project ".\\client-win\\client-win.csproj" run -c $Configuration
        }
    }
    else {
        dotnet run -c $Configuration --project ".\\client-win\\client-win.csproj"
    }
}
finally {
    Pop-Location
}
