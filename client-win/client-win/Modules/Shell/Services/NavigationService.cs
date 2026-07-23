using System;
using System.Threading;
using System.Threading.Tasks;
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
    private CancellationTokenSource? _navigationLifecycleCts;
    private long _navigationVersion;

    public object? CurrentContent { get; private set; }
    public ShellRoute? CurrentRoute { get; private set; }
    public UserContext CurrentUser => _currentUser;

    public event EventHandler<object?>? CurrentContentChanged;
    public event EventHandler<ShellRoute?>? CurrentRouteChanged;

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
        ArgumentNullException.ThrowIfNull(content);

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

        var previousContent = CurrentContent;
        var previousRoute = CurrentRoute;
        var nextRoute = ShellRoute.FromContent(content);
        var navigationVersion = unchecked(++_navigationVersion);

        CurrentContent = content;
        CurrentRoute = nextRoute;
        try
        {
            CurrentContentChanged?.Invoke(this, content);
            CurrentRouteChanged?.Invoke(this, nextRoute);
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

        ScheduleLifecycle(previousContent, previousRoute, content, nextRoute, navigationVersion);

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

    private void ScheduleLifecycle(
        object? previousContent,
        ShellRoute? previousRoute,
        object nextContent,
        ShellRoute nextRoute,
        long navigationVersion)
    {
        try
        {
            _navigationLifecycleCts?.Cancel();
            _navigationLifecycleCts?.Dispose();
            _navigationLifecycleCts = new CancellationTokenSource();
            var token = _navigationLifecycleCts.Token;

            var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
            _ = dispatcher.BeginInvoke(
                DispatcherPriority.ContextIdle,
                new Action(async () =>
                {
                    if (navigationVersion != _navigationVersion || token.IsCancellationRequested)
                    {
                        return;
                    }

                    await RunLifecycleAsync(previousContent, previousRoute, nextContent, nextRoute, token)
                        .ConfigureAwait(true);
                }));
        }
        catch
        {
            // best-effort
        }
    }

    private async Task RunLifecycleAsync(
        object? previousContent,
        ShellRoute? previousRoute,
        object nextContent,
        ShellRoute nextRoute,
        CancellationToken cancellationToken)
    {
        try
        {
            if (previousContent is IShellNavigationAware previousAware && previousRoute != null)
            {
                await previousAware
                    .OnNavigatedFromAsync(new ShellNavigationContext(previousRoute, previousContent, CurrentUser), cancellationToken)
                    .ConfigureAwait(true);
            }
        }
        catch
        {
            // best-effort
        }

        if (cancellationToken.IsCancellationRequested)
        {
            return;
        }

        try
        {
            if (nextContent is IShellNavigationAware nextAware)
            {
                await nextAware
                    .OnNavigatedToAsync(new ShellNavigationContext(nextRoute, nextContent, CurrentUser), cancellationToken)
                    .ConfigureAwait(true);
            }
        }
        catch
        {
            // best-effort
        }
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
