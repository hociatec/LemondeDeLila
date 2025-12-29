using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Updates;

public interface IClientUpdatePublisher
{
    Task<string?> GetLatestPublishedVersionAsync(CancellationToken cancellationToken = default);

    string SuggestNextVersion(string? currentVersion);

    Task<ClientUpdatePublishResult> BuildAndUploadAsync(
        string? message,
        string? version,
        CancellationToken cancellationToken = default);
}
