using System;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Navigation minimaliste basée sur un ContentControl.
/// </summary>
public sealed class NavigationService : INavigationService
{
    private UserContext _currentUser = UserContext.Empty;

    public object? CurrentContent { get; private set; }
    public UserContext CurrentUser => _currentUser;

    public event EventHandler<object?>? CurrentContentChanged;

    public NavigationService() { }

    public void SetUser(UserContext user)
    {
        _currentUser = user ?? throw new ArgumentNullException(nameof(user));
    }

    public void ClearUser()
    {
        _currentUser = UserContext.Empty;
    }

    public void Show(object content)
    {
        CurrentContent = content ?? throw new ArgumentNullException(nameof(content));
        try
        {
            CurrentContentChanged?.Invoke(this, content);
        }
        catch
        {
            // Best-effort : ne pas casser la navigation si un listener échoue.
        }

        // Accessibilité : donner une opportunité au focus clavier d'atterrir dans la nouvelle vue.
#if false
        _host.Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
        {
            try
            {
                if (content is not UserControl view)
                {
                    return;
                }

                if (view.IsKeyboardFocusWithin)
                {
                    return;
                }

                // MoveFocus fonctionne même si le UserControl lui-même n'est pas Focusable.
                view.MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
            }
            catch
            {
                // Best-effort : ne pas empêcher la navigation si la vue ne supporte pas le focus.
            }
        }));
#endif
    }
}

public sealed class UserContext
{
    public UserContext(string username, string token)
    {
        Username = username;
        Token = token;
    }

    public string Username { get; }
    public string Token { get; }

    public bool IsAuthenticated => !string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Token);

    public static UserContext Empty => new(string.Empty, string.Empty);
}
