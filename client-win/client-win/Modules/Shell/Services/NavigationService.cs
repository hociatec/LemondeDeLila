using System;
using System.Windows;
using System.Windows.Threading;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Navigation minimaliste basée sur un ContentControl.
/// </summary>
public sealed class NavigationService : INavigationService
{
    private UserContext _currentUser = UserContext.Empty;
    private readonly INavigationFocusManager? _focusManager;

    public object? CurrentContent { get; private set; }
    public UserContext CurrentUser => _currentUser;

    public event EventHandler<object?>? CurrentContentChanged;

    public NavigationService(INavigationFocusManager? focusManager = null)
    {
        _focusManager = focusManager;
    }

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
        // Navigation must run on the UI thread to keep focus transitions deterministic for screen readers.
        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher != null && !dispatcher.CheckAccess())
        {
            dispatcher.Invoke(() => Show(content), DispatcherPriority.Send);
            return;
        }

        try
        {
            _focusManager?.BeforeNavigation();
        }
        catch
        {
            // best-effort
        }

        CurrentContent = content ?? throw new ArgumentNullException(nameof(content));
        try
        {
            CurrentContentChanged?.Invoke(this, content);
        }
        catch
        {
            // Best-effort : ne pas casser la navigation si un listener échoue.
        }

        try
        {
            _focusManager?.AfterNavigation(content);
        }
        catch
        {
            // best-effort
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
