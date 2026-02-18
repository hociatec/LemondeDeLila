using System;

namespace client_win.Modules.Game.Shell.Services;

public interface IGameFocusCoordinator
{
    IDisposable AttachHost(IGameFocusHost host);
    void RequestGameZone(GameFocusReason reason = GameFocusReason.Default);
}
