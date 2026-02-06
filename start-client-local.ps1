param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",

    # Port du backend démarré dans WSL.
    [int]$BackendPort = 3001,

    # Lance l'app ClickOnce (raccourci .appref-ms) si trouvée.
    [switch]$PreferClickOnce = $false
)

$ErrorActionPreference = "Stop"

$base = "127.0.0.1:$BackendPort"

# Forcer le client à pointer vers le backend local, même si c'est une build "Production".
# (ClientConfiguration lit maintenant les env vars en priorité.)
$env:NETWORK_HTTP_BASE = "http://$base/api/"
$env:NETWORK_WS_URL = "ws://$base/ws"
$env:NETWORK_WS_API = "ws://$base/ws/api"
$env:NETWORK_WS_GAME = "ws://$base/ws/game"
$env:NETWORK_WS_NOTIFY = "ws://$base/ws/notify"
$env:NETWORK_WS_PRESENCE = "ws://$base/presence"

Write-Host "[local-client] endpoints -> $base"

function Find-ClickOnceAppRef {
    $startMenuUser = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
    $startMenuAll = Join-Path $env:PROGRAMDATA "Microsoft\Windows\Start Menu\Programs"
    $roots = @($startMenuUser, $startMenuAll)
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        $candidate = Get-ChildItem -Path $root -Recurse -Filter "*.appref-ms" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "Le Monde de Lila|LeMondeDeLila|lila" } |
            Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }
    return $null
}

if ($PreferClickOnce) {
    $appRef = Find-ClickOnceAppRef
    if ($appRef) {
        Write-Host "[local-client] launching ClickOnce: $appRef"
        Start-Process -FilePath $appRef | Out-Null
        exit 0
    }
    Write-Warning "[local-client] ClickOnce (.appref-ms) introuvable, fallback sur dotnet run."
}

$clientRunner = Join-Path $PSScriptRoot "client-win\run-client.ps1"
if (-not (Test-Path $clientRunner)) {
    throw "Script introuvable: $clientRunner"
}

Write-Host "[local-client] launching from source: $clientRunner ($Configuration)"
& $clientRunner -Configuration $Configuration -Watch:$false -Local -BackendPort $BackendPort -StartBackend:$false
