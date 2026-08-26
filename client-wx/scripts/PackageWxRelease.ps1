param(
    [Parameter(Mandatory = $true)][string]$BuildDir,
    [Parameter(Mandatory = $true)][string]$OutputDir,
    [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = 'Stop'
$build = (Resolve-Path -LiteralPath $BuildDir).Path
$output = [IO.Path]::GetFullPath($OutputDir)
$payload = Join-Path $output 'payload'
$bootstrap = Join-Path $output 'bootstrap'

if (Test-Path -LiteralPath $output) {
    Remove-Item -LiteralPath $output -Recurse -Force
}
New-Item -ItemType Directory -Path $payload | Out-Null
New-Item -ItemType Directory -Path (Join-Path $bootstrap 'app') | Out-Null

$clientExe = Join-Path $build 'lemonde_de_lila_wx.exe'
$launcherExe = Join-Path $build 'lila_launcher.exe'
if (!(Test-Path -LiteralPath $clientExe) -or !(Test-Path -LiteralPath $launcherExe)) {
    throw 'Le client WX ou le lanceur est absent du build Release.'
}

Copy-Item -LiteralPath $clientExe -Destination $payload
Copy-Item -LiteralPath $launcherExe -Destination $payload
Get-ChildItem -LiteralPath $build -File -Filter '*.dll' | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $payload
}

# Les DLL vcpkg sont placées dans le dossier de build, mais le runtime MSVC ne
# l'est pas toujours. Une archive publiée sans ces fichiers peut fonctionner sur
# le runner et échouer sur un poste Windows qui n'a pas le redistribuable exact.
$requiredMsvcRuntime = @(
    'msvcp140.dll',
    'msvcp140_atomic_wait.dll',
    'vcruntime140.dll',
    'vcruntime140_1.dll'
)
$missingMsvcRuntime = @(
    $requiredMsvcRuntime | Where-Object {
        !(Test-Path -LiteralPath (Join-Path $payload $_))
    }
)
if ($missingMsvcRuntime.Count -gt 0) {
    $redistRoot = $env:VCToolsRedistDir
    if ([string]::IsNullOrWhiteSpace($redistRoot)) {
        throw "VCToolsRedistDir absent; runtime MSVC non empaqueté: $($missingMsvcRuntime -join ', ')."
    }
    $crtDirectory = Join-Path $redistRoot 'x64\Microsoft.VC143.CRT'
    if (!(Test-Path -LiteralPath $crtDirectory -PathType Container)) {
        throw "Runtime MSVC x64 introuvable: $crtDirectory"
    }
    foreach ($runtimeName in $missingMsvcRuntime) {
        $runtimePath = Join-Path $crtDirectory $runtimeName
        if (!(Test-Path -LiteralPath $runtimePath -PathType Leaf)) {
            throw "DLL MSVC requise absente: $runtimePath"
        }
        Copy-Item -LiteralPath $runtimePath -Destination $payload
    }
}

foreach ($runtimeName in $requiredMsvcRuntime) {
    if (!(Test-Path -LiteralPath (Join-Path $payload $runtimeName) -PathType Leaf)) {
        throw "Paquet incomplet: runtime MSVC absent ($runtimeName)."
    }
}
$resources = Join-Path $build 'resources'
if (Test-Path -LiteralPath $resources) {
    Copy-Item -LiteralPath $resources -Destination $payload -Recurse
}

Copy-Item -LiteralPath $launcherExe -Destination $bootstrap
Copy-Item -Path (Join-Path $payload '*') -Destination (Join-Path $bootstrap 'app') -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\packaging\Install-LeMondeDeLilaWX.ps1') -Destination $bootstrap
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\packaging\Installer.cmd') -Destination $bootstrap

$updateZip = Join-Path $output "client-wx-$Version-windows-x64.zip"
$bootstrapZip = Join-Path $output "LeMondeDeLilaWX-$Version-bootstrap.zip"
Compress-Archive -Path (Join-Path $payload '*') -DestinationPath $updateZip -CompressionLevel Optimal
Compress-Archive -Path (Join-Path $bootstrap '*') -DestinationPath $bootstrapZip -CompressionLevel Optimal

[pscustomobject]@{
    UpdateZip = $updateZip
    BootstrapZip = $bootstrapZip
    PayloadDir = $payload
    Sha256 = (Get-FileHash -LiteralPath $updateZip -Algorithm SHA256).Hash.ToLowerInvariant()
    Size = (Get-Item -LiteralPath $updateZip).Length
} | ConvertTo-Json
