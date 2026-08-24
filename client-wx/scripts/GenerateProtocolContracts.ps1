param(
    [Parameter(Mandatory = $true)] [string]$BackendRoot,
    [Parameter(Mandatory = $true)] [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$eventsPath = Join-Path $BackendRoot 'src/realtime/infrastructure/presentation/ws/ws-events.ts'
$fieldsPath = Join-Path $BackendRoot 'contracts/client-wx-fields.json'
foreach ($requiredPath in @($eventsPath, $fieldsPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Contrat backend introuvable: $requiredPath"
    }
}

[System.IO.Directory]::CreateDirectory($OutputRoot) | Out-Null
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Write-GeneratedFile {
    param([string]$Path, [string]$Content)
    $normalized = $Content.Replace("`r`n", "`n").TrimEnd() + "`n"
    if (Test-Path -LiteralPath $Path) {
        $existing = [System.IO.File]::ReadAllText($Path).Replace("`r`n", "`n")
        if ($existing -eq $normalized) { return }
    }
    [System.IO.File]::WriteAllText($Path, $normalized, $utf8NoBom)
}

function Convert-ToCppIdentifier {
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name) -or $Name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        throw "Identifiant de contrat invalide: '$Name'"
    }
    return $Name.Substring(0, 1).ToUpperInvariant() + $Name.Substring(1)
}

function Escape-CppString {
    param([string]$Value)
    return $Value.Replace('\', '\\').Replace('"', '\"')
}

function Render-EventNodes {
    param([System.Text.StringBuilder]$Builder, [System.Collections.IEnumerable]$Nodes)
    foreach ($node in $Nodes) {
        if ($node.Kind -eq 'namespace') {
            [void]$Builder.AppendLine("namespace $($node.Name)")
            [void]$Builder.AppendLine('{')
            Render-EventNodes -Builder $Builder -Nodes $node.Children
            [void]$Builder.AppendLine('}')
            [void]$Builder.AppendLine()
        }
        else {
            $identifier = Convert-ToCppIdentifier $node.Name
            $escapedValue = Escape-CppString $node.Value
            [void]$Builder.AppendLine("inline constexpr std::string_view $identifier = `"$escapedValue`";")
        }
    }
}

function Parse-WsEvents {
    param([string]$Path)
    $root = [System.Collections.ArrayList]::new()
    $containers = [System.Collections.ArrayList]::new()
    [void]$containers.Add($root)
    $started = $false
    $finished = $false

    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if (-not $started) {
            if ($line -match '^\s*export\s+const\s+WS_EVENTS\s*=\s*{\s*$') { $started = $true }
            continue
        }
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*{\s*$') {
            $children = [System.Collections.ArrayList]::new()
            [void]$containers[$containers.Count - 1].Add(
                [pscustomobject]@{ Kind = 'namespace'; Name = $Matches[1]; Children = $children })
            [void]$containers.Add($children)
            continue
        }
        if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'([^']+)'\s*,?\s*$") {
            [void]$containers[$containers.Count - 1].Add(
                [pscustomobject]@{ Kind = 'value'; Name = $Matches[1]; Value = $Matches[2] })
            continue
        }
        if ($line -match '^\s*}\s*(?:as\s+const)?\s*;?\s*$' -or $line -match '^\s*},?\s*$') {
            if ($containers.Count -eq 1) { $finished = $true; break }
            $containers.RemoveAt($containers.Count - 1)
            continue
        }
        if ($line.Trim().Length -gt 0) {
            throw "Syntaxe WS_EVENTS non prise en charge dans ${Path}: $line"
        }
    }
    if (-not $started -or -not $finished -or $root.Count -eq 0) {
        throw "Impossible d'analyser WS_EVENTS dans $Path"
    }
    return $root
}

$eventNodes = Parse-WsEvents $eventsPath
$eventsBuilder = [System.Text.StringBuilder]::new()
[void]$eventsBuilder.AppendLine('// Generated from backend WS_EVENTS. Do not edit manually.')
[void]$eventsBuilder.AppendLine('#pragma once')
[void]$eventsBuilder.AppendLine()
[void]$eventsBuilder.AppendLine('#include <string_view>')
[void]$eventsBuilder.AppendLine()
[void]$eventsBuilder.AppendLine('namespace lila::shared::network::ws::types')
[void]$eventsBuilder.AppendLine('{')
Render-EventNodes -Builder $eventsBuilder -Nodes $eventNodes
[void]$eventsBuilder.AppendLine('}')
Write-GeneratedFile -Path (Join-Path $OutputRoot 'WsMessageTypes.generated.h') -Content $eventsBuilder.ToString()

$manifest = Get-Content -Raw -LiteralPath $fieldsPath | ConvertFrom-Json
if ($null -eq $manifest.headers -or $manifest.headers.Count -eq 0) {
    throw "Le manifeste ne contient aucun header: $fieldsPath"
}

$seenFiles = @{}
foreach ($header in $manifest.headers) {
    if ($seenFiles.ContainsKey($header.file)) { throw "Header duplique: $($header.file)" }
    $seenFiles[$header.file] = $true
    $builder = [System.Text.StringBuilder]::new()
    [void]$builder.AppendLine('// Generated from backend/contracts/client-wx-fields.json. Do not edit manually.')
    [void]$builder.AppendLine('#pragma once')
    [void]$builder.AppendLine()
    foreach ($include in $header.includes) { [void]$builder.AppendLine("#include <$include>") }
    [void]$builder.AppendLine()
    [void]$builder.AppendLine("namespace $($header.namespace)")
    [void]$builder.AppendLine('{')
    $seenConstants = @{}
    foreach ($constant in $header.constants) {
        if ($seenConstants.ContainsKey($constant.name)) {
            throw "Constante dupliquee dans $($header.file): $($constant.name)"
        }
        $seenConstants[$constant.name] = $true
        if ($constant.type -eq 'std::string_view') {
            $value = Escape-CppString ([string]$constant.value)
            [void]$builder.AppendLine("inline constexpr $($constant.type) $($constant.name) = `"$value`";")
        }
        elseif ($constant.type -in @('int', 'std::size_t')) {
            $numericValue = [Convert]::ToInt64($constant.value)
            [void]$builder.AppendLine("inline constexpr $($constant.type) $($constant.name) = $numericValue;")
        }
        else { throw "Type de constante non pris en charge: $($constant.type)" }
    }
    [void]$builder.AppendLine('}')
    Write-GeneratedFile -Path (Join-Path $OutputRoot $header.file) -Content $builder.ToString()
}
