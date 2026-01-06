using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Error;
using client_win.Modules.Messaging.Models;
using client_win.Modules.Network;
using client_win.Modules.User.Services;

namespace client_win.Modules.Messaging.Services;

/// <summary>
/// Service client pour la messagerie privée (WS).
/// </summary>
public sealed class MessagingService : IMessagingService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;
    private readonly ISoundService _sounds;
    private readonly ErrorBus? _errors;
    private static readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public MessagingService(WsRequestClient ws, ISessionService session, ISoundService sounds, ErrorBus? errors = null)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _errors = errors;
    }

    public async Task<IReadOnlyList<MessagingMessage>> GetBoxAsync(MessagingBox box, int limit = 100, CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        string? token = user?.Token;
        string boxName = box switch
        {
            MessagingBox.Outbox => "outbox",
            MessagingBox.Deleted => "deleted",
            _ => "inbox"
        };

        var response = await _ws.RequestAsync<BoxPayload>(
            WsMessageTypes.Messaging.Messages,
            new { box = boxName, limit },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            PublishError(response.Error ?? "Chargement messagerie impossible.");
            return Array.Empty<MessagingMessage>();
        }

        return MapMessages(response.Payload.Items);
    }

    public async Task<IReadOnlyList<MessagingMessage>> GetConversationAsync(int userId, int limit = 100, CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        string? token = user?.Token;

        var response = await _ws.RequestAsync<ConversationPayload>(
            WsMessageTypes.Messaging.Conversation,
            new { userId, limit },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            PublishError(response.Error ?? "Conversation indisponible.");
            return Array.Empty<MessagingMessage>();
        }

        return MapMessages(response.Payload.Items);
    }

    public async Task<MessagingMessage?> SendAsync(int recipientId, string text, string? subject = null, CancellationToken cancellationToken = default)
    {
        if (recipientId <= 0 || string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        // SÉCURITÉ: Validation de longueur pour éviter messages trop longs
        const int maxMessageLength = 5000;
        if (text.Length > maxMessageLength)
        {
            PublishError($"Le message ne peut pas dépasser {maxMessageLength} caractères.");
            return null;
        }

        const int maxSubjectLength = 200;
        if (!string.IsNullOrWhiteSpace(subject) && subject.Length > maxSubjectLength)
        {
            PublishError($"Le sujet ne peut pas dépasser {maxSubjectLength} caractères.");
            return null;
        }

        var user = _session.CurrentUser;
        string? token = user?.Token;

        var subjectPayload = string.IsNullOrWhiteSpace(subject) ? null : subject.Trim();

        var response = await _ws.RequestAsync<MessagePayload>(
            WsMessageTypes.Messaging.Send,
            new { recipientId, text, subject = subjectPayload },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload?.Message == null)
        {
            PublishError(response.Error ?? "Envoi impossible.");
            return null;
        }

        _sounds.Play(SoundId.PrivateMessageSent);
        return MapMessage(response.Payload.Message);
    }

    public async Task<MessagingMessage?> DeleteAsync(string messageId, CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        string? token = user?.Token;

        var response = await _ws.RequestAsync<MessagePayload>(
            WsMessageTypes.Messaging.Delete,
            new { messageId },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload?.Message == null)
        {
            PublishError(response.Error ?? "Suppression impossible.");
            return null;
        }

        return MapMessage(response.Payload.Message);
    }

    public async Task<MessagingMessage?> RestoreAsync(string messageId, CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        string? token = user?.Token;

        var response = await _ws.RequestAsync<MessagePayload>(
            WsMessageTypes.Messaging.Restore,
            new { messageId },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload?.Message == null)
        {
            PublishError(response.Error ?? "Restauration impossible.");
            return null;
        }

        return MapMessage(response.Payload.Message);
    }

    public async Task<MessagingMessage?> PurgeAsync(string messageId, CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        string? token = user?.Token;

        var response = await _ws.RequestAsync<MessagePayload>(
            WsMessageTypes.Messaging.Purge,
            new { messageId },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload?.Message == null)
        {
            PublishError(response.Error ?? "Suppression definitive impossible.");
            return null;
        }

        return MapMessage(response.Payload.Message);
    }

    public async Task<MessagingUser?> SearchUserAsync(string query, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return null;
        }

        var user = _session.CurrentUser;
        string? token = user?.Token;

        var response = await _ws.RequestAsync<UserPayload>(
            WsMessageTypes.Messaging.SearchUser,
            new { query },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success)
        {
            PublishError(response.Error ?? "Recherche utilisateur impossible.");
            return null;
        }

        if (response.Payload?.User == null)
        {
            return null;
        }

        return new MessagingUser
        {
            Id = response.Payload.User.Id,
            Username = response.Payload.User.Username ?? string.Empty
        };
    }

    public async Task MarkReadAsync(string messageId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(messageId))
        {
            return;
        }

        var user = _session.CurrentUser;
        string? token = user?.Token;

        // Best-effort; no UI error if it fails.
        _ = await _ws.RequestAsync<object>(
            WsMessageTypes.Messaging.MarkRead,
            new { messageId },
            token,
            cancellationToken).ConfigureAwait(false);
    }

    private static IReadOnlyList<MessagingMessage> MapMessages(IEnumerable<MessageDto>? source)
    {
        if (source == null)
        {
            return Array.Empty<MessagingMessage>();
        }
        return source.Select(MapMessage).Where(m => m != null).Select(m => m!).ToList();
    }

    private static MessagingMessage? MapMessage(MessageDto? dto)
    {
        if (dto == null)
        {
            return null;
        }

        var created = ParseDate(dto.CreatedAt);
        bool isDeleted = !string.IsNullOrWhiteSpace(dto.DeletedAt);

        return new MessagingMessage
        {
            Id = dto.Id ?? string.Empty,
            Sender = new MessagingUser { Id = dto.Sender?.Id ?? 0, Username = dto.Sender?.Username ?? string.Empty },
            Recipient = new MessagingUser { Id = dto.Recipient?.Id ?? 0, Username = dto.Recipient?.Username ?? string.Empty },
            Subject = dto.Subject ?? string.Empty,
            Text = dto.Text ?? string.Empty,
            CreatedAt = created,
            IsSent = string.Equals(dto.Direction, "sent", StringComparison.OrdinalIgnoreCase),
            IsDeleted = isDeleted,
            BoxType = dto.BoxType ?? string.Empty
        };
    }

    private static DateTime ParseDate(string? value)
    {
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var dt))
        {
            return dt;
        }
        return DateTime.UtcNow;
    }

    private void PublishError(string message)
    {
        _errors?.Publish(new AppError(message, ErrorSeverity.Error, context: WsMessageTypes.ErrorContext.Messaging));
    }

    private sealed class BoxPayload
    {
        public string? Box { get; set; }
        public List<MessageDto>? Items { get; set; }
    }

    private sealed class ConversationPayload
    {
        public List<MessageDto>? Items { get; set; }
    }

    private sealed class MessagePayload
    {
        public MessageDto? Message { get; set; }
    }

    private sealed class UserPayload
    {
        public MessagingUserDto? User { get; set; }
    }

    private sealed class MessagingUserDto
    {
        public int Id { get; set; }
        public string? Username { get; set; }
    }

    private sealed class MessageDto
    {
        public string? Id { get; set; }
        public MessagingUserDto? Sender { get; set; }
        public MessagingUserDto? Recipient { get; set; }
        public string? Subject { get; set; }
        public string? Text { get; set; }
        public string? CreatedAt { get; set; }
        public string? Direction { get; set; }
        public string? DeletedAt { get; set; }
        public string? BoxType { get; set; }
    }
}
