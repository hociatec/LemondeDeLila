using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Audio.Models;

namespace client_win.Modules.Audio.Services;

public interface IAppAudioCoordinator
{
    void NotifyLoginSucceeded();
    void NotifyLogoutRequested();
    void SetBackground(AppAudioBackground background);
    void PauseBackground();
    void ResumeBackground();
    Task RefreshRemoteSoundsAsync(bool force, CancellationToken cancellationToken = default);
    Task PlayDisconnectAndWaitAsync(TimeSpan timeout);
}

