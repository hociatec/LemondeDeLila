using System;
using System.ComponentModel;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Audio.Services;
using client_win.Modules.Config;
using client_win.Modules.Error;
using client_win.Modules.Home.ViewModels;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Network.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.User.Models;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Shell.ViewModels;

public sealed class ShellViewModel : ObservableObject
{
    private readonly AppHost _host;
    private readonly Action _requestClose;
    private readonly ILogger<ShellViewModel> _logger;

    private readonly INavigationService _navigation;
    private readonly HomeViewModel _homeViewModel;
    private readonly EventHandler<object?> _contentChangedHandler;
    private readonly ShellErrorHandler _errorHandler;
    private readonly ShellStartupController _startup;
    private readonly ShellSessionController _session;
    private readonly ShellInputController _input;
    private readonly ShellCloseCoordinator _close;
    private readonly NavigationAudioSync _audioSync;

    private string _windowTitle = "Le Monde de Lila";

    public ShellViewModel(
        AppHost host,
        Action requestClose,
        ILogger<ShellViewModel> logger,
        IOptionsService options,
        INotifyListener notify,
        IPresenceMonitor presence,
        IPresenceLauncher presenceUi,
        IHomeViewAccessor homeAccessor,
        IMenuRouter menuRouter,
        IAppAudioCoordinator audio)
    {
        _host = host ?? throw new ArgumentNullException(nameof(host));
        _requestClose = requestClose ?? throw new ArgumentNullException(nameof(requestClose));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        var dialogs = _host.Dialogs;
        _navigation = _host.Navigation;
        _homeViewModel = _host.CreateHomeViewModel(OnNavigateToMainMenu, _requestClose);

        _contentChangedHandler = (_, _) => OnPropertyChanged(nameof(CurrentContent));
        _navigation.CurrentContentChanged += _contentChangedHandler;

        _audioSync = new NavigationAudioSync(_navigation, audio);
        _errorHandler = new ShellErrorHandler(
            _host.Errors,
            _navigation,
            dialogs,
            _host.Configuration,
            () => _homeViewModel,
            _host.CrashReporter);
        _startup = new ShellStartupController(_navigation, _homeViewModel, _host.Configuration, dialogs, _host.Errors);
        _session = new ShellSessionController(_host, _navigation, homeAccessor, notify, presence, audio);
        _input = new ShellInputController(presence, presenceUi, _navigation, menuRouter, homeAccessor);
        _close = new ShellCloseCoordinator(dialogs, options, audio);
    }

    public string WindowTitle
    {
        get => _windowTitle;
        private set => SetProperty(ref _windowTitle, value);
    }

    public object? CurrentContent => _navigation.CurrentContent;

    public async Task OnLoadedAsync()
    {
        try
        {
            await _startup.OnLoadedAsync().ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Shell startup failed");
        }
    }

    public void ShowHomeForStartup()
    {
        try
        {
            _startup.ShowHome();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Shell startup show home failed");
        }
    }

    public void OnClosing(CancelEventArgs e) =>
        _close.OnClosing(() => _host.Session?.CurrentUser != null, e);

    public void OnPreviewKeyDown(Window window, KeyEventArgs e) =>
        _input.OnPreviewKeyDown(window, e);

    public void OnPreviewMouseDown(MouseButtonEventArgs e) =>
        _input.OnPreviewMouseDown(e);

    public void OnActivated() =>
        _input.OnActivated();

    private async void OnNavigateToMainMenu(AuthenticatedUser user)
    {
        WindowTitle = $"Le Monde de Lila - Connecté en tant que {user.Username}";
        try
        {
            await _session.NavigateToMainMenuAsync(user, OnLogoutRequested).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            WindowTitle = "Le Monde de Lila";
            try { _host.Session.Clear(); } catch { /* ignore */ }
            try { _navigation.ClearUser(); } catch { /* ignore */ }

            try
            {
                _host.Errors.Publish(new AppError(
                    "Connexion OK, mais l'ouverture du menu a échoué.",
                    ErrorSeverity.Error,
                    context: "shell.navigate",
                    detail: ex.Message));
            }
            catch
            {
                // ignore
            }

            _logger.LogError(ex, "Navigate to main menu failed");
        }
    }

    private void OnLogoutRequested()
    {
        WindowTitle = "Le Monde de Lila";
        _session.LogoutToHome(_homeViewModel);
    }

    public async Task OnClosedAsync()
    {
        try { _audioSync.Dispose(); } catch { /* ignore */ }
        try { _errorHandler.Dispose(); } catch { /* ignore */ }
        try { _navigation.CurrentContentChanged -= _contentChangedHandler; } catch { /* ignore */ }
        try { await _host.DisposeAsync().ConfigureAwait(false); } catch { /* ignore */ }
    }
}
