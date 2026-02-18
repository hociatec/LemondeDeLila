namespace client_win.Modules.Game.Shell.Services;

public interface IGameFocusHost
{
    void ActivateWindow();
    GameFocusAttemptResult FocusGameZone(GameFocusReason reason);
}
