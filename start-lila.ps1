<#
    Script de démarrage « one-click » pour Le Monde de Lila.

    Ce script :
      1. Vérifie (et installe si besoin) Maven 3.9.6 dans tools\.
      2. Optionnellement installe les dépendances PHP (si vendor absent et composer disponible).
      3. Lance le serveur HTTP Symfony (php -S) et le serveur WebSocket app:realtime:serve.
      4. Construit le client Java Swing (Maven multi-modules) et copie les dépendances runtime.
      5. Lance l'application Swing automatiquement.
      6. Ferme proprement les processus backend à la fermeture de l'application Java.

    Utilisation :
        powershell -ExecutionPolicy Bypass -File .\start-lila.ps1

    Paramètres :
        -SkipBackend   : ne lance pas les serveurs backend (suppose déjà lancés).
        -SkipRealtime  : ne lance pas le serveur WebSocket.
        -SkipBuild     : saute la compilation Maven (suppose target\ déjà initialisé).
#>
[CmdletBinding()]
param(
    [switch]$SkipBackend,
    [switch]$SkipRealtime,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$rootDirectory   = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDirectory = Join-Path $rootDirectory 'backend'
$javaDirectory    = Join-Path $rootDirectory 'java-client'
$logDirectory     = Join-Path $rootDirectory 'logs'

if (!(Test-Path $backendDirectory)) { throw "Répertoire backend introuvable : $backendDirectory" }
if (!(Test-Path $javaDirectory)) { throw "Répertoire java-client introuvable : $javaDirectory" }
if (!(Test-Path $logDirectory)) { New-Item -ItemType Directory -Path $logDirectory | Out-Null }

function Ensure-Maven {
    param(
        [string]$Root
    )

    $mavenCmd = Get-Command mvn -ErrorAction SilentlyContinue
    if ($mavenCmd) {
        Write-Host "Maven détecté : $($mavenCmd.Source)"
        return $mavenCmd.Source
    }

    $toolsDir    = Join-Path $Root 'tools'
    $mavenVer    = '3.9.6'
    $archiveName = "apache-maven-$mavenVer-bin.zip"
    $mavenHome   = Join-Path $toolsDir "apache-maven-$mavenVer"
    $archivePath = Join-Path $toolsDir $archiveName

    if (!(Test-Path $mavenHome)) {
        if (!(Test-Path $toolsDir)) {
            New-Item -ItemType Directory -Path $toolsDir | Out-Null
        }

        if (!(Test-Path $archivePath)) {
            Write-Host "Téléchargement de Maven $mavenVer..."
            $uri = "https://archive.apache.org/dist/maven/maven-3/$mavenVer/binaries/$archiveName"
            Invoke-WebRequest -Uri $uri -OutFile $archivePath
        }

        Write-Host "Extraction de Maven..."
        Expand-Archive -Path $archivePath -DestinationPath $toolsDir -Force
    }

    $mvnExe = Join-Path $mavenHome 'bin\mvn.cmd'
    if (!(Test-Path $mvnExe)) { throw "Installation Maven incomplète (fichier $mvnExe introuvable)." }

    $env:MAVEN_HOME = $mavenHome
    if (-not ($env:PATH -split ';' | Where-Object { $_ -eq "$mavenHome\bin" })) {
        $env:PATH = "$mavenHome\bin;$env:PATH"
    }

    Write-Host "Maven installé localement : $mvnExe"
    return $mvnExe
}

function Ensure-PHPDependencies {
    param(
        [string]$BackendDir
    )

    $vendorAutoload = Join-Path $BackendDir 'vendor\autoload.php'
    if (Test-Path $vendorAutoload) { return }

    $composer = Get-Command composer -ErrorAction SilentlyContinue
    if (!$composer) {
        Write-Warning "Vendor manquant et Composer introuvable. Installez les dépendances PHP manuellement."
        return
    }

    Write-Host "Installation des dépendances PHP (composer install)..."
    & $composer.Source install --no-interaction --working-dir $BackendDir
}

function Start-BackendHttp {
    param(
        [string]$BackendDir,
        [string]$PhpPath,
        [string]$LogDir
    )

    Write-Host "Lancement du serveur HTTP (http://127.0.0.1:8000)..."
    $stdout = Join-Path $LogDir 'backend-http.log'
    $stderr = Join-Path $LogDir 'backend-http.err.log'
    return Start-Process -FilePath $PhpPath `
        -ArgumentList '-S','127.0.0.1:8000','-t','public' `
        -WorkingDirectory $BackendDir `
        -PassThru `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden
}

function Start-RealtimeServer {
    param(
        [string]$BackendDir,
        [string]$PhpPath,
        [string]$LogDir
    )

    Write-Host "Lancement du serveur WebSocket..."
    $stdout = Join-Path $LogDir 'backend-realtime.log'
    $stderr = Join-Path $LogDir 'backend-realtime.err.log'
    $arguments = @('bin/console','app:realtime:serve','--env=dev')
    return Start-Process -FilePath $PhpPath `
        -ArgumentList $arguments `
        -WorkingDirectory $BackendDir `
        -PassThru `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden
}

function Wait-ForEndpoint {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 45
    )

    Write-Host "Attente de disponibilité de $Url ..."
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            Write-Host "Endpoint disponible."
            return
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    throw "Impossible de joindre $Url après $TimeoutSeconds secondes."
}

