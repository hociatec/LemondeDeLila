using System;
using System.ComponentModel;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Audio.Services;
using client_win.Modules.Config;
using client_win.Modules.Home.Views;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Network.Services;
using client_win.Modules.Presence.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.User.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Shell.ViewModels;

public sealed class ShellViewModel : ObservableObject
{
    private readonly AppHost _host;
    private readonly Action _requestClose;
    private readonly ILogger<ShellViewModel> _logger;

    private readonly INavigationService _navigation;
    private readonly HomeView _homeView;
    private readonly ShellErrorHandler _errorHandler;
    private readonly ShellStartupController _startup;
    private readonly ShellSessionController _session;
    private readonly ShellInputController _input;
    private readonly ShellCloseCoordinator _close;
    private readonly NavigationAudioSync _audioSync;

    private string _windowTitle = "Le Monde de Lila";

    public ShellViewModel(AppHost host, Action requestClose)
    {
        _host = host ?? throw new ArgumentNullException(nameof(host));
        _requestClose = requestClose ?? throw new ArgumentNullException(nameof(requestClose));
        _logger = host.Services.GetRequiredService<ILogger<ShellViewModel>>();

        var dialogs = _host.Dialogs;
        var options = _host.Services.GetRequiredService<IOptionsService>();
        var notify = _host.Services.GetRequiredService<INotifyListener>();
        var presence = _host.Services.GetRequiredService<IPresenceMonitor>();
        var presenceUi = _host.Services.GetRequiredService<IPresenceLauncher>();
        var homeAccessor = _host.Services.GetRequiredService<IHomeViewAccessor>();
        var menuRouter = _host.Services.GetRequiredService<IMenuRouter>();
        var audio = _host.Services.GetRequiredService<IAppAudioCoordinator>();

        var homeViewModel = _host.CreateHomeViewModel(OnNavigateToMainMenu, _requestClose);
        _homeView = new HomeView { DataContext = homeViewModel };
        _navigation = _host.Navigation;

        _audioSync = new NavigationAudioSync(_navigation, audio);
        _errorHandler = new ShellErrorHandler(_host.Errors, _navigation, dialogs, _host.Configuration, () => _homeView, _host.CrashReporter);
        _startup = new ShellStartupController(_navigation, homeViewModel, _homeView, _host.Configuration, dialogs, _host.Errors);
        _session = new ShellSessionController(_host, _navigation, homeAccessor, notify, presence, audio);
        _input = new ShellInputController(presence, presenceUi, _navigation, menuRouter);
        _close = new ShellCloseCoordinator(dialogs, options, audio);
    }

    public string WindowTitle
    {
        get => _windowTitle;
        private set => SetProperty(ref _windowTitle, value);
    }

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
        WindowTitle = $"Le Monde de Lila - Connecte en tant que {user.Username}";
        try
        {
            await _session.NavigateToMainMenuAsync(user, OnLogoutRequested).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Navigate to main menu failed");
        }
    }

    private void OnLogoutRequested()
    {
        WindowTitle = "Le Monde de Lila";
        _session.LogoutToHome(_homeView);
    }

    public async Task OnClosedAsync()
    {
        try { _audioSync.Dispose(); } catch { /* ignore */ }
        try { _errorHandler.Dispose(); } catch { /* ignore */ }
        try { await _host.DisposeAsync().ConfigureAwait(false); } catch { /* ignore */ }
    }
}
