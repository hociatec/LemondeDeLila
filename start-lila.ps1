<#
    Script de démarrage « one-click » pour Les mondes de Lilas.

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
    [switch]$SkipBuild,
    [switch]$ForceBuild,
    [switch]$FastStart
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

function Get-PomVersion {
    param([string]$PomPath)
    $content = Get-Content -Path $PomPath -Raw
    $match = [regex]::Match($content, '<version>([^<]+)</version>')
    if ($match.Success) { return $match.Groups[1].Value }
    return $null
}

function Build-FrameworkModules {
    param(
        [string]$JavaDir,
        [string]$MavenPath,
        [switch]$Force
    )

    $frameworks = @(
        'framework-di',
        'framework-core',
        'framework-access',
        'framework-ui',
        'framework-network',
        'framework-media'
    )

    $parentPom = Join-Path $JavaDir 'pom.xml'
    $parentVer = Get-PomVersion -PomPath $parentPom
    $parentInstalled = $false
    if ($parentVer) {
        $localPom = Join-Path $env:USERPROFILE ".m2\repository\com\lemondelila\java-client\$parentVer\java-client-$parentVer.pom"
        $parentInstalled = Test-Path $localPom
    }

    if (-not $parentInstalled -or $Force) {
        Push-Location $JavaDir
        try {
            Write-Host "Installation du parent java-client..."
            & $MavenPath install -N
            if ($LASTEXITCODE -ne 0) {
                throw "L'installation du parent java-client a echoue (code $LASTEXITCODE)."
            }
        }
        finally {
            Pop-Location
        }
    } else {
        Write-Host "Parent java-client déjà dans le cache Maven, skip."
    }

    foreach ($module in $frameworks) {
        $modulePath = Join-Path $JavaDir $module
        if (-not (Test-Path $modulePath)) {
            continue
        }
        if (-not $Force -and (Test-Path (Join-Path $modulePath 'target'))) {
            Write-Host "Skip build $module (target/ existant)."
            continue
        }
        Write-Host "Installation du module $module..."
        Push-Location $modulePath
        try {
            & $MavenPath install -DskipTests
            if ($LASTEXITCODE -ne 0) {
                throw "La compilation du module $module a echoue (code $LASTEXITCODE)."
            }
        }
        finally {
            Pop-Location
        }
    }
}

function Remove-BomFromFile {
    param(
        [string]$FilePath
    )

    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $sliceLength = [Math]::Max($bytes.Length - 3, 0)
        $cleanBytes = [byte[]]::new($sliceLength)
        if ($sliceLength -gt 0) {
            [Array]::Copy($bytes, 3, $cleanBytes, 0, $sliceLength)
        }
        [System.IO.File]::WriteAllBytes($FilePath, $cleanBytes)
        return 'UTF-8'
    }
    elseif ($bytes.Length -ge 4 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE -and $bytes[2] -eq 0x00 -and $bytes[3] -eq 0x00) {
        $sliceLength = [Math]::Max($bytes.Length - 4, 0)
        $cleanBytes = [byte[]]::new($sliceLength)
        if ($sliceLength -gt 0) {
            [Array]::Copy($bytes, 4, $cleanBytes, 0, $sliceLength)
        }
        [System.IO.File]::WriteAllBytes($FilePath, $cleanBytes)
        return 'UTF-32LE'
    }
    elseif ($bytes.Length -ge 4 -and $bytes[0] -eq 0x00 -and $bytes[1] -eq 0x00 -and $bytes[2] -eq 0xFE -and $bytes[3] -eq 0xFF) {
        $sliceLength = [Math]::Max($bytes.Length - 4, 0)
        $cleanBytes = [byte[]]::new($sliceLength)
        if ($sliceLength -gt 0) {
            [Array]::Copy($bytes, 4, $cleanBytes, 0, $sliceLength)
        }
        [System.IO.File]::WriteAllBytes($FilePath, $cleanBytes)
        return 'UTF-32BE'
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $sliceLength = [Math]::Max($bytes.Length - 2, 0)
        $cleanBytes = [byte[]]::new($sliceLength)
        if ($sliceLength -gt 0) {
            [Array]::Copy($bytes, 2, $cleanBytes, 0, $sliceLength)
        }
        [System.IO.File]::WriteAllBytes($FilePath, $cleanBytes)
        return 'UTF-16LE'
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        $sliceLength = [Math]::Max($bytes.Length - 2, 0)
        $cleanBytes = [byte[]]::new($sliceLength)
        if ($sliceLength -gt 0) {
            [Array]::Copy($bytes, 2, $cleanBytes, 0, $sliceLength)
        }
        [System.IO.File]::WriteAllBytes($FilePath, $cleanBytes)
        return 'UTF-16BE'
    }

    return $null
}

