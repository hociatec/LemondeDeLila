<#
    Génère l’installateur Windows (.exe) du client Java Swing “Le Monde de Lila”.

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
if (-not $wixAvailable) {
    throw "WiX Toolset (candle.exe + light.exe) est requis pour générer l'installateur. Téléchargez https://github.com/wixtoolset/wix3 et placez-le dans tools/ ou ajoutez-le au PATH."
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
$installerDest  = Join-Path $distDir 'installer'
if (!(Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}
Initialize-Directory $installerDest
Initialize-Directory $stagingDir

Copy-Item -Path $mainJar.FullName -Destination $stagingDir -Force
Get-ChildItem -Path $dependencyDir -Filter '*.jar' | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $stagingDir -Force
}
if (Test-Path $configDir) {
    Copy-Item -Path $configDir -Destination (Join-Path $stagingDir 'config') -Recurse -Force
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
    '--add-modules', $modules,
    '--win-dir-chooser',
    '--win-menu',
    '--win-menu-group', 'Le Monde de Lila',
    '--win-shortcut'
) + $commonJavaOpts

Invoke-Step "Création de l'installateur Windows (.exe)" {
    & jpackage @commonPackagingArgs `
        '--type' 'exe' `
        '--dest' $installerDest
    if ($LASTEXITCODE -ne 0) {
        throw "jpackage (exe) a échoué (code $LASTEXITCODE)."
    }
}

$installerExe = Get-ChildItem -Path $installerDest -Filter '*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1

Write-Host ""
Write-Host "Installateur généré :" -ForegroundColor Green
if ($installerExe) {
    Write-Host "  $($installerExe.FullName)"
}
