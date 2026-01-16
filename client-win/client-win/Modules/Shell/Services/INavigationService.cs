namespace client_win.Modules.Shell.Services;

public interface INavigationService
{
    object? CurrentContent { get; }
    UserContext CurrentUser { get; }

    event System.EventHandler<object?>? CurrentContentChanged;

    void SetUser(UserContext user);
    void ClearUser();
    void Show(object content);
}
