$hasNetwork = [string]::IsNullOrWhiteSpace($env:NETWORK_WS_SECRET) -eq $false
$hasWs = [string]::IsNullOrWhiteSpace($env:WS_SHARED_SECRET) -eq $false
$hasJwt = [string]::IsNullOrWhiteSpace($env:JWT_SECRET) -eq $false

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

dotnet run --project client-win/client-win.csproj
