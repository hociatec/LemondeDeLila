<#
    Génère les livrables Windows (app-image portable + installateur .exe)
    pour le client Java Swing “Le Monde de Lila”.

    Usage :
        powershell -ExecutionPolicy Bypass -File .\tools\build-client-exe.ps1

    Paramètres :
        -SkipBuild : n’exécute pas Maven (suppose que target\ est déjà prêt).
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param(
        [string]$Message,
        [scriptblock]$Action
    )
    Write-Host ">> $Message"
    & $Action
}

function Initialize-Directory {
    param([string]$Path)
    if (Test-Path $Path) {
        Remove-Item -Path $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Path | Out-Null
}

$toolsDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Split-Path -Parent $toolsDir
$javaClient = Join-Path $repoRoot 'java-client'
$clientDir  = Join-Path $javaClient 'client-app'
$targetDir  = Join-Path $clientDir 'target'
$dependencyDir = Join-Path $targetDir 'dependency'
$stagingDir    = Join-Path $targetDir 'jpackage-input'
$configDir  = Join-Path $javaClient 'config'

$wixAvailable = $false
$wixLocalDirs = Get-ChildItem -Path $toolsDir -Directory -Filter 'wix*' -ErrorAction SilentlyContinue
foreach ($dir in $wixLocalDirs) {
    $candlePath = Join-Path $dir.FullName 'candle.exe'
    $lightPath  = Join-Path $dir.FullName 'light.exe'
    if ((Test-Path $candlePath) -and (Test-Path $lightPath)) {
        if (-not ($env:PATH -split ';' | Where-Object { $_ -eq $dir.FullName })) {
            $env:PATH = "$($dir.FullName);$env:PATH"
        }
        $wixAvailable = $true
        break
    }
}
if (-not $wixAvailable) {
    $wixAvailable = (Get-Command candle.exe -ErrorAction SilentlyContinue) -and (Get-Command light.exe -ErrorAction SilentlyContinue)
}

if (-not (Get-Command jpackage -ErrorAction SilentlyContinue)) {
    throw "jpackage introuvable. Assurez-vous d'utiliser un JDK 14+ (ici JDK 21 est requis)."
}

if (-not $SkipBuild) {
    Invoke-Step "Compilation Maven (client-app)" {
        Push-Location $javaClient
        try {
            & mvn -pl client-app -am clean package -DskipTests
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
    throw "-SkipBuild a été spécifié mais aucun répertoire target n'existe : $targetDir"
}

if (!(Test-Path $dependencyDir)) {
    throw "Le dossier des dépendances est introuvable ($dependencyDir). Relancez le script sans -SkipBuild."
}

$mainJar = Get-ChildItem -Path $targetDir -Filter 'client-app-*.jar' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $mainJar) {
    throw "Aucun jar client-app n'a été trouvé dans $targetDir. Assurez-vous que le build Maven a abouti."
}

[xml]$clientPom = Get-Content (Join-Path $javaClient 'pom.xml')
$rawVersion = [string]$clientPom.project.version
if ([string]::IsNullOrWhiteSpace($rawVersion)) { $rawVersion = '1.0.0-SNAPSHOT' }
$appVersion = $rawVersion -replace '-SNAPSHOT',''
if ([string]::IsNullOrWhiteSpace($appVersion)) { $appVersion = '1.0.0' }

$distDir        = Join-Path $repoRoot 'dist'
$appImageDest   = Join-Path $distDir 'app-image'
$installerDest  = Join-Path $distDir 'installer'
if (!(Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}
Initialize-Directory $appImageDest
Initialize-Directory $installerDest
Initialize-Directory $stagingDir

Copy-Item -Path $mainJar.FullName -Destination $stagingDir -Force
Get-ChildItem -Path $dependencyDir -Filter '*.jar' | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $stagingDir -Force
}

$appName    = 'LeMondeDeLila'
$vendor     = 'Le Monde de Lila'
$description= 'Client officiel Le Monde de Lila (mode distant)'
$modules    = 'java.se,jdk.localedata,jdk.crypto.ec,jdk.accessibility'

$commonJavaOpts = @(
    '--java-options','-Dfile.encoding=UTF-8',
    '--java-options','-Duser.language=fr',
    '--java-options','-Duser.country=FR'
)

$commonPackagingArgs = @(
    '--name', $appName,
    '--vendor', $vendor,
    '--app-version', $appVersion,
    '--description', $description,
    '--input', $stagingDir,
    '--main-jar', $mainJar.Name,
    '--main-class', 'com.lemondelila.client.AppLauncher',
    '--add-modules', $modules
) + $commonJavaOpts

Invoke-Step "Génération de l'image applicative portable" {
    & jpackage @commonPackagingArgs `
        '--type' 'app-image' `
        '--dest' $appImageDest
    if ($LASTEXITCODE -ne 0) {
        throw "jpackage (app-image) a échoué (code $LASTEXITCODE)."
    }
}

$appImagePath = Join-Path $appImageDest $appName

if (Test-Path $configDir) {
    Copy-Item -Path $configDir -Destination (Join-Path $appImagePath 'config') -Recurse -Force
}

if ($wixAvailable) {
    Invoke-Step "Création de l'installateur Windows (.exe)" {
        & jpackage `
            '--type' 'exe' `
            '--name' $appName `
            '--vendor' $vendor `
            '--app-version' $appVersion `
            '--description' $description `
            '--app-image' $appImagePath `
            '--dest' $installerDest `
            '--win-dir-chooser' `
            '--win-menu' `
            '--win-menu-group' 'Le Monde de Lila' `
            '--win-shortcut'
        if ($LASTEXITCODE -ne 0) {
            throw "jpackage (exe) a échoué (code $LASTEXITCODE)."
        }
    }
}
else {
    Write-Warning "WiX Toolset introuvable (candle.exe / light.exe). Seule l'image portable a été produite."
}

$portableExe = Join-Path $appImagePath ($appName + '.exe')
$installerExe = $null
if ($wixAvailable) {
    $installerExe = Get-ChildItem -Path $installerDest -Filter '*.exe' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

Write-Host ""
Write-Host "Livrables générés :" -ForegroundColor Green
if (Test-Path $portableExe) {
    Write-Host "  - Application portable : $portableExe"
}
if ($installerExe) {
    Write-Host "  - Installateur         : $($installerExe.FullName)"
}
Write-Host ""
Write-Host "Copiez le dossier 'config' ou laissez l'application créer ses préférences dans $appName\config\settings.json lors du premier lancement."
