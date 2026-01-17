[CmdletBinding()]
param(
    # Dossier de publication (partage réseau ou dossier synchronisé vers un serveur HTTP).
    [Parameter(Mandatory = $true)]
    [string]$PublishDir,

    # URL publique correspondant à PublishDir (pour que ClickOnce pointe vers HTTPS).
    # Exemple : https://api.lilas.hociatec.fr/updates/client-win/
    [string]$BaseUrl,

    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",

    # Version ClickOnce (ex: 1.2.0.0). Si non fourni, utilise la version du .csproj.
    [string]$Version
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
    "/p:UpdateEnabled=true",
    "/p:UpdateMode=Background",
    "/p:UpdateInterval=0",
    "/p:UpdateIntervalUnits=Days",
    "/p:PublishDir=$PublishDir\",
    "/p:PublishUrl=$PublishDir\"
)

function Normalize-Version4([string]$v) {
    $raw = ($v ?? "").Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    $parts = $raw.Split(".") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    if ($parts.Length -lt 1 -or $parts.Length -gt 4) { return $null }
    foreach ($p in $parts) {
        if ($p -notmatch '^\d+$') { return $null }
    }
    while ($parts.Length -lt 4) { $parts += "0" }
    return ($parts -join ".")
}

function Get-Project-Version([string]$csprojPath) {
    try {
        [xml]$xml = Get-Content $csprojPath
        $v = $xml.Project.PropertyGroup.Version | Select-Object -First 1
        return ($v ?? "").Trim()
    } catch {
        return ""
    }
}

$verBase = if (-not [string]::IsNullOrWhiteSpace($Version)) { $Version } else { (Get-Project-Version $project) }
$ver4 = Normalize-Version4 $verBase
if (-not [string]::IsNullOrWhiteSpace($ver4)) {
    Write-Host "Version ClickOnce -> $ver4"
    $msbuildProps += @(
        "/p:ApplicationVersion=$ver4",
        "/p:Version=$ver4",
        "/p:AssemblyVersion=$ver4",
        "/p:FileVersion=$ver4"
    )
}

if (-not [string]::IsNullOrWhiteSpace($BaseUrl)) {
    if (-not $BaseUrl.EndsWith('/')) { $BaseUrl = "$BaseUrl/" }
    Write-Host "BaseUrl ClickOnce -> $BaseUrl"
    $msbuildProps += @(
        "/p:InstallFrom=Web",
        "/p:IsWebBootstrapper=true",
        "/p:InstallUrl=$BaseUrl",
        "/p:UpdateUrl=$BaseUrl"
    )
}

dotnet publish $project -c $Configuration @msbuildProps

if ($LASTEXITCODE -ne 0) {
    throw "Echec de publication ClickOnce ($LASTEXITCODE)"
}

Write-Host "OK. Donne aux testeurs le setup dans : $PublishDir"
