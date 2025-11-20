<#
Lance le client Java en (re)construisant un JAR frais, sans lancer les backends.

Pré-requis :
  - JDK accessible dans le PATH.
  - Maven accessible dans le PATH (utilisé pour (re)générer le JAR).

Utilisation :
  powershell -ExecutionPolicy Bypass -File .\start-client-no-build.ps1            # build + run
  powershell -ExecutionPolicy Bypass -File .\start-client-no-build.ps1 -SkipBuild # run le dernier JAR trouvé
  powershell -ExecutionPolicy Bypass -File .\start-client-no-build.ps1 -JarPath "C:\chemin\client-app-1.2.3-all.jar"

Paramètres :
  -JarPath    : chemin vers un JAR déjà généré (ignore la recherche auto).
  -JavaOpts   : options JVM supplémentaires (par ex. '-DproxyHost=...').
  -SkipBuild  : ne pas lancer Maven (utilise le JAR déjà présent).
#>
[CmdletBinding()]
param(
    [string]$JarPath,
    [string[]]$JavaOpts = @(),
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$target  = Join-Path $root 'java-client\client-app\target'
$javaDir = Join-Path $root 'java-client'

$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCmd) {
    throw "Java introuvable dans le PATH. Installez un JDK (21+) puis relancez."
}

function Resolve-Maven {
    $mvn = Get-Command mvn -ErrorAction SilentlyContinue
    if (-not $mvn) {
        throw "Maven introuvable dans le PATH. Installez Maven ou ajoutez-le au PATH."
    }
    return $mvn.Source
}

function Resolve-Jar {
    param([string]$ExplicitPath)
    if ($ExplicitPath) {
        if (-not (Test-Path $ExplicitPath)) {
            throw "JAR introuvable : $ExplicitPath"
        }
        return (Resolve-Path $ExplicitPath).Path
    }

    if (-not (Test-Path $target)) {
        throw "Dossier cible absent : $target. Lancez d'abord la compilation complète."
    }

    $jar = Get-ChildItem -Path $target -Filter 'client-app-*-all.jar' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $jar) {
        throw "Aucun client-app-*-all.jar trouvé dans $target. Compilez d'abord (start-lila.ps1 sans -SkipBuild)."
    }
    return $jar.FullName
}

if (-not $SkipBuild -and -not $JarPath) {
    $mvn = Resolve-Maven
    Write-Host "Compilation du client (clean package -pl client-app -am -DskipTests)..." -ForegroundColor Cyan
    Push-Location $javaDir
    try {
        & $mvn -pl client-app -am clean package -DskipTests
        if ($LASTEXITCODE -ne 0) {
            throw "La compilation Maven a échoué (code $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }
}

$jarToRun = Resolve-Jar -ExplicitPath $JarPath

Write-Host "Démarrage du client : $jarToRun" -ForegroundColor Cyan
Write-Host "Java    : $($javaCmd.Source)" -ForegroundColor DarkGray

# Forcer UTF-8 pour éviter les libellés corrompus dans l'IHM/lecteur d'écran.
$baseArgs = @('-Dfile.encoding=UTF-8', '-jar', $jarToRun)
$allArgs  = $baseArgs + $JavaOpts

& $javaCmd.Source @allArgs
if ($LASTEXITCODE -ne 0) {
    throw "Le client s'est terminé avec le code $LASTEXITCODE."
}
