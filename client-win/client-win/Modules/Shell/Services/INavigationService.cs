namespace client_win.Modules.Shell.Services;

public interface INavigationService
{
    object? CurrentContent { get; }
    ShellRoute? CurrentRoute { get; }
    UserContext CurrentUser { get; }

    event System.EventHandler<object?>? CurrentContentChanged;
    event System.EventHandler<ShellRoute?>? CurrentRouteChanged;

    void SetUser(UserContext user);
    void ClearUser();
    void Show(object content);
}
