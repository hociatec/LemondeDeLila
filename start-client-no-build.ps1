<#
Lance le client Java en (re)construisant un JAR frais, sans lancer les backends.

Pre-requis :
  - JDK accessible dans le PATH.
  - Maven : installe automatiquement tools\apache-maven-3.9.6 si absent du PATH.

Utilisation :
  powershell -ExecutionPolicy Bypass -File .\start-client-no-build.ps1            # build + run
  powershell -ExecutionPolicy Bypass -File .\start-client-no-build.ps1 -SkipBuild # run le dernier JAR trouve
  powershell -ExecutionPolicy Bypass -File .\start-client-no-build.ps1 -JarPath "C:\chemin\client-app-1.2.3-all.jar"

Parametres :
  -JarPath    : chemin vers un JAR deja genere (ignore la recherche auto).
  -JavaOpts   : options JVM supplementaires (par ex. '-DproxyHost=...').
  -SkipBuild  : ne pas lancer Maven (utilise le JAR deja present).
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

function Ensure-Maven {
    param([string]$Root)

    $mvn = Get-Command mvn -ErrorAction SilentlyContinue
    if ($mvn) { return $mvn.Source }

    $toolsDir    = Join-Path $Root 'tools'
    $mavenVer    = '3.9.6'
    $archiveName = "apache-maven-$mavenVer-bin.zip"
    $mavenHome   = Join-Path $toolsDir "apache-maven-$mavenVer"
    $archivePath = Join-Path $toolsDir $archiveName

    if (-not (Test-Path $mavenHome)) {
        if (-not (Test-Path $toolsDir)) {
            New-Item -ItemType Directory -Path $toolsDir | Out-Null
        }

        if (-not (Test-Path $archivePath)) {
            Write-Host "Telechargement de Maven $mavenVer..." -ForegroundColor Cyan
            $uri = "https://archive.apache.org/dist/maven/maven-3/$mavenVer/binaries/$archiveName"
            Invoke-WebRequest -Uri $uri -OutFile $archivePath
        }

        Write-Host "Extraction de Maven..." -ForegroundColor Cyan
        Expand-Archive -Path $archivePath -DestinationPath $toolsDir -Force
    }

    $mvnExe = Join-Path $mavenHome 'bin\mvn.cmd'
    if (-not (Test-Path $mvnExe)) {
        throw "Installation Maven incomplete (fichier $mvnExe introuvable)."
    }

    $env:MAVEN_HOME = $mavenHome
    if (-not (($env:PATH -split ';') -contains "$mavenHome\bin")) {
        $env:PATH = "$mavenHome\bin;$env:PATH"
    }

    Write-Host "Maven disponible : $mvnExe" -ForegroundColor Green
    return $mvnExe
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
        throw "Dossier cible absent : $target. Lancez d'abord la compilation complete."
    }

    $jar = Get-ChildItem -Path $target -Filter 'client-app-*-all.jar' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $jar) {
        throw "Aucun client-app-*-all.jar trouve dans $target. Compilez d'abord (start-lila.ps1 sans -SkipBuild)."
    }
    return $jar.FullName
}

if (-not $SkipBuild -and -not $JarPath) {
    $mvn = Ensure-Maven -Root $root
    Write-Host "Compilation du client (clean package -pl client-app -am -DskipTests)..." -ForegroundColor Cyan
    Push-Location $javaDir
    try {
        & $mvn -pl client-app -am clean package -DskipTests
        if ($LASTEXITCODE -ne 0) {
            throw "La compilation Maven a echoue (code $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }
}

$jarToRun = Resolve-Jar -ExplicitPath $JarPath

Write-Host "Demarrage du client : $jarToRun" -ForegroundColor Cyan
Write-Host "Java    : $($javaCmd.Source)" -ForegroundColor DarkGray

# Forcer UTF-8 pour eviter les libelles corrompus dans l'IHM/lecteur d'ecran.
$baseArgs = @('-Dfile.encoding=UTF-8', '-jar', $jarToRun)
$allArgs  = $baseArgs + $JavaOpts

& $javaCmd.Source @allArgs
if ($LASTEXITCODE -ne 0) {
    throw "Le client s'est termine avec le code $LASTEXITCODE."
}
