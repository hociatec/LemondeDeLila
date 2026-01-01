using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Audio.Models;

namespace client_win.Modules.Audio.Services;

public interface IRemoteSoundCache
{
    string? TryGetPath(SoundId sound);
    Task RefreshAsync(bool force = false, CancellationToken cancellationToken = default);
}
