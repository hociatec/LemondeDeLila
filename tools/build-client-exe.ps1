<#
    GÃ©nÃ¨re lâ€™installateur Windows (.exe) pour le client Java Â«Â Le Monde de LilaÂ Â».

    Usage :
        powershell -ExecutionPolicy Bypass -File .\tools\build-client-exe.ps1 [-SkipBuild]

    ParamÃ¨tre :
        -SkipBuild : saute Maven (suppose que target\ contient dÃ©jÃ  les artÃ©facts Ã  jour).
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$CertificatePath,
    [string]$CertificatePassword,
    [string]$TimestampUrl = 'http://timestamp.digicert.com',
    [switch]$AllowUnsigned,
    [switch]$AllowUnobfuscated
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-MavenCommand {
    $mvn = Get-Command mvn -ErrorAction SilentlyContinue
    if ($mvn) { return $mvn.Source }

    $localMaven = Join-Path $PSScriptRoot 'apache-maven-3.9.6\bin\mvn.cmd'
    if (Test-Path $localMaven) { return $localMaven }

    throw "Maven introuvable. Installez-le ou exÃ©cutez d'abord start-lila.ps1 pour le provisionner."
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

    throw "WiX Toolset (candle.exe + light.exe) est requis. DÃ©posez-le dans tools/ ou ajoutez-le au PATH."
}

function Get-NvdaSearchRoots {
    $roots = @()
    $override = [Environment]::GetEnvironmentVariable('LILA_NVDA_DIR')
    if (-not [string]::IsNullOrWhiteSpace($override)) {
        $roots += $override
    }

    foreach ($envVar in @('ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA')) {
        $base = [Environment]::GetEnvironmentVariable($envVar)
        if ([string]::IsNullOrWhiteSpace($base)) {
            continue
        }
        $root = if ($envVar -eq 'LOCALAPPDATA') {
            Join-Path $base 'Programs\NVDA'
        } else {
            Join-Path $base 'NVDA'
        }
        $roots += $root
    }

    return $roots
}

