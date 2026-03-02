using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Services;

public interface IGameHistoryAnnouncer
{
    void SetScreenReader(IScreenReaderAnnouncer? screenReader);
    void NotifyUserInteraction();
    void CancelPendingAnnouncements();
    void Announce(string message, bool assertive, bool flushPending);
}