Set-Location $rootDirectory

$mavenPath = Ensure-Maven -Root $rootDirectory
Ensure-PHPDependencies -BackendDir $backendDirectory

$phpCmd = Get-Command php -ErrorAction SilentlyContinue
if (!$phpCmd -and -not $SkipBackend) {
    throw "PHP CLI introuvable. Ajoutez PHP au PATH avant d'exécuter ce script."
}
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if (!$javaCmd) {
    throw "Java CLI introuvable. Installez un JDK (21+) et ajoutez-le au PATH."
}

$backendProcess = $null
$realtimeProcess = $null

$javaLocationPushed = $false
try {
    if (-not $SkipBackend) {
        $backendProcess = Start-BackendHttp -BackendDir $backendDirectory -PhpPath $phpCmd.Source -LogDir $logDirectory
        Wait-ForEndpoint -Url 'http://127.0.0.1:8000/'
        Write-Host "Serveur HTTP backend démarré."
    }

    if ((-not $SkipRealtime) -and $phpCmd) {
        $realtimeProcess = Start-RealtimeServer -BackendDir $backendDirectory -PhpPath $phpCmd.Source -LogDir $logDirectory
        Start-Sleep -Seconds 2
    }

    Push-Location $javaDirectory
    $javaLocationPushed = $true

    if (-not $SkipBuild) {
        Write-Host "Compilation du client Java..."
        & $mavenPath clean package -DskipTests
        if ($LASTEXITCODE -ne 0) {
            throw "La compilation Maven a echoue (code $LASTEXITCODE). Consultez les logs ci-dessus."
        }
        # Copier les dependances runtime du module client-app uniquement (sinon l'agregateur n'en produit aucune)
        & $mavenPath -pl client-app dependency:copy-dependencies -DincludeScope=runtime -DoutputDirectory=client-app\target\dependency
        if ($LASTEXITCODE -ne 0) {
            throw "La copie des dependances a echoue (code $LASTEXITCODE)."
        }
    }

    $appLauncherClass = Join-Path $javaDirectory 'client-app\target\classes\com\lemondelila\client\AppLauncher.class'
    if (!(Test-Path $appLauncherClass)) {
        throw "Compilation incomplete : $appLauncherClass introuvable. Relancez le script sans -SkipBuild."
    }

    # ✅ Ajout de tous les modules au classpath
    $moduleClassDirs = @(
        Join-Path $javaDirectory 'framework-core\target\classes'
        Join-Path $javaDirectory 'framework-ui\target\classes'
        Join-Path $javaDirectory 'framework-access\target\classes'
        Join-Path $javaDirectory 'framework-network\target\classes'
        Join-Path $javaDirectory 'framework-media\target\classes'
        Join-Path $javaDirectory 'client-app\target\classes'
    ) | Where-Object { Test-Path $_ }

    $dependencyDir = Join-Path $javaDirectory 'client-app\target\dependency'
    if (!(Test-Path $dependencyDir)) {
        New-Item -ItemType Directory -Path $dependencyDir -Force | Out-Null
    }

    $classPathEntries = $moduleClassDirs + (Join-Path $dependencyDir '*')
    $classPath = ($classPathEntries -join ';')

    Write-Host "Démarrage du client Swing..."
    & $javaCmd.Source -cp $classPath com.lemondelila.client.AppLauncher

}
finally {
    if ($javaLocationPushed) { Pop-Location }

    if ($realtimeProcess -and -not $realtimeProcess.HasExited) {
        Write-Host "Arrêt du serveur WebSocket..."
        try { $realtimeProcess.Kill() } catch {}
    }

    if ($backendProcess -and -not $backendProcess.HasExited) {
        Write-Host "Arrêt du serveur HTTP..."
        try { $backendProcess.Kill() } catch {}
    }

    Set-Location $rootDirectory
}
