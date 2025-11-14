<#
    Génère l’installateur Windows (.exe) pour le client Java « Le Monde de Lila ».

    Usage :
        powershell -ExecutionPolicy Bypass -File .\tools\build-client-exe.ps1 [-SkipBuild]

    Paramètre :
        -SkipBuild : saute Maven (suppose que target\ contient déjà les artéfacts à jour).
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-MavenCommand {
    $mvn = Get-Command mvn -ErrorAction SilentlyContinue
    if ($mvn) { return $mvn.Source }

    $localMaven = Join-Path $PSScriptRoot 'apache-maven-3.9.6\bin\mvn.cmd'
    if (Test-Path $localMaven) { return $localMaven }

    throw "Maven introuvable. Installez-le ou exécutez d'abord start-lila.ps1 pour le provisionner."
}

function Ensure-WiXOnPath {
    $candidates = Get-ChildItem -Path $PSScriptRoot -Directory -Filter 'wix*' -ErrorAction SilentlyContinue
    foreach ($candidate in $candidates) {
        $candle = Join-Path $candidate.FullName 'candle.exe'
        $light  = Join-Path $candidate.FullName 'light.exe'
        if ((Test-Path $candle) -and (Test-Path $light)) {
            if (-not ($env:PATH -split ';' | Where-Object { $_ -eq $candidate.FullName })) {
                $env:PATH = "$($candidate.FullName);$env:PATH"
            }
            return
        }
    }

    if ((Get-Command candle.exe -ErrorAction SilentlyContinue) -and (Get-Command light.exe -ErrorAction SilentlyContinue)) {
        return
    }

    throw "WiX Toolset (candle.exe + light.exe) est requis. Déposez-le dans tools/ ou ajoutez-le au PATH."
}

function Invoke-Step {
    param(
        [string]$Message,
        [scriptblock]$Action
    )
    Write-Host ">> $Message"
    & $Action
}

$repoRoot    = Split-Path -Parent $PSScriptRoot
$javaRoot    = Join-Path $repoRoot 'java-client'
$clientDir   = Join-Path $javaRoot 'client-app'
$targetDir   = Join-Path $clientDir 'target'
$stagingDir  = Join-Path $targetDir 'jpackage-input'
$configDir   = Join-Path $javaRoot 'config'
$distDir     = Join-Path $repoRoot 'dist'
$installerDir= Join-Path $distDir 'installer'

if (!(Test-Path $javaRoot)) {
    throw "Répertoire java-client introuvable."
}

Ensure-WiXOnPath
if (-not (Get-Command jpackage -ErrorAction SilentlyContinue)) {
    throw "jpackage introuvable. Utilisez un JDK 21+ contenant jpackage."
}

$mavenCmd = Get-MavenCommand

if (-not $SkipBuild) {
    Invoke-Step "Compilation Maven (client-app)" {
        Push-Location $javaRoot
        try {
            & $mavenCmd -pl client-app -am clean package -DskipTests
            if ($LASTEXITCODE -ne 0) {
                throw "La compilation Maven a échoué (code $LASTEXITCODE)."
            }
        }
        finally {
            Pop-Location
        }
    }
}
elseif (!(Test-Path $targetDir)) {
    throw "-SkipBuild a été demandé mais aucun dossier target n'existe : $targetDir"
}

$shadedJar = Get-ChildItem -Path $targetDir -Filter 'client-app-*-all.jar' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $shadedJar) {
    $shadedJar = Get-ChildItem -Path $targetDir -Filter 'client-app-*.jar' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $shadedJar) {
    throw "Aucun jar client-app trouvé. Relancez sans -SkipBuild."
}

[xml]$pom = Get-Content (Join-Path $javaRoot 'pom.xml')
$rawVersion = [string]$pom.project.version
if ([string]::IsNullOrWhiteSpace($rawVersion)) { $rawVersion = '1.0.4' }
$appVersion = $rawVersion

New-Item -ItemType Directory -Path $distDir -Force | Out-Null
New-Item -ItemType Directory -Path $installerDir -Force | Out-Null
if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Force -Recurse
}
New-Item -ItemType Directory -Path $stagingDir | Out-Null

Copy-Item -Path $shadedJar.FullName -Destination $stagingDir -Force
if (Test-Path $configDir) {
    Copy-Item -Path $configDir -Destination (Join-Path $stagingDir 'config') -Recurse -Force
}

$appName = 'LeMondeDeLila'
$vendor  = 'Le Monde de Lila'
$description = 'Client officiel accessible'
$modules = 'java.se,jdk.localedata,jdk.crypto.ec,jdk.accessibility'

$commonArgs = @(
    '--name', $appName,
    '--app-version', $appVersion,
    '--vendor', $vendor,
    '--description', $description,
    '--input', $stagingDir,
    '--main-jar', $shadedJar.Name,
    '--main-class', 'com.lemondelila.client.AppLauncher',
    '--dest', $installerDir,
    '--add-modules', $modules,
    '--win-dir-chooser',
    '--win-menu',
    '--win-menu-group', 'Le Monde de Lila',
    '--win-shortcut',
    '--java-options','-Dfile.encoding=UTF-8',
    '--java-options','-Duser.language=fr',
    '--java-options','-Duser.country=FR'
)

Invoke-Step "Création de l'installateur Windows (.exe)" {
    & jpackage @commonArgs '--type' 'exe'
    if ($LASTEXITCODE -ne 0) {
        throw "jpackage a échoué (code $LASTEXITCODE)."
    }
}

$installer = Get-ChildItem -Path $installerDir -Filter '*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host ""
if ($installer) {
    Write-Host "Installateur généré : $($installer.FullName)" -ForegroundColor Green
} else {
    Write-Warning "jpackage a terminé sans générer d'exécutable ?"
}
