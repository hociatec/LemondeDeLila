# Démarrage simplifié : backend NestJS + client Java
[CmdletBinding()]
param(
    [switch]$SkipBackend,
    [switch]$SkipClient,
    [switch]$SkipBuild,
    [switch]$FastBuild,   # build client rapide (client-app uniquement)
    [int]$Port = 3001
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root 'backend'
$javaDir = Join-Path $root 'java-client'

function Stop-Port {
    param([int]$Port)
    Write-Host "Vérification du port $Port..."
    $pidList = @()
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $pidList = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    }
    if (-not $pidList -or ($pidList -isnot [System.Collections.IEnumerable])) {
        $pidList = @($pidList)
    }
    if (-not $pidList -or $pidList.Count -eq 0) {
        try {
            $pidList = netstat -ano | Select-String ":$Port" | ForEach-Object {
                ($_ -split '\s+')[-1]
            } | Select-Object -Unique
            $pidList = @($pidList)
        } catch {
            Write-Warning "Impossible de lire netstat pour le port $Port."
            $pidList = @()
        }
    }
    $pidList = @($pidList | Where-Object { $_ })
    foreach ($procId in $pidList) {
        Write-Host "Arrêt du processus PID $procId sur le port $Port..."
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
        } catch {
            Write-Warning "Echec de l'arrêt du PID $procId : $_"
        }
    }
}

function Ensure-Maven {
    $cmd = Get-Command mvn -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $tools = Join-Path $root 'tools'
    $ver = '3.9.6'
    $archive = "apache-maven-$ver-bin.zip"
    $mvnHome = Join-Path $tools "apache-maven-$ver"
    $archivePath = Join-Path $tools $archive

    if (-not (Test-Path $mvnHome)) {
        if (-not (Test-Path $tools)) { New-Item -ItemType Directory -Path $tools | Out-Null }
        if (-not (Test-Path $archivePath)) {
            Write-Host "Téléchargement Maven $ver..."
            Invoke-WebRequest -Uri "https://archive.apache.org/dist/maven/maven-3/$ver/binaries/$archive" -OutFile $archivePath
        }
        Write-Host "Extraction Maven..."
        Expand-Archive -Path $archivePath -DestinationPath $tools -Force
    }

    $mvnExe = Join-Path $mvnHome 'bin\mvn.cmd'
    if (-not (Test-Path $mvnExe)) { throw "Maven introuvable après installation." }
    if (-not ($env:PATH -split ';' | Where-Object { $_ -eq "$mvnHome\bin" })) {
        $env:PATH = "$mvnHome\bin;$env:PATH"
    }
    return $mvnExe
}

function Start-Backend {
    if (-not (Test-Path $backendDir)) { throw "Dossier backend introuvable : $backendDir" }
    if (-not (Test-Path (Join-Path $backendDir 'node_modules'))) {
        Write-Host "Installation des dépendances backend..."
        Push-Location $backendDir
        npm install
        Pop-Location
    }
    # Stopper un éventuel processus déjà sur le port (par défaut 3000)
    $portToUse = if ($env:PORT) { $env:PORT } else { "$Port" }
    Stop-Port -Port $portToUse

    Write-Host "Démarrage du backend NestJS (port défini par PORT, défaut 3000)..."
    Start-Process powershell -ArgumentList "-NoExit","-Command","cd `"$backendDir`"; $env:PORT=$portToUse; npm run start:dev"
}

function Build-JavaClient {
    param([string]$MavenPath)
    $pom = Join-Path $javaDir 'pom.xml'
    if (-not (Test-Path $pom)) {
        Write-Warning "pom.xml introuvable, build client ignoré."
        return
    }
    Push-Location $javaDir
    try {
        # Nettoyer l'ancien build pour éviter de réutiliser un JAR/config obsolète
        $targetDir = Join-Path $javaDir 'client-app\target'
        if (Test-Path $targetDir) {
            Remove-Item $targetDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        $args = @()
        if ($FastBuild) {
            $args = @('-pl','client-app','-am','package','-DskipTests')
        } else {
            $args = @('clean','package','-DskipTests')
        }
        # Copier la config locale avant build pour embarquer la bonne base URL/WS
        $configSrc = Join-Path $javaDir 'config\client.properties'
        $configDst = Join-Path $javaDir 'client-app\src\main\resources\config\client.properties'
        if (Test-Path $configSrc) {
            Copy-Item $configSrc $configDst -Force
        }
        & $MavenPath @args
        if ($LASTEXITCODE -ne 0) { throw "Build Maven échoué ($LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

function Start-JavaClient {
    $pom = Join-Path $javaDir 'pom.xml'
    if (-not (Test-Path $pom)) {
        Write-Warning "Dossier java-client ou pom.xml introuvable, client non lancé."
        return
    }
    $jar = Get-ChildItem -Path (Join-Path $javaDir 'client-app\target') -Filter 'client-app-*-all.jar' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $jar) {
        Write-Warning "JAR client-app-*-all.jar introuvable, lancement mvn spring-boot:run dans cette fenêtre."
        Push-Location $javaDir
        try {
            mvn spring-boot:run
        } finally {
            Pop-Location
        }
        return
    }
    Write-Host "Démarrage du client Java (même fenêtre)..."
    Push-Location $javaDir
    try {
        java -jar $jar.FullName
    } finally {
        Pop-Location
    }
}

if (-not $SkipBackend) { Start-Backend }

if (-not $SkipClient) {
    $mvn = Ensure-Maven
    if (-not $SkipBuild) { Build-JavaClient -MavenPath $mvn }
    Start-JavaClient
}

$port = $env:PORT
if (-not $port) { $port = "$Port" }
Write-Host "Lancement terminé. Backend NestJS sur http://localhost:$port."
