using System;
using System.Text.Json;
using System.Threading.Tasks;
using System.Threading;
using client_win.Core;
using client_win.Modules.Config;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Shell.Services;
using client_win.Modules.User.Services;
using client_win.Modules.Updates;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Game.Shell.Services;
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
    private readonly IRoomDirectoryClient _rooms;
    private readonly IGameTableOpener _tables;
    private readonly INavigationService _navigation;
    private readonly SemaphoreSlim _updateGate = new(1, 1);

    private IWebSocketConnection? _ws;
    private bool _started;

    public NotifyListener(
        ClientConfiguration config,
        ISessionService session,
        Func<IWebSocketConnection> wsFactory,
        IScreenReaderAnnouncer screenReader,
        ICatalogService catalog,
        IDialogService dialogs,
        IRoomDirectoryClient rooms,
        IGameTableOpener tables,
        INavigationService navigation)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _wsFactory = wsFactory ?? throw new ArgumentNullException(nameof(wsFactory));
        _screenReader = screenReader ?? throw new ArgumentNullException(nameof(screenReader));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _rooms = rooms ?? throw new ArgumentNullException(nameof(rooms));
        _tables = tables ?? throw new ArgumentNullException(nameof(tables));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
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

            // Handshake version: permet au serveur de proposer la MAJ à chaque connexion.
            try
            {
                var hello = JsonSerializer.Serialize(new
                {
                    type = "client.hello",
                    payload = new { version = AppInfo.GetShortVersion() },
                });
                await _ws.SendAsync(hello, cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                // Best-effort
            }
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
            else if (string.Equals(type, "rooms.invite.received", StringComparison.OrdinalIgnoreCase))
            {
                _ = HandleRoomInviteReceivedAsync(root);
            }
            else if (string.Equals(type, "rooms.invite.responded", StringComparison.OrdinalIgnoreCase))
            {
                HandleRoomInviteResponded(root);
            }
            else if (string.Equals(type, "messaging.new", StringComparison.OrdinalIgnoreCase))
            {
                HandleMessagingNew(root);
            }
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "Message notify invalide.");
        }
    }

    private async Task HandleRoomInviteReceivedAsync(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var invitationId = payload.TryGetProperty("invitationId", out var inv) ? inv.GetString() : null;
            if (string.IsNullOrWhiteSpace(invitationId))
            {
                return;
            }

            string fromName = "inconnu";
            if (payload.TryGetProperty("from", out var from) && from.ValueKind == JsonValueKind.Object &&
                from.TryGetProperty("username", out var u) && u.ValueKind == JsonValueKind.String)
            {
                fromName = u.GetString() ?? fromName;
            }

            int roomId = 0;
            string roomName = "table";
            if (payload.TryGetProperty("room", out var room) && room.ValueKind == JsonValueKind.Object)
            {
                if (room.TryGetProperty("id", out var rid) && rid.ValueKind == JsonValueKind.Number)
                {
                    roomId = rid.GetInt32();
                }
                if (room.TryGetProperty("name", out var rn) && rn.ValueKind == JsonValueKind.String)
                {
                    roomName = rn.GetString() ?? roomName;
                }
            }

            _screenReader.AnnouncePolite($"Invitation reçue de {fromName}.");

            var confirm = await _dialogs.Confirm(
                    "Invitation",
                    $"{fromName} vous invite à rejoindre la table {roomName}.\n\nAccepter ?")
                .ConfigureAwait(true);

            var accept = confirm == true;
            var res = await _rooms.InviteRespondAsync(invitationId, accept).ConfigureAwait(false);

            if (!accept)
            {
                return;
            }
            if (!res.Accepted && res.Expired)
            {
                await _dialogs.ShowInfo("Invitation", "Invitation expirée.").ConfigureAwait(true);
                return;
            }

            var effectiveRoomId = res.RoomId ?? roomId;
            if (effectiveRoomId <= 0)
            {
                await _dialogs.ShowInfo("Invitation", "Invitation acceptée, mais roomId indisponible.").ConfigureAwait(true);
                return;
            }

            var returnView = _navigation.CurrentView;
            if (returnView == null)
            {
                await _dialogs.ShowInfo("Invitation", "Impossible d'ouvrir la table (vue courante indisponible).").ConfigureAwait(true);
                return;
            }

            await _tables.OpenExistingAsync(effectiveRoomId, returnView, res.Spectator).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Invitation", ex.Message).ConfigureAwait(true);
        }
    }

    private void HandleRoomInviteResponded(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }
            var accepted = payload.TryGetProperty("accepted", out var a) && a.ValueKind == JsonValueKind.True;
            string byName = "Quelqu'un";
            if (payload.TryGetProperty("by", out var by) && by.ValueKind == JsonValueKind.Object &&
                by.TryGetProperty("username", out var u) && u.ValueKind == JsonValueKind.String)
            {
                byName = u.GetString() ?? byName;
            }
            _screenReader.AnnouncePolite(accepted ? $"{byName} a accepté votre invitation." : $"{byName} a refusé votre invitation.");
        }
        catch
        {
            // ignore
        }
    }

    private void HandleMessagingNew(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            string fromName = "inconnu";
            if (payload.TryGetProperty("from", out var from) && from.ValueKind == JsonValueKind.Object &&
                from.TryGetProperty("username", out var u) && u.ValueKind == JsonValueKind.String)
            {
                fromName = u.GetString() ?? fromName;
            }

            var subject = payload.TryGetProperty("subject", out var s) && s.ValueKind == JsonValueKind.String ? s.GetString() : null;
            var preview = payload.TryGetProperty("preview", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

            var text = string.IsNullOrWhiteSpace(subject)
                ? $"Message privé de {fromName}."
                : $"Message privé de {fromName}. Sujet : {subject}.";

            if (!string.IsNullOrWhiteSpace(preview))
            {
                text += $" {preview}";
            }

            _screenReader.AnnouncePolite(text.Trim());
        }
        catch
        {
            // ignore
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
            var restarted = UpdateRestartHelper.RestartCurrentProcess("notify");
            if (!restarted)
            {
                await _dialogs.ShowInfo(
                        "Mise à jour",
                        "La mise à jour est disponible, mais le redémarrage automatique a été annulé ou bloqué par Windows.\n\n" +
                        "Ferme puis relance l'application depuis le menu Démarrer (installation ClickOnce) pour appliquer la mise à jour.")
                    .ConfigureAwait(true);
            }
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
