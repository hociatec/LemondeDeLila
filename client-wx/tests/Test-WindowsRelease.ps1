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

$installArguments = @(
    '/VERYSILENT',
    '/SUPPRESSMSGBOXES',
    '/NORESTART',
    "/DIR=`"$installDir`""
)
foreach ($iteration in 1..2) {
    $installed = Start-Process -FilePath $installerJson.InstallerExe `
        -ArgumentList $installArguments -Wait -PassThru
    if ($installed.ExitCode -ne 0) {
        throw "Installation/mise à niveau $iteration échouée: $($installed.ExitCode)."
    }
    if (!(Test-Path -LiteralPath (Join-Path $installDir 'lila_launcher.exe') -PathType Leaf) -or
        !(Test-Path -LiteralPath (Join-Path $installDir 'app\lemonde_de_lila_wx.exe') -PathType Leaf)) {
        throw "Installation/mise à niveau $iteration incomplète."
    }
}

$userData = Join-Path $env:LOCALAPPDATA 'LeMondeDeLilaWX'
New-Item -ItemType Directory -Force -Path $userData | Out-Null
$sentinel = Join-Path $userData 'release-certification-user-data.txt'
Set-Content -LiteralPath $sentinel -Value 'must survive uninstall' -Encoding UTF8
$uninstaller = Join-Path $installDir 'unins000.exe'
if (!(Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw 'Désinstalleur absent.' }
$uninstalled = Start-Process -FilePath $uninstaller `
    -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -Wait -PassThru
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
} | ConvertTo-Json
