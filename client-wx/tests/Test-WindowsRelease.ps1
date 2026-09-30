param(
    [Parameter(Mandatory = $true)][string]$BuildDir,
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$releaseDir = Join-Path $WorkDir 'release output'
$portableDir = Join-Path $WorkDir 'portable Épreuve'
$installDir = Join-Path $WorkDir 'installation Épreuve'
$upgradeDir = Join-Path $WorkDir 'mise à niveau Épreuve'

$packageJson = & (Join-Path $root 'scripts\PackageWxRelease.ps1') `
    -BuildDir $BuildDir -OutputDir $releaseDir -Version $Version | ConvertFrom-Json
if (!(Test-Path -LiteralPath $packageJson.UpdateZip -PathType Leaf) -or
    !(Test-Path -LiteralPath $packageJson.BootstrapZip -PathType Leaf)) {
    throw 'Les archives portable/bootstrap ne sont pas produites.'
}
if ((Get-FileHash -LiteralPath $packageJson.UpdateZip -Algorithm SHA256).Hash.ToLowerInvariant() `
    -ne $packageJson.Sha256) {
    throw 'Le hash déclaré du package portable est invalide.'
}

Expand-Archive -LiteralPath $packageJson.UpdateZip -DestinationPath $portableDir
foreach ($required in @('lemonde_de_lila_wx.exe', 'lila_launcher.exe', 'resources\texts.fr.json')) {
    if (!(Test-Path -LiteralPath (Join-Path $portableDir $required) -PathType Leaf)) {
        throw "Package portable incomplet: $required"
    }
}
$portableProcess = Start-Process -FilePath (Join-Path $portableDir 'lemonde_de_lila_wx.exe') `
    -WorkingDirectory $portableDir -PassThru
Start-Sleep -Seconds 3
if ($portableProcess.HasExited -and $portableProcess.ExitCode -ne 0) {
    throw "Le client portable a quitté avec le code $($portableProcess.ExitCode)."
}
if (!$portableProcess.HasExited) { Stop-Process -Id $portableProcess.Id -Force }

$installerJson = & (Join-Path $root 'scripts\BuildWxInstaller.ps1') `
    -PayloadDir $packageJson.PayloadDir -OutputDir $releaseDir -Version $Version | ConvertFrom-Json
if (!(Test-Path -LiteralPath $installerJson.InstallerExe -PathType Leaf)) {
    throw 'Installateur final absent.'
}
if ((Get-FileHash -LiteralPath $installerJson.InstallerExe -Algorithm SHA256).Hash.ToLowerInvariant() `
    -ne $installerJson.Sha256) {
    throw 'Le hash déclaré de l installateur est invalide.'
}

function Install-Release([string]$Installer, [string]$Destination, [string]$Label) {
    $arguments = @(
        '/VERYSILENT',
        '/SUPPRESSMSGBOXES',
        '/NORESTART',
        "/DIR=`"$Destination`""
    )
    $installed = Start-Process -FilePath $Installer -ArgumentList $arguments -PassThru
    if (!$installed.WaitForExit(120000)) {
        $installed.Kill($true)
        throw "$Label expirée après 120 secondes."
    }
    if ($installed.ExitCode -ne 0) {
        throw "$Label échouée: $($installed.ExitCode)."
    }
    if (!(Test-Path -LiteralPath (Join-Path $Destination 'lila_launcher.exe') -PathType Leaf) -or
        !(Test-Path -LiteralPath (Join-Path $Destination 'app\lemonde_de_lila_wx.exe') -PathType Leaf)) {
        throw "$Label incomplète."
    }
}

Install-Release $installerJson.InstallerExe $installDir 'Installation propre'

$previousManifest = Invoke-RestMethod `
    -Uri 'https://api.lilas.hociatec.fr/api/client/releases/latest?platform=windows&arch=x64' `
    -TimeoutSec 15
if ([string]::IsNullOrWhiteSpace($previousManifest.version) -or
    $previousManifest.version -eq $Version -or
    $previousManifest.installer.url -notmatch '^https://' -or
    $previousManifest.installer.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
    throw 'Le manifeste de la release précédente est absent ou invalide.'
}
$previousInstaller = Join-Path $WorkDir 'previous-release-setup.exe'
Invoke-WebRequest -Uri $previousManifest.installer.url -OutFile $previousInstaller `
    -TimeoutSec 120 | Out-Null
if ((Get-FileHash -LiteralPath $previousInstaller -Algorithm SHA256).Hash.ToLowerInvariant() `
    -ne $previousManifest.installer.sha256.ToLowerInvariant()) {
    throw 'Le hash de l installateur précédent est invalide.'
}
$previousSignature = Get-AuthenticodeSignature -LiteralPath $previousInstaller
if ($previousSignature.Status -eq [System.Management.Automation.SignatureStatus]::UnknownError -and
    $null -ne $previousSignature.SignerCertificate) {
    # GitHub's fresh Windows images do not trust the private deployment CA.
    # The published SHA-256 has already been checked above; still require an
    # embedded Authenticode signer so an unsigned or altered file is rejected.
    Write-Warning 'Chaîne Authenticode privée non approuvée par le runner; certificat signataire présent.'
} elseif ($previousSignature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
    throw "Signature Authenticode de la release précédente invalide: $($previousSignature.Status)."
}
Unblock-File -LiteralPath $previousInstaller
Install-Release $previousInstaller $upgradeDir "Installation de la release $($previousManifest.version)"
Install-Release $installerJson.InstallerExe $upgradeDir "Mise à niveau vers $Version"

$userData = Join-Path $env:LOCALAPPDATA 'LeMondeDeLilaWX'
New-Item -ItemType Directory -Force -Path $userData | Out-Null
$sentinel = Join-Path $userData 'release-certification-user-data.txt'
Set-Content -LiteralPath $sentinel -Value 'must survive uninstall' -Encoding UTF8
$uninstaller = Join-Path $installDir 'unins000.exe'
if (!(Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw 'Désinstalleur absent.' }
$uninstalled = Start-Process -FilePath $uninstaller `
    -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -PassThru
if (!$uninstalled.WaitForExit(120000)) {
    $uninstalled.Kill($true)
    throw 'Désinstallation expirée après 120 secondes.'
}
if ($uninstalled.ExitCode -ne 0) { throw "Désinstallation échouée: $($uninstalled.ExitCode)." }
if (!(Test-Path -LiteralPath $sentinel -PathType Leaf)) {
    throw 'La désinstallation a supprimé des données utilisateur.'
}
Remove-Item -LiteralPath $sentinel -Force

[pscustomobject]@{
    PortableZip = $packageJson.UpdateZip
    InstallerExe = $installerJson.InstallerExe
    PortableSha256 = $packageJson.Sha256
    InstallerSha256 = $installerJson.Sha256
    PreviousVersion = $previousManifest.version
    PreviousInstallerSha256 = $previousManifest.installer.sha256.ToLowerInvariant()
} | ConvertTo-Json
