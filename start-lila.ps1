<#
    Script de dÃ©marrage Â« one-click Â» pour Le Monde de Lila.

    Ce script :
      1. VÃ©rifie (et installe si besoin) Maven 3.9.6 dans tools\.
      2. Optionnellement installe les dÃ©pendances PHP (si vendor absent et composer disponible).
      3. Lance le serveur HTTP Symfony (php -S) et le serveur WebSocket app:realtime:serve.
      4. Construit le client Java Swing (Maven) et copie les dÃ©pendances runtime.
      5. Lance l'application Swing (`java --module-path ... --add-modules ...`).
      6. Ferme proprement les processus backend Ã  la fermeture de l'application Java.

    Utilisation :
        powershell -ExecutionPolicy Bypass -File .\start-lila.ps1

    ParamÃ¨tres :
        -SkipBackend   : n lance pas les serveurs backend (suppose dÃ©jÃ  lancÃ©s).
        -SkipRealtime  : n lance pas le serveur WebSocket.
        -SkipBuild     : saute la compilation Maven (suppose target\ dÃ©jÃ  initialisÃ©).
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

if (!(Test-Path $backendDirectory)) { throw "RÃ©pertoire backend introuvable : $backendDirectory" }
if (!(Test-Path $javaDirectory)) { throw "RÃ©pertoire java-client introuvable : $javaDirectory" }
if (!(Test-Path $logDirectory)) { New-Item -ItemType Directory -Path $logDirectory | Out-Null }

function Ensure-Maven {
    param(
        [string]$Root
    )

    $mavenCmd = Get-Command mvn -ErrorAction SilentlyContinue
    if ($mavenCmd) {
        Write-Host "Maven dÃ©tectÃ© : $($mavenCmd.Source)"
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
            Write-Host "TÃ©lÃ©chargement de Maven $mavenVer..."
            $uri = "https://archive.apache.org/dist/maven/maven-3/$mavenVer/binaries/$archiveName"
            Invoke-WebRequest -Uri $uri -OutFile $archivePath
        }

        Write-Host "Extraction de Maven..."
        Expand-Archive -Path $archivePath -DestinationPath $toolsDir -Force
    }

    $mvnExe = Join-Path $mavenHome 'bin\mvn.cmd'
    if (!(Test-Path $mvnExe)) { throw "Installation Maven incomplÃ¨te (fichier $mvnExe introuvable)." }

    $env:MAVEN_HOME = $mavenHome
    if (-not ($env:PATH -split ';' | Where-Object { $_ -eq "$mavenHome\bin" })) {
        $env:PATH = "$mavenHome\bin;$env:PATH"
    }

    Write-Host "Maven installÃ© localement : $mvnExe"
    return $mvnExe
}

function Ensure-PHPDependencies {
    param(
        [string]$BackendDir
    )

    $vendorAutoload = Join-Path $BackendDir 'vendor\autoload.php'
    if (Test-Path $vendorAutoload) {
        return
    }

    $composer = Get-Command composer -ErrorAction SilentlyContinue
    if (!$composer) {
        Write-Warning "Vendor manquant et Composer introuvable. Installez les dÃ©pendances PHP manuellement."
        return
    }

    Write-Host "Installation des dÃ©pendances PHP (composer install)..."
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

    Write-Host "Lancement du serveur WebSocket (app:realtime:serve)..."
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

    Write-Host "Attente de disponibilitÃ© de $Url ..."
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            $statusCode = if ($response.StatusCode) { [int]$response.StatusCode } else { 200 }
            Write-Host "Endpoint disponible (HTTP $statusCode)."
            return
        } catch {
            $httpResponse = $_.Exception.Response
            if ($httpResponse) {
                $statusCode = [int]$httpResponse.StatusCode
                if ($statusCode -lt 500) {
                    Write-Host "Endpoint joignable (HTTP $statusCode)."
                    return
                }
            }
            Start-Sleep -Seconds 1
        }
    }
    throw "Impossible de joindre $Url aprÃ¨s $TimeoutSeconds secondes."
}

