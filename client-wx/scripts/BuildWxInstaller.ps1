param(
    [Parameter(Mandatory = $true)][string]$PayloadDir,
    [Parameter(Mandatory = $true)][string]$OutputDir,
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$IsccPath = ''
)

$ErrorActionPreference = 'Stop'
$payload = (Resolve-Path -LiteralPath $PayloadDir).Path
$output = [IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $output | Out-Null

if (!(Test-Path -LiteralPath (Join-Path $payload 'lila_launcher.exe'))) {
    throw 'Payload installateur invalide: lila_launcher.exe absent.'
}

if ([string]::IsNullOrWhiteSpace($IsccPath)) {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    )
    $IsccPath = ($candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1)
}
if ([string]::IsNullOrWhiteSpace($IsccPath) -or !(Test-Path -LiteralPath $IsccPath)) {
    throw 'ISCC.exe introuvable. Installez Inno Setup avant de construire l installateur.'
}

$script = Join-Path $PSScriptRoot '..\packaging\LeMondeDeLilaWX.iss'
$baseName = "LeMondeDeLilaWX-$Version-Setup"
$isccOutput = & $IsccPath `
    "/DAppVersion=$Version" `
    "/DSourceDir=$payload" `
    "/DOutputDir=$output" `
    "/DOutputBaseFilename=$baseName" `
    $script 2>&1
$isccExitCode = $LASTEXITCODE
$isccOutput | ForEach-Object { Write-Host $_ }
if ($isccExitCode -ne 0) {
    throw "Compilation Inno Setup echouee avec le code $isccExitCode."
}

$installer = Join-Path $output "$baseName.exe"
if (!(Test-Path -LiteralPath $installer)) {
    throw 'Installateur WX absent après compilation Inno Setup.'
}

[pscustomobject]@{
    InstallerExe = $installer
    Sha256 = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
    Size = (Get-Item -LiteralPath $installer).Length
} | ConvertTo-Json
