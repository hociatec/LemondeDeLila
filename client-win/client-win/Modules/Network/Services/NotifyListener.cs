using System;
using System.Text.Json;
using System.Threading.Tasks;
using System.Threading;
using client_win.Modules.Config;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Shell.Services;
using client_win.Modules.User.Services;
using client_win.Modules.Updates;
using Serilog;

namespace client_win.Modules.Network.Services;

public sealed class NotifyListener : INotifyListener, IAsyncDisposable
{
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly Func<IWebSocketConnection> _wsFactory;
    private readonly IScreenReaderAnnouncer _screenReader;
    private readonly ICatalogService _catalog;
    private readonly IDialogService _dialogs;
    private readonly SemaphoreSlim _updateGate = new(1, 1);

    private IWebSocketConnection? _ws;
    private bool _started;

    public NotifyListener(
        ClientConfiguration config,
        ISessionService session,
        Func<IWebSocketConnection> wsFactory,
        IScreenReaderAnnouncer screenReader,
        ICatalogService catalog,
        IDialogService dialogs)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _wsFactory = wsFactory ?? throw new ArgumentNullException(nameof(wsFactory));
        _screenReader = screenReader ?? throw new ArgumentNullException(nameof(screenReader));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
    }

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_started) return;
        var token = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        _started = true;
        _ws = _wsFactory();
        _ws.MessageReceived += OnMessage;
        _ws.Error += msg => Log.Warning("WS notify error: {Message}", msg);

        try
        {
            await _ws.ConnectAsync(_config.NotifyGatewayWs, token, headers: null, cancellationToken).ConfigureAwait(false);
            Log.Information("Connexion WS notify établie.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Impossible de se connecter au WS notify.");
            await StopAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        _started = false;
        var ws = _ws;
        _ws = null;
        if (ws != null)
        {
            ws.MessageReceived -= OnMessage;
            try
            {
                await ws.CloseAsync().ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
        }
    }

    private void OnMessage(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (string.IsNullOrWhiteSpace(type)) return;

            if (string.Equals(type, "admin.broadcast", StringComparison.OrdinalIgnoreCase))
            {
                var message = root.TryGetProperty("payload", out var p) && p.TryGetProperty("message", out var m)
                    ? (m.GetString() ?? string.Empty)
                    : string.Empty;
                if (!string.IsNullOrWhiteSpace(message))
                {
                    _screenReader.AnnouncePolite(message);
                }
            }
            else if (string.Equals(type, "catalog.invalidate", StringComparison.OrdinalIgnoreCase))
            {
                _catalog.InvalidateCache();
            }
            else if (string.Equals(type, "client.update.available", StringComparison.OrdinalIgnoreCase))
            {
                var payload = root.TryGetProperty("payload", out var p) ? p : default;
                var message = payload.ValueKind != JsonValueKind.Undefined && payload.TryGetProperty("message", out var m)
                    ? (m.GetString() ?? string.Empty)
                    : string.Empty;
                var version = payload.ValueKind != JsonValueKind.Undefined && payload.TryGetProperty("version", out var v)
                    ? (v.GetString() ?? string.Empty)
                    : string.Empty;

                _ = HandleClientUpdateAvailableAsync(message, version);
            }
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "Message notify invalide.");
        }
    }

    private async Task HandleClientUpdateAvailableAsync(string message, string version)
    {
        if (!await _updateGate.WaitAsync(0).ConfigureAwait(false))
        {
            return;
        }

        try
        {
            var msg = string.IsNullOrWhiteSpace(message)
                ? "Une mise à jour du client est disponible."
                : message.Trim();

            if (!string.IsNullOrWhiteSpace(version))
            {
                msg += $"\nVersion annoncée : {version.Trim()}";
            }

            var confirm = await _dialogs.Confirm("Mise à jour", msg + "\n\nInstaller maintenant ?").ConfigureAwait(true);
            if (confirm != true)
            {
                return;
            }

            if (!UpdateEnvironment.IsLikelyClickOnceInstall() || UpdateEnvironment.IsRunningUnderDotnetHost())
            {
                await _dialogs.ShowInfo(
                        "Mise à jour",
                        "Mise à jour publiée.\n\n" +
                        "Ce client est lancé en mode dev (dotnet run) ou hors ClickOnce : les mises à jour automatiques ne s'appliquent pas.\n" +
                        "Ferme l'application, puis relance la version installée ClickOnce (setup.exe) pour voir la mise à jour.")
                    .ConfigureAwait(true);
                return;
            }

            // ClickOnce applique les mises à jour au démarrage : on force un redémarrage.
            Log.Information("Mise à jour acceptée (notify): version={Version}", version?.Trim());
            UpdateRestartHelper.RestartCurrentProcess("notify");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Erreur lors de la mise à jour client (notify).");
            await _dialogs.ShowError("Mise à jour", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            _updateGate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync().ConfigureAwait(false);
        _updateGate.Dispose();
    }
}
