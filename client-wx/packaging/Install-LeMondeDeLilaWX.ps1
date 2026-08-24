$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $env:LOCALAPPDATA 'Programs\LeMondeDeLilaWX'
$staging = "$target.installing"
$programsRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs'))
if (![IO.Path]::GetFullPath($target).StartsWith($programsRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Chemin d’installation invalide.'
}

if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $staging -Recurse -Force
Remove-Item -LiteralPath (Join-Path $staging 'Install-LeMondeDeLilaWX.ps1') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $staging 'Installer.cmd') -Force -ErrorAction SilentlyContinue

$backup = "$target.previous"
if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath $target -Destination $backup
}
try {
    Move-Item -LiteralPath $staging -Destination $target
} catch {
    if (!(Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $backup)) {
        Move-Item -LiteralPath $backup -Destination $target
    }
    throw
}

$shell = New-Object -ComObject WScript.Shell
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Le Monde de Lila.lnk'
$shortcut = $shell.CreateShortcut($startMenu)
$shortcut.TargetPath = Join-Path $target 'lila_launcher.exe'
$shortcut.WorkingDirectory = $target
$shortcut.Description = 'Le Monde de Lila'
$shortcut.Save()

Start-Process -FilePath (Join-Path $target 'lila_launcher.exe') -WorkingDirectory $target
