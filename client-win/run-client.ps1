param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",

    [switch]$Watch = $true,

    # Hot reload WPF peut planter (Roslyn DeltaMetadataWriter duplicate key).
    # Par défaut, on le désactive pour un "watch" stable.
    [switch]$HotReload = $false,

    # Force le client à pointer vers un backend local (sans toucher au fichier AppData).
    # Utile pour tester sans impacter le serveur distant.
    [switch]$Local = $false,

    # Port du backend local (NestJS). Par défaut : 3001 (cf backend/.env).
    [int]$BackendPort = 3001,

    # Démarre aussi le backend NestJS dans une autre console (best-effort).
    [switch]$StartBackend = $false
)

# Par défaut, on force un environnement de dev pour les lancements locaux.
# (En prod, définir explicitement DOTNET_ENVIRONMENT=Production.)
if ([string]::IsNullOrWhiteSpace($env:DOTNET_ENVIRONMENT)) {
    $env:DOTNET_ENVIRONMENT = "Development"
}

if ($Local) {
    $base = "127.0.0.1:$BackendPort"

    # Les clés de config sont lues via env avec la règle : network.http.base -> NETWORK_HTTP_BASE
    $env:NETWORK_HTTP_BASE = "http://$base/api/"
    $env:NETWORK_WS_URL = "ws://$base/ws"
    $env:NETWORK_WS_API = "ws://$base/ws/api"
    $env:NETWORK_WS_GAME = "ws://$base/ws/game"
    $env:NETWORK_WS_NOTIFY = "ws://$base/ws/notify"
    $env:NETWORK_WS_PRESENCE = "ws://$base/presence"

    # Empêche tout appel vers l'endpoint de version distant par accident.
    $env:UPDATES_CHECK_URL = "http://$base/client/version"
}

if ($StartBackend) {
    $backendDir = Join-Path $PSScriptRoot "..\\backend"
    if (Test-Path $backendDir) {
        # On utilise une nouvelle console pour garder la sortie du backend visible.
        Start-Process -FilePath "powershell.exe" -WorkingDirectory $backendDir -ArgumentList @(
            "-NoExit",
            "-Command",
            "npm run start:dev"
        ) | Out-Null
    }
    else {
        Write-Warning "Backend introuvable: $backendDir"
    }
}
if ([string]::IsNullOrWhiteSpace($env:LOG_PATH)) {
    $env:LOG_PATH = Join-Path $PSScriptRoot "client\\log"
}
if ([string]::IsNullOrWhiteSpace($env:LOG_LEVEL)) {
    $env:LOG_LEVEL = "Debug"
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
