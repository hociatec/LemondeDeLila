param()

$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
if ([string]::IsNullOrWhiteSpace($localAppData))
{
    Write-Error "Le dossier LocalApplicationData est introuvable."
    exit 1
}

$targetDir = Join-Path $localAppData "LeMondeDeLila"
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$flagFile = Join-Path $targetDir "debug-logs.flag"
try
{
    New-Item -ItemType File -Force -Path $flagFile | Out-Null
    Write-Host "Fichier de logs Debug activé : $flagFile"
}
catch
{
    Write-Error "Impossible de créer $flagFile : $_"
    exit 1
}
