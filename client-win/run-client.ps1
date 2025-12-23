$hasNetwork = [string]::IsNullOrWhiteSpace($env:NETWORK_WS_SECRET) -eq $false
$hasWs = [string]::IsNullOrWhiteSpace($env:WS_SHARED_SECRET) -eq $false
$hasJwt = [string]::IsNullOrWhiteSpace($env:JWT_SECRET) -eq $false

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
