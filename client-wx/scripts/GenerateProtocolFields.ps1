param(
    [Parameter(Mandatory = $true)]
    [string]$BackendRoot,
    [Parameter(Mandatory = $true)]
    [string]$OutputRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-GeneratedHeader {
    param(
        [string]$Path,
        [string]$SourceLabel,
        [string]$Namespace,
        [string[]]$Constants,
        [string[]]$ExtraIncludes = @()
    )

    $directory = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($directory)) {
        [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("// Generated from $SourceLabel. Do not edit manually.")
    $lines.Add("#pragma once")
    $lines.Add("")
    foreach ($include in $ExtraIncludes) {
        $lines.Add("#include $include")
    }
    if ($ExtraIncludes.Count -gt 0) {
        $lines.Add("")
    }
    $lines.Add("namespace $Namespace")
    $lines.Add("{")
    foreach ($constant in $Constants) {
        $lines.Add($constant)
    }
    $lines.Add("}")
    $lines.Add("")

    [System.IO.File]::WriteAllText(
        $Path,
        ($lines -join [Environment]::NewLine),
        [System.Text.Encoding]::UTF8
    )
}

$backendRoot = [System.IO.Path]::GetFullPath($BackendRoot)
$outputRoot = [System.IO.Path]::GetFullPath($OutputRoot)

$requiredBackendFiles = @(
    "src/user/ws/auth-ws.handler.ts",
    "src/user/services/user.auth.service.ts",
    "src/social/services/social-profile.service.ts",
    "src/social/services/social-relationship.service.ts",
    "src/presence/services/presence-chat.service.ts",
    "src/chat/services/chat.service.ts",
    "src/messaging/services/messaging.service.ts",
    "src/messaging/ws/ws.dto.ts",
    "src/messaging/ws/messaging-ws.handler.ts"
)

foreach ($relativePath in $requiredBackendFiles) {
    $fullPath = Join-Path $backendRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Source backend introuvable pour la gÃ©nÃ©ration des protocoles: $relativePath"
    }
}

Write-GeneratedHeader `
    -Path (Join-Path $outputRoot "UserAuthFields.generated.h") `
    -SourceLabel "../backend/src/user/{dto,ws,services}" `
    -Namespace "lila::modules::user::infrastructure::remote::fields" `
    -Constants @(
        'inline constexpr std::string_view Payload = "payload";',
        'inline constexpr std::string_view Username = "username";',
        'inline constexpr std::string_view Password = "password";',
        'inline constexpr std::string_view Email = "email";',
        'inline constexpr std::string_view Token = "token";',
        'inline constexpr std::string_view UserId = "userId";',
        'inline constexpr std::string_view Message = "message";',
        'inline constexpr std::string_view JwtUserId = "id";'
    ) `
    -ExtraIncludes @('<string_view>')

Write-GeneratedHeader `
    -Path (Join-Path $outputRoot "SocialProtocolFields.generated.h") `
    -SourceLabel "../backend/src/social/{services,ws}" `
    -Namespace "lila::modules::social::infrastructure::fields" `
    -Constants @(
        'inline constexpr std::string_view DirectionIncoming = "incoming";',
        'inline constexpr std::string_view DirectionOutgoing = "outgoing";',
        'inline constexpr std::string_view DirectionAll = "all";',
        'inline constexpr std::string_view ProfileItems = "profile";',
        'inline constexpr std::string_view Items = "items";',
        'inline constexpr std::string_view Type = "type";',
        'inline constexpr std::string_view Payload = "payload";',
        'inline constexpr std::string_view Query = "query";',
        'inline constexpr std::string_view UserId = "userId";',
        'inline constexpr std::string_view Direction = "direction";',
        'inline constexpr std::string_view SearchId = "id";',
        'inline constexpr std::string_view SearchUsername = "username";',
        'inline constexpr std::string_view SearchAvatar = "avatar";',
        'inline constexpr std::string_view SearchSince = "since";',
        'inline constexpr std::string_view SearchCreatedAt = "createdAt";',
        'inline constexpr std::string_view SearchBlockedAt = "blockedAt";',
        'inline constexpr std::string_view SearchProfileVisibility = "profileVisibility";',
        'inline constexpr std::string_view SocialId = "id";',
        'inline constexpr std::string_view SocialProfile = "user";',
        'inline constexpr std::string_view SocialBio = "bio";',
        'inline constexpr std::string_view SocialVictoryMessage = "victoryMessage";',
        'inline constexpr std::string_view SocialDefeatMessage = "defeatMessage";',
        'inline constexpr std::string_view SocialVisibility = "visibility";',
        'inline constexpr std::string_view SocialVisibilityPublic = "public";',
        'inline constexpr std::string_view SocialVisibilityFriends = "friends";',
        'inline constexpr std::string_view SocialVisibilityPrivate = "private";',
        'inline constexpr std::string_view SocialCreatedAt = "createdAt";',
        'inline constexpr std::string_view SocialUpdatedAt = "updatedAt";',
        'inline constexpr std::string_view SocialIsOwner = "isOwner";',
        'inline constexpr std::string_view SocialCanView = "canView";',
        'inline constexpr std::string_view SocialRequester = "requester";',
        'inline constexpr std::string_view SocialAddressee = "addressee";'
    ) `
    -ExtraIncludes @('<string_view>')

Write-GeneratedHeader `
    -Path (Join-Path $outputRoot "ChatProtocolFields.generated.h") `
    -SourceLabel "../backend/src/{presence,chat}/services" `
    -Namespace "lila::modules::chat::infrastructure::fields" `
    -Constants @(
        'inline constexpr int DefaultHistoryLoadLimit = 300;',
        'inline constexpr std::size_t MaxHistoryMessages = 500;',
        'inline constexpr std::string_view Type = "type";',
        'inline constexpr std::string_view Payload = "payload";',
        'inline constexpr std::string_view Messages = "messages";',
        'inline constexpr std::string_view EditWindowSeconds = "editWindowSeconds";',
        'inline constexpr std::string_view Message = "message";',
        'inline constexpr std::string_view Id = "id";',
        'inline constexpr std::string_view MessageId = "messageId";',
        'inline constexpr std::string_view Text = "text";',
        'inline constexpr std::string_view From = "from";',
        'inline constexpr std::string_view User = "user";',
        'inline constexpr std::string_view Username = "username";',
        'inline constexpr std::string_view CreatedAt = "createdAt";',
        'inline constexpr std::string_view ErrorMessage = "message";',
        'inline constexpr std::string_view ErrorReason = "reason";',
        'inline constexpr std::string_view ErrorUntil = "until";'
    ) `
    -ExtraIncludes @('<cstddef>', '<string_view>')

Write-GeneratedHeader `
    -Path (Join-Path $outputRoot "MessagingProtocolFields.generated.h") `
    -SourceLabel "../backend/src/messaging/{services,ws}" `
    -Namespace "lila::modules::messaging::infrastructure::fields" `
    -Constants @(
        'inline constexpr int DefaultPageLimit = 100;',
        'inline constexpr std::string_view Message = "message";',
        'inline constexpr std::string_view SearchResult = "user";',
        'inline constexpr std::string_view Box = "box";',
        'inline constexpr std::string_view Query = "query";',
        'inline constexpr std::string_view QueryAlt = "username";',
        'inline constexpr std::string_view Limit = "limit";',
        'inline constexpr std::string_view ConversationUserId = "userId";',
        'inline constexpr std::string_view RecipientId = "recipientId";',
        'inline constexpr std::string_view MessageId = "messageId";',
        'inline constexpr std::string_view Text = "text";',
        'inline constexpr std::string_view Subject = "subject";',
        'inline constexpr std::string_view Type = "type";',
        'inline constexpr std::string_view Payload = "payload";',
        'inline constexpr std::string_view Items = "items";',
        'inline constexpr std::string_view Direction = "direction";',
        'inline constexpr std::string_view DeletedAt = "deletedAt";',
        'inline constexpr std::string_view BoxType = "boxType";',
        'inline constexpr std::string_view Sender = "sender";',
        'inline constexpr std::string_view Recipient = "recipient";',
        'inline constexpr std::string_view CreatedAt = "createdAt";',
        'inline constexpr std::string_view SentDirection = "sent";',
        'inline constexpr std::string_view ReceivedDirection = "received";',
        'inline constexpr std::string_view InboxBox = "inbox";',
        'inline constexpr std::string_view OutboxBox = "outbox";',
        'inline constexpr std::string_view DeletedBox = "deleted";',
        'inline constexpr std::string_view Id = "id";'
    ) `
    -ExtraIncludes @('<string_view>')
