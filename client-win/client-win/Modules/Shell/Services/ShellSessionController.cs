using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Audio.Services;
using client_win.Modules.Config;
using client_win.Modules.MainMenu.ViewModels;
using client_win.Modules.Network.Services;
using client_win.Modules.User.Models;
using client_win.Modules.User.Services;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace client_win.Modules.Shell.Services;

public sealed class ShellSessionController
{
    private readonly AppHost _host;
    private readonly INavigationService _navigation;
    private readonly IHomeViewAccessor _homeAccessor;
    private readonly INotifyListener _notify;
    private readonly Modules.Presence.Services.IPresenceMonitor _presence;
    private readonly IAppAudioCoordinator _audio;

    public ShellSessionController(
        AppHost host,
        INavigationService navigation,
        IHomeViewAccessor homeAccessor,
        INotifyListener notify,
        Modules.Presence.Services.IPresenceMonitor presence,
        IAppAudioCoordinator audio)
    {
        _host = host ?? throw new ArgumentNullException(nameof(host));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _homeAccessor = homeAccessor ?? throw new ArgumentNullException(nameof(homeAccessor));
        _notify = notify ?? throw new ArgumentNullException(nameof(notify));
        _presence = presence ?? throw new ArgumentNullException(nameof(presence));
        _audio = audio ?? throw new ArgumentNullException(nameof(audio));
    }

    private static void SafeKickoff(Func<Task> start, string name)
    {
        try
        {
            var task = start();
            _ = task.ContinueWith(t =>
            {
                try
                {
                    Log.Warning(t.Exception, "Background task failed: {TaskName}", name);
                }
                catch
                {
                    // ignore
                }
            }, TaskContinuationOptions.OnlyOnFaulted);
        }
        catch (Exception ex)
        {
            try
            {
                Log.Warning(ex, "Background task threw synchronously: {TaskName}", name);
            }
            catch
            {
                // ignore
            }
        }
    }

    public async Task NavigateToMainMenuAsync(AuthenticatedUser user, Action onLogoutRequested)
    {
        _navigation.SetUser(new UserContext(user.Username, user.Token));
        _host.Session.SetUser(user);
        _audio.NotifyLoginSucceeded();

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
        SafeKickoff(() => _host.Services.GetRequiredService<Modules.Catalog.Services.ICatalogService>().PreloadAsync(cts.Token), "catalog.preload");
        SafeKickoff(() => _notify.StartAsync(), "notify.start");
        SafeKickoff(() => _presence.StartAsync(), "presence.start");

        try
        {
            using var warmCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            _ = _host.Services
                .GetRequiredService<Modules.Game.Room.Services.IRoomGatewayClient>()
                .WarmUpAsync(warmCts.Token);
        }
        catch
        {
            // ignore
        }

        try
        {
            using var warmCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            _ = _host.Services
                .GetRequiredService<Modules.Game.Play.Session.Services.IGameGatewayClient>()
                .WarmUpAsync(warmCts.Token);
        }
        catch
        {
            // ignore
        }

        try
        {
            _ = _host.Services
                .GetRequiredService<Modules.Network.Services.IApiCapabilitiesService>()
                .GetAsync();
        }
        catch
        {
            // ignore
        }

        try
        {
            _ = _audio.RefreshRemoteSoundsAsync(force: true, reapplyBackground: false);
        }
        catch
        {
            // ignore
        }

        var menuVm = _host.CreateMainMenuViewModel(user, onLogoutRequested);
        _homeAccessor.HomeContent = menuVm;
        _navigation.Show(menuVm);
    }

    public void LogoutToHome(object homeContent)
    {
        _ = LogoutToHomeAsync(homeContent);
    }

    private async Task LogoutToHomeAsync(object homeContent)
    {
        _ = _notify.StopAsync();
        _ = _presence.StopAsync();

        // IMPORTANT: laisser un feedback sonore fiable lors d'une déconnexion volontaire.
        _audio.NotifyLogoutRequested();
        try
        {
            await _audio.PlayDisconnectAndWaitAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(true);
        }
        catch
        {
            // ignore
        }

        _host.Session.Clear();
        _navigation.ClearUser();
        _homeAccessor.HomeContent = null;
        _navigation.Show(homeContent);
    }
}
