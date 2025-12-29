[CmdletBinding()]
param(
    # Dossier de publication (partage réseau ou dossier synchronisé vers un serveur HTTP).
    [Parameter(Mandatory = $true)]
    [string]$PublishDir,

    # URL publique correspondant à PublishDir (pour que ClickOnce pointe vers HTTPS).
    # Exemple : https://api.lilas.hociatec.fr/updates/client-win/
    [string]$BaseUrl,

    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root 'client-win\client-win.csproj'

if (-not (Test-Path $project)) {
    throw "Projet introuvable : $project"
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "dotnet est requis (SDK .NET 8+)."
}

New-Item -ItemType Directory -Force -Path $PublishDir | Out-Null

Write-Host "Publication ClickOnce -> $PublishDir"

$msbuildProps = @(
    "/p:PublishProfile=ClickOnce",
    "/p:PublishDir=$PublishDir\"
)

if (-not [string]::IsNullOrWhiteSpace($BaseUrl)) {
    if (-not $BaseUrl.EndsWith('/')) { $BaseUrl = "$BaseUrl/" }
    Write-Host "BaseUrl ClickOnce -> $BaseUrl"
    $msbuildProps += @(
        "/p:InstallFrom=Web",
        "/p:IsWebBootstrapper=true",
        "/p:PublishUrl=$BaseUrl",
        "/p:InstallUrl=$BaseUrl",
        "/p:UpdateUrl=$BaseUrl"
    )
}

dotnet publish $project -c $Configuration @msbuildProps

if ($LASTEXITCODE -ne 0) {
    throw "Echec de publication ClickOnce ($LASTEXITCODE)"
}

Write-Host "OK. Donne aux testeurs le setup dans : $PublishDir"