function Get-PeMachineType {
    param(
        [string]$FilePath
    )

    if (-not (Test-Path $FilePath)) {
        return $null
    }

    $stream = [System.IO.File]::Open($FilePath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::Read)
    try {
        $reader = New-Object System.IO.BinaryReader($stream, [System.Text.Encoding]::ASCII, $true)
        try {
            $stream.Seek(0x3C, [System.IO.SeekOrigin]::Begin) | Out-Null
            $peOffset = $reader.ReadInt32()
            if ($peOffset -le 0) {
                return $null
            }
            $stream.Seek($peOffset + 4, [System.IO.SeekOrigin]::Begin) | Out-Null
            return $reader.ReadUInt16()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Find-NvdaHelperSource {
    param(
        [string[]]$CandidateNames,
        [UInt16[]]$MachineTypes
    )

    foreach ($root in Get-NvdaSearchRoots) {
        foreach ($name in $CandidateNames) {
            $candidates = @()
            if ([System.IO.Path]::IsPathRooted($name)) {
                if (Test-Path $name) {
                    $candidates += $name
                }
            } else {
                $direct = Join-Path $root $name
                if (Test-Path $direct) {
                    $candidates += $direct
                }

                $pattern = Split-Path $name -Leaf
                $relativeDir = Split-Path $name -Parent
                $searchBase = if ([string]::IsNullOrWhiteSpace($relativeDir)) { $root } else { Join-Path $root $relativeDir }
                if (Test-Path $searchBase) {
                    try {
                        $matches = Get-ChildItem -Path $searchBase -Recurse -Filter $pattern -File -ErrorAction SilentlyContinue
                        if ($matches) {
                            $candidates += $matches.FullName
                        }
                    } catch {
                        # Ignored: insufficient permissions or unreadable directories.
                    }
                }
            }

            foreach ($candidate in ($candidates | Sort-Object LastWriteTime -Descending)) {
                if ($MachineTypes -and $MachineTypes.Count -gt 0) {
                    $machine = Get-PeMachineType -FilePath $candidate
                    if ($machine -eq $null -or (-not ($MachineTypes -contains $machine))) {
                        continue
                    }
                }
                return $candidate
            }
        }
    }

    return $null
}

function Ensure-NvdaHelperRemote {
    param(
        [string]$WindowsLibsDir
    )

    if ([string]::IsNullOrWhiteSpace($WindowsLibsDir)) {
        return
    }

    $requirements = @(
        @{ Arch = 'x64'; Machine = 0x8664; FileName = 'nvdaHelperRemote.dll'; Candidates = @('nvdaHelperRemote64.dll', 'nvdaHelperRemote.dll') },
        @{ Arch = 'x86'; Machine = 0x014c; FileName = 'nvdaHelperRemote.dll'; Candidates = @('nvdaHelperRemote.dll') }
    )

    foreach ($req in $requirements) {
        $destination = Join-Path $WindowsLibsDir (Join-Path $req.Arch $req.FileName)
        if (Test-Path $destination) {
            continue
        }

        $source = Find-NvdaHelperSource -CandidateNames $req.Candidates -MachineTypes @($req.Machine)
        if ($source) {
            $destDir = Split-Path $destination -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item -Path $source -Destination $destination -Force
            Write-Host ("nvdaHelperRemote ({0}) ajoutÃ© depuis {1}" -f $req.Arch, $source)
        } else {
            throw ("nvdaHelperRemote introuvable pour l'architecture {0}. Installez NVDA ou dÃ©finissez LILA_NVDA_DIR avant d'exÃ©cuter tools/build-client-exe.ps1." -f $req.Arch)
        }
    }
}

function Ensure-AssistiveLibraries {
    param(
        [string]$LibsRoot
    )

    if ([string]::IsNullOrWhiteSpace($LibsRoot)) {
        return
    }

    $windowsDir = Join-Path $LibsRoot 'windows'
    Ensure-NvdaHelperRemote -WindowsLibsDir $windowsDir
}

function Remove-UnneededArtifacts {
    param(
        [string]$Root
    )

    if (-not (Test-Path $Root)) {
        return
    }

    foreach ($dirName in @('logs', 'tmp', 'temp', 'debug', '.idea', '.vscode')) {
        $candidate = Join-Path $Root $dirName
        if (Test-Path $candidate) {
            Remove-Item -Path $candidate -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    Get-ChildItem -Path $Root -Recurse -Include '*.log','*.tmp','*.pdb' -File -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -Path $_.FullName -Force -ErrorAction SilentlyContinue
    }
}

function Write-InstallerChecksum {
    param(
        [string]$InstallerPath
    )

    if (-not (Test-Path $InstallerPath)) {
        throw "Installateur introuvable pour calcul de checksum : $InstallerPath"
    }

    $hash = Get-FileHash -Path $InstallerPath -Algorithm SHA256
    $checksumFile = "$InstallerPath.sha256"
    "$($hash.Hash)  $(Split-Path $InstallerPath -Leaf)" | Out-File -FilePath $checksumFile -Encoding ascii -Force

    $recheck = Get-FileHash -Path $InstallerPath -Algorithm SHA256
    if ($recheck.Hash -ne $hash.Hash) {
        throw "Verification immediate du checksum echouee pour $InstallerPath"
    }

    return $checksumFile
}

function Invoke-Step {
    param(
        [string]$Message,
        [scriptblock]$Action
    )
    Write-Host ">> $Message"
    & $Action
}

function Invoke-MavenReleaseBuild {
    param(
        [string]$MavenCmd,
        [string]$JavaRoot
    )

    Invoke-Step "Compilation Maven (client-app - profil release)" {
        Push-Location $JavaRoot
        try {
            & $MavenCmd -pl client-app -am clean package -DskipTests -Prelease
            if ($LASTEXITCODE -ne 0) {
                throw "La compilation Maven a échoué (code $LASTEXITCODE)."
            }
        }
        finally {
            Pop-Location
        }
    }
}

function Get-ObfuscatedJar {
    param(
        [string]$TargetDir
    )
    return Get-ChildItem -Path $TargetDir -Filter 'client-app-*-obf.jar' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

$repoRoot    = Split-Path -Parent $PSScriptRoot
$javaRoot    = Join-Path $repoRoot 'java-client'
$clientDir   = Join-Path $javaRoot 'client-app'
$targetDir   = Join-Path $clientDir 'target'
$stagingDir  = Join-Path $targetDir 'jpackage-input'
$configDir   = Join-Path $javaRoot 'config'
$libsDir     = Join-Path $javaRoot 'libs'
$distDir     = Join-Path $repoRoot 'dist'
$installerDir= Join-Path $distDir 'installer'

if (!(Test-Path $javaRoot)) {
    throw "RÃ©pertoire java-client introuvable."
}

Ensure-WiXOnPath
if (-not (Get-Command jpackage -ErrorAction SilentlyContinue)) {
    throw "jpackage introuvable. Utilisez un JDK 21+ contenant jpackage."
}

$mavenCmd = Get-MavenCommand

if (-not $SkipBuild) {
    Invoke-MavenReleaseBuild -MavenCmd $mavenCmd -JavaRoot $javaRoot
}
elseif (!(Test-Path $targetDir)) {
    throw "-SkipBuild a Ã©tÃ© demandÃ© mais aucun dossier target n'existe : $targetDir"
}

$shadedJar = Get-ObfuscatedJar -TargetDir $targetDir
if (-not $shadedJar -and $SkipBuild) {
    Write-Warning "Jar obfusquÃ© introuvable. Lancement automatique du build release..."
    Invoke-MavenReleaseBuild -MavenCmd $mavenCmd -JavaRoot $javaRoot
    $shadedJar = Get-ObfuscatedJar -TargetDir $targetDir
}
if (-not $shadedJar -and $AllowUnobfuscated) {
    Write-Warning "Jar obfusquÃ© absent mais -AllowUnobfuscated est actif : utilisation du jar 'all'."
    $shadedJar = Get-ChildItem -Path $targetDir -Filter 'client-app-*-all.jar' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $shadedJar) {
    throw "Jar obfusque introuvable (client-app-*-obf.jar). Recompilez avec le profil release ou utilisez -AllowUnobfuscated pour livrer un -all.jar non protege."
}

[xml]$pom = Get-Content (Join-Path $javaRoot 'pom.xml')
$rawVersion = [string]$pom.project.version
if ([string]::IsNullOrWhiteSpace($rawVersion)) { $rawVersion = '1.0.9' }
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
if (Test-Path $libsDir) {
    $stagingLibs = Join-Path $stagingDir 'libs'
    Copy-Item -Path $libsDir -Destination $stagingLibs -Recurse -Force
    Ensure-AssistiveLibraries -LibsRoot $stagingLibs
}

Remove-UnneededArtifacts -Root $stagingDir

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

Invoke-Step "CrÃ©ation de l'installateur Windows (.exe)" {
    & jpackage @commonArgs '--type' 'exe'
    if ($LASTEXITCODE -ne 0) {
        throw "jpackage a Ã©chouÃ© (code $LASTEXITCODE)."
    }
}

$installer = Get-ChildItem -Path $installerDir -Filter '*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($installer) {
    if (-not $CertificatePath -and -not $AllowUnsigned) {
        throw "CertificatePath requis pour signer l'installateur. Ajoutez -AllowUnsigned explicitement si vous devez construire sans signature (deconseille)."
    }
    if ($CertificatePath) {
        if (-not (Get-Command signtool.exe -ErrorAction SilentlyContinue)) {
            throw "signtool.exe introuvable : signature code signing obligatoire pour les livrables."
        }
        $signArgs = @('sign', '/fd', 'SHA256', '/tr', $TimestampUrl, '/td', 'SHA256', '/f', $CertificatePath)
        if ($CertificatePassword) { $signArgs += @('/p', $CertificatePassword) }
        $signArgs += @('/d', 'Le Monde de Lila - Client') + $installer.FullName
        Invoke-Step "Signature code signing ($($installer.Name))" {
            & signtool.exe @signArgs
            if ($LASTEXITCODE -ne 0) { throw "Echec de la signature code signing (code $LASTEXITCODE)." }
        }
        Invoke-Step "Verification de la signature" {
            & signtool.exe verify /pa $installer.FullName
            if ($LASTEXITCODE -ne 0) { throw "Verification de la signature echouee (code $LASTEXITCODE)." }
        }
    } else {
        Write-Warning "Construction d'un installeur non signe (-AllowUnsigned). A utiliser uniquement en environnement de test."
    }

    $checksumFile = Invoke-Step "Generation du checksum SHA-256" {
        Write-InstallerChecksum -InstallerPath $installer.FullName
    }

    Write-Host ""
    Write-Host "Installateur genere : $($installer.FullName)" -ForegroundColor Green
    if ($checksumFile) {
        Write-Host "Checksum SHA-256 : $checksumFile" -ForegroundColor Green
    }
} else {
    Write-Warning "jpackage a termine sans generer d'executable ?"
}

