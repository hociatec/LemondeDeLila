param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",

    [switch]$Watch = $true,

    # Hot reload WPF peut planter (Roslyn DeltaMetadataWriter duplicate key).
    # Par défaut, on le désactive pour un "watch" stable.
    [switch]$HotReload = $false
)

# Par défaut, on force un environnement de dev pour les lancements locaux.
# (En prod, définir explicitement DOTNET_ENVIRONMENT=Production.)
if ([string]::IsNullOrWhiteSpace($env:DOTNET_ENVIRONMENT)) {
    $env:DOTNET_ENVIRONMENT = "Development"
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
