param(
    [Parameter(Mandatory = $true)][string]$ApiBase,
    [Parameter(Mandatory = $true)][string]$UploadToken,
    [Parameter(Mandatory = $true)][string]$PackagePath,
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$ReleaseId,
    [Parameter(Mandatory = $true)][long]$Sequence,
    [Parameter(Mandatory = $true)][string]$PublishedAt,
    [Parameter(Mandatory = $true)][string]$MandatoryAt,
    [Parameter(Mandatory = $true)][string]$MinimumVersion,
    [Parameter(Mandatory = $true)][string]$Sha256,
    [Parameter(Mandatory = $true)][string]$Signature,
    [string]$Message = 'Mise à jour automatique du client WX.'
)

$ErrorActionPreference = 'Stop'
function Invoke-WithRetry {
    param([Parameter(Mandatory = $true)][scriptblock]$Action, [int]$Attempts = 5)
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try { return & $Action } catch {
            if ($attempt -eq $Attempts) { throw }
            Start-Sleep -Seconds ([Math]::Min(30, [Math]::Pow(2, $attempt)))
        }
    }
}

$api = $ApiBase.TrimEnd('/')
$headers = @{ 'x-client-updates-upload-token' = $UploadToken.Trim() }
$size = (Get-Item -LiteralPath $PackagePath).Length
$body = @{
    releaseId = $ReleaseId
    version = $Version
    sequence = $Sequence
    publishedAt = $PublishedAt
    message = $Message
    minimumVersion = $MinimumVersion
    mandatoryAt = $MandatoryAt
    totalBytes = $size
    sha256 = $Sha256.ToLowerInvariant()
    signature = $Signature
} | ConvertTo-Json

$init = Invoke-WithRetry {
    Invoke-RestMethod -Method Post -Uri "$api/ci/client-wx-updates/upload/init" `
        -Headers $headers -ContentType 'application/json' -Body $body
}
$uploadId = [string]$init.uploadId
if ([string]::IsNullOrWhiteSpace($uploadId)) { throw 'uploadId WX absent.' }

$chunkSize = 10MB
$buffer = New-Object byte[] $chunkSize
$stream = [IO.File]::OpenRead((Resolve-Path -LiteralPath $PackagePath).Path)
try {
    $index = 0
    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $part = Join-Path ([IO.Path]::GetTempPath()) "lila-wx-$uploadId-$index.part"
        try {
            [IO.File]::WriteAllBytes($part, $buffer[0..($read - 1)])
            Invoke-WithRetry {
                Invoke-RestMethod -Method Post `
                    -Uri "$api/ci/client-wx-updates/upload/chunk" `
                    -Headers $headers `
                    -Form @{ uploadId = $uploadId; index = "$index"; file = Get-Item -LiteralPath $part }
            } | Out-Null
        } finally {
            Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
        }
        $index++
    }
} finally {
    $stream.Dispose()
}

Invoke-WithRetry {
    Invoke-RestMethod -Method Post -Uri "$api/ci/client-wx-updates/upload/complete" `
        -Headers $headers -ContentType 'application/json' `
        -Body (@{ uploadId = $uploadId } | ConvertTo-Json)
}
