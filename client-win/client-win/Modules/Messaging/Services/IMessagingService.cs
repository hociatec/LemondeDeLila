using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Messaging.Models;

namespace client_win.Modules.Messaging.Services;

public interface IMessagingService
{
    Task<IReadOnlyList<MessagingMessage>> GetBoxAsync(MessagingBox box, int limit = 100, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<MessagingMessage>> GetConversationAsync(int userId, int limit = 100, CancellationToken cancellationToken = default);
    Task<MessagingMessage?> SendAsync(int recipientId, string text, string? subject = null, CancellationToken cancellationToken = default);
    Task<MessagingMessage?> DeleteAsync(string messageId, CancellationToken cancellationToken = default);
    Task<MessagingMessage?> RestoreAsync(string messageId, CancellationToken cancellationToken = default);
    Task<MessagingMessage?> PurgeAsync(string messageId, CancellationToken cancellationToken = default);
    Task<MessagingUser?> SearchUserAsync(string query, CancellationToken cancellationToken = default);
    Task MarkReadAsync(string messageId, CancellationToken cancellationToken = default);
}