function Remove-BomFromSource {
    param(
        [string]$RootPath,
        [string[]]$Extensions = @('.java', '.xml', '.properties', '.yml', '.yaml')
    )

    $normalizedExtensions = $Extensions | ForEach-Object {
        if ($_ -like '.*') { $_.ToLowerInvariant() }
        else { ".{0}" -f $_.ToLowerInvariant() }
    }

    $cleanedCount = 0
    Get-ChildItem -Path $RootPath -Recurse -File | ForEach-Object {
        $extension = $_.Extension.ToLowerInvariant()
        if ($normalizedExtensions -contains $extension) {
            $bomType = Remove-BomFromFile -FilePath $_.FullName
            if ($bomType) {
                $cleanedCount++
                Write-Host "Suppression du BOM $bomType : $($_.FullName)"
            }
        }
    }

    if ($cleanedCount -gt 0) {
        Write-Host "$cleanedCount fichier(s) nettoye(s) des BOM."
    }
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

function Wait-ForTcpPort {
    param(
        [string]$TcpHost,
        [int]$TcpPort,
        [int]$TimeoutSeconds = 45
    )

    Write-Host "Attente de disponibilit� du port $TcpHost`:$TcpPort ..."
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $asyncResult = $client.BeginConnect($TcpHost, $TcpPort, $null, $null)
            if ($asyncResult.AsyncWaitHandle.WaitOne(1000)) {
                $client.EndConnect($asyncResult)
                $client.Close()
                Write-Host "Port $TcpHost`:$TcpPort disponible."
                return
            }
            $client.Close()
        }
        catch {
            # retry later
        }
        Start-Sleep -Seconds 1
    }
    throw "Impossible de joindre $Host`:$Port apr�s $TimeoutSeconds secondes."
}

Set-Location $rootDirectory

$wsHost = $env:APP_WS_HOST
$wsPort = $env:APP_WS_PORT
$envFiles = @('.env.local', '.env.dev.local', '.env', '.env.dev')
foreach ($fileName in $envFiles) {
    if ($wsHost -and $wsPort) { break }
    $envPath = Join-Path $backendDirectory $fileName
    if (-not (Test-Path $envPath)) { continue }
    foreach ($line in Get-Content $envPath) {
        if (-not $wsHost -and $line -match '^\s*APP_WS_HOST\s*=\s*(.+)$') {
            $value = $matches[1].Trim()
            $wsHost = $value.Trim("'`"")
        }
        elseif (-not $wsPort -and $line -match '^\s*APP_WS_PORT\s*=\s*(.+)$') {
            $value = $matches[1].Trim().Trim("'`"")
            [int]$parsed = 0
            if ([int]::TryParse($value, [ref]$parsed)) {
                $wsPort = $parsed
            }
        }
    }
}
if (-not $wsHost) { $wsHost = '127.0.0.1' }
if (-not $wsPort) { $wsPort = 8081 }
[int]$wsPortValue = 0
if (-not [int]::TryParse([string]$wsPort, [ref]$wsPortValue)) {
    $wsPortValue = 8081
}
$wsPort = $wsPortValue

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
        try {
            Wait-ForTcpPort -TcpHost $wsHost -TcpPort $wsPort
        }
        catch {
            if ($realtimeProcess -and -not $realtimeProcess.HasExited) {
                try { $realtimeProcess.Kill() } catch {}
            }
            throw
        }
    }

    Push-Location $javaDirectory
    $javaLocationPushed = $true

    if (-not $SkipBuild) {
        if ($FastStart) {
            Write-Host "Compilation rapide du client Java (FastStart)" -ForegroundColor Cyan
            & $mavenPath -pl client-app -am install -DskipTests
            if ($LASTEXITCODE -ne 0) {
                throw "La compilation Maven rapide a echoue (code $LASTEXITCODE)."
            }
        } else {
            Build-FrameworkModules -JavaDir $javaDirectory -MavenPath $mavenPath -Force:$ForceBuild
            Remove-BomFromSource -RootPath $javaDirectory -Extensions @('.java', '.xml', '.properties', '.yml', '.yaml')
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
    }

    $appLauncherClass = Join-Path $javaDirectory 'client-app\target\classes\com\lemondelila\client\AppLauncher.class'
    if (!(Test-Path $appLauncherClass)) {
        throw "Compilation incomplete : $appLauncherClass introuvable. Relancez le script sans -SkipBuild."
    }

    # ✅ Recherche du JAR autonome généré par Maven (classifier -all)
    $shadedJar = Get-ChildItem -Path (Join-Path $javaDirectory 'client-app\target') `
        -Filter 'client-app-*-all.jar' `
        -ErrorAction SilentlyContinue `
        | Sort-Object LastWriteTime -Descending `
        | Select-Object -First 1

    if (-not $shadedJar) {
        throw "JAR exécutable introuvable (client-app-*-all.jar). Relancez sans -SkipBuild."
    }

    Write-Host "Démarrage du client Swing..."
    $javaArguments = @('-jar', $shadedJar.FullName)
    & $javaCmd.Source @javaArguments

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