Set-Location $rootDirectory

$mavenPath = Ensure-Maven -Root $rootDirectory
Ensure-PHPDependencies -BackendDir $backendDirectory

$phpCmd = Get-Command php -ErrorAction SilentlyContinue
if (!$phpCmd -and -not $SkipBackend) {
    throw "PHP CLI introuvable. Ajoutez PHP (WAMP/XAMPP) au PATH avant d'exÃ©cuter ce script."
}
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if (!$javaCmd) {
    throw "Java CLI introuvable. Installez un JDK (21+) et ajoutez-le au PATH avant d'exécuter ce script."
}

$backendProcess = $null
$realtimeProcess = $null

$javaLocationPushed = $false
try {
    if (-not $SkipBackend) {
        $backendProcess = Start-BackendHttp -BackendDir $backendDirectory -PhpPath $phpCmd.Source -LogDir $logDirectory
        Wait-ForEndpoint -Url 'http://127.0.0.1:8000/'
        if ($backendProcess -and -not $backendProcess.HasExited) {
            Write-Host "Serveur HTTP backend demarre (PID $($backendProcess.Id))."
        } else {
            Write-Host "Serveur HTTP backend demarre."
        }
    } else {
        Write-Host "Serveur HTTP non lancÃ© (option -SkipBackend)."
    }

    if ((-not $SkipRealtime) -and $phpCmd) {
        $realtimeProcess = Start-RealtimeServer -BackendDir $backendDirectory -PhpPath $phpCmd.Source -LogDir $logDirectory
        Start-Sleep -Seconds 2
    } elseif ($SkipRealtime) {
        Write-Host "Serveur WebSocket non lancÃ© (option -SkipRealtime)."
    }

    Push-Location $javaDirectory
    $javaLocationPushed = $true
    if (-not $SkipBuild) {
        Write-Host "Compilation du client Java..."
        & $mavenPath clean package -DskipTests
        if ($LASTEXITCODE -ne 0) {
            throw "Erreur Maven (package). Code $LASTEXITCODE"
        }
        Write-Host "Copie des dépendances runtime..."
        & $mavenPath dependency:copy-dependencies -DincludeScope=runtime -DoutputDirectory=target/dependency
        if ($LASTEXITCODE -ne 0) {
            throw "Erreur Maven (dependency:copy-dependencies). Code $LASTEXITCODE"
        }
    } else {
        Write-Host "Compilation Maven ignorée (option -SkipBuild)."
    }

    $classDir = Join-Path $javaDirectory 'target\classes'
    if (!(Test-Path $classDir)) {
        throw "Le dossier $classDir est introuvable. Lancez le script sans -SkipBuild pour initialiser le client."
    }

    $dependencyDir = Join-Path $javaDirectory 'target\dependency'
    if (!(Test-Path $dependencyDir)) {
        # Maven ne crée pas ce dossier quand aucune dépendance runtime n'est copiée.
        New-Item -ItemType Directory -Path $dependencyDir -Force | Out-Null
    }

    $classPathEntries = @($classDir)
    $classPathEntries += (Join-Path $dependencyDir '*')
    $classPath = ($classPathEntries -join ';')

    $javaArgs = @()
    $javaArgs += '-cp'
    $javaArgs += $classPath
    $javaArgs += 'com.lemondelila.client.AppLauncher'

    Write-Host "Démarrage du client Swing..."
    & $javaCmd.Source @javaArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Erreur Java (client Swing). Code $LASTEXITCODE"
    }
}
finally {
    if ($javaLocationPushed) {
        Pop-Location
    }

    if ($realtimeProcess -and -not $realtimeProcess.HasExited) {
        Write-Host "ArrÃªt du serveur WebSocket (PID $($realtimeProcess.Id))..."
        try { $realtimeProcess.Kill() } catch {}
    }

    if ($backendProcess -and -not $backendProcess.HasExited) {
        Write-Host "ArrÃªt du serveur HTTP (PID $($backendProcess.Id))..."
        try { $backendProcess.Kill() } catch {}
    }

    Set-Location $rootDirectory
}



