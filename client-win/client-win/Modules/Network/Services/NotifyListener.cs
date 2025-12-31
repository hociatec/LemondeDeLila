using System;
using System.Text.Json;
using System.Threading.Tasks;
using System.Threading;
using System.Diagnostics;
using System.Windows;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
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
    private readonly ISoundService _sounds;

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
        INavigationService navigation,
        ISoundService sounds)
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
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
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
                var url = payload.ValueKind != JsonValueKind.Undefined && payload.TryGetProperty("url", out var u)
                    ? (u.GetString() ?? string.Empty)
                    : string.Empty;

                _ = HandleClientUpdateAvailableAsync(message, version, url);
            }
            else if (string.Equals(type, "client.update.required", StringComparison.OrdinalIgnoreCase))
            {
                var payload = root.TryGetProperty("payload", out var p) ? p : default;
                var message = payload.ValueKind != JsonValueKind.Undefined && payload.TryGetProperty("message", out var m)
                    ? (m.GetString() ?? string.Empty)
                    : string.Empty;
                var minRequiredVersion = payload.ValueKind != JsonValueKind.Undefined && payload.TryGetProperty("minRequiredVersion", out var v)
                    ? (v.GetString() ?? string.Empty)
                    : string.Empty;
                var url = payload.ValueKind != JsonValueKind.Undefined && payload.TryGetProperty("url", out var u)
                    ? (u.GetString() ?? string.Empty)
                    : string.Empty;

                _ = HandleClientUpdateRequiredAsync(message, minRequiredVersion, url);
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

    private async Task HandleClientUpdateRequiredAsync(string message, string minRequiredVersion, string url)
    {
        try
        {
            var msg = string.IsNullOrWhiteSpace(message)
                ? "Une mise à jour du client est requise pour continuer."
                : message.Trim();

            var current = AppInfo.GetShortVersion();
            if (!string.IsNullOrWhiteSpace(minRequiredVersion))
            {
                msg += $"\n\nVersion minimale requise : {minRequiredVersion.Trim()}";
            }
            if (!string.IsNullOrWhiteSpace(current))
            {
                msg += $"\nVotre version : {current.Trim()}";
            }

            await ClientUpdateCoordinator.EnforceAsync(
                    _dialogs,
                    title: "Mise à jour requise",
                    message: msg + "\n\nLancement de la mise à jour…",
                    clickOnceUrl: url,
                    reason: "notify-required",
                    deDupKey: $"notify-required:{minRequiredVersion}")
                .ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Erreur lors d'une mise à jour requise (notify).");
            try
            {
                await _dialogs.ShowError("Mise à jour requise", ex.Message).ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
            Environment.Exit(0);
        }
    }

    private async Task HandleClientUpdateAvailableAsync(string message, string version, string url)
    {
        try
        {
            var msg = string.IsNullOrWhiteSpace(message)
                ? "Une mise à jour du client est disponible et va être installée automatiquement."
                : message.Trim();

            if (!string.IsNullOrWhiteSpace(version))
            {
                msg += $"\n\nDernière version : {version.Trim()}";
            }

            await ClientUpdateCoordinator.EnforceAsync(
                    _dialogs,
                    title: "Mise à jour",
                    message: msg + "\n\nLancement de la mise à jour…",
                    clickOnceUrl: url,
                    reason: "notify-available",
                    deDupKey: $"notify-available:{version}")
                .ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Erreur lors de la mise à jour client (notify-available).");
            try
            {
                await _dialogs.ShowError("Mise à jour", ex.Message).ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
            Environment.Exit(0);
        }
    }

    private async Task HandleRoomInviteReceivedAsync(JsonElement root)
    {
        void RestoreFocus()
        {
            try
            {
                var view = _navigation.CurrentView;
                if (view == null)
                {
                    return;
                }

                var dispatcher = Application.Current?.Dispatcher;
                if (dispatcher == null)
                {
                    return;
                }

                dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.ApplicationIdle, new Action(() =>
                {
                    try
                    {
                        var window = Window.GetWindow(view) ?? Application.Current?.MainWindow;
                        try
                        {
                            window?.Activate();
                        }
                        catch
                        {
                            // ignore
                        }

                        if (!view.IsKeyboardFocusWithin)
                        {
                            try
                            {
                                Keyboard.Focus(view);
                            }
                            catch
                            {
                                // ignore
                            }
                        }
                        view.MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
                    }
                    catch
                    {
                        // ignore
                    }
                }));
            }
            catch
            {
                // ignore
            }
        }

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
                RestoreFocus();
                return;
            }
            if (!res.Accepted && res.Expired)
            {
                await _dialogs.ShowInfo("Invitation", "Invitation expirée.").ConfigureAwait(true);
                RestoreFocus();
                return;
            }

            var effectiveRoomId = res.RoomId ?? roomId;
            if (effectiveRoomId <= 0)
            {
                await _dialogs.ShowInfo("Invitation", "Invitation acceptée, mais roomId indisponible.").ConfigureAwait(true);
                RestoreFocus();
                return;
            }

            var returnView = _navigation.CurrentView;
            if (returnView == null)
            {
                await _dialogs.ShowInfo("Invitation", "Impossible d'ouvrir la table (vue courante indisponible).").ConfigureAwait(true);
                RestoreFocus();
                return;
            }

            await _tables.OpenExistingAsync(effectiveRoomId, returnView, res.Spectator).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Invitation", ex.Message).ConfigureAwait(true);
            RestoreFocus();
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

            var fromId = payload.TryGetProperty("from", out var fromObj) &&
                         fromObj.ValueKind == JsonValueKind.Object &&
                         fromObj.TryGetProperty("id", out var idProp) &&
                         idProp.ValueKind == JsonValueKind.Number
                ? idProp.GetInt32()
                : 0;

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

            var me = _session.CurrentUser;
            if (me == null || fromId <= 0 || fromId != me.UserId)
            {
                _sounds.Play(SoundId.PrivateMessageReceived);
            }
        }
        catch
        {
            // ignore
        }
    }

    private static void TryOpenUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch
        {
            // ignore
        }
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync().ConfigureAwait(false);
    }
}
