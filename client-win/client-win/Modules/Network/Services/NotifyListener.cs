using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Tasks;
using System.Threading;
using System.Diagnostics;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Config;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Catalog.Views;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Shell.Services;
using client_win.Modules.MainMenu.Views;
using client_win.Modules.User.Services;
using client_win.Modules.Notifications.Models;
using client_win.Modules.Notifications.Services;
using client_win.Modules.MainMenu.Services;
using client_win.Modules.Notifications.Views;
using client_win.Modules.Messaging.Views;
using client_win.Modules.Updates;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Game.Shell.Services;
using Serilog;

namespace client_win.Modules.Network.Services;

public sealed class NotifyListener : INotifyListener, INotifyGatewayClient, IAsyncDisposable
{
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly Func<IWebSocketConnection> _wsFactory;
    private readonly IWsTicketProvider _tickets;
    private readonly IScreenReaderAnnouncer _screenReader;
    private readonly ICatalogService _catalog;
    private readonly IDialogService _dialogs;
    private readonly IRoomDirectoryClient _rooms;
    private readonly IGameTableOpener _tables;
    private readonly INavigationService _navigation;
    private readonly ISoundService _sounds;
    private readonly IRemoteSoundCache _remoteSounds;
    private readonly INotificationInbox _inbox;
    private readonly IMenuBadges _badges;

	private IWebSocketConnection? _ws;
	private bool _started;
    private readonly ConcurrentDictionary<string, TaskCompletionSource<(string Type, string? Error)>> _pendingAcks = new();

    public NotifyListener(
        ClientConfiguration config,
        ISessionService session,
        Func<IWebSocketConnection> wsFactory,
        IWsTicketProvider tickets,
        IScreenReaderAnnouncer screenReader,
        ICatalogService catalog,
        IDialogService dialogs,
        IRoomDirectoryClient rooms,
        IGameTableOpener tables,
        INavigationService navigation,
        ISoundService sounds,
        IRemoteSoundCache remoteSounds,
        INotificationInbox inbox,
        IMenuBadges badges)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _wsFactory = wsFactory ?? throw new ArgumentNullException(nameof(wsFactory));
        _tickets = tickets ?? throw new ArgumentNullException(nameof(tickets));
        _screenReader = screenReader ?? throw new ArgumentNullException(nameof(screenReader));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _rooms = rooms ?? throw new ArgumentNullException(nameof(rooms));
        _tables = tables ?? throw new ArgumentNullException(nameof(tables));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _remoteSounds = remoteSounds ?? throw new ArgumentNullException(nameof(remoteSounds));
        _inbox = inbox ?? throw new ArgumentNullException(nameof(inbox));
        _badges = badges ?? throw new ArgumentNullException(nameof(badges));
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
            var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
            await _ws.ConnectAsync(_config.NotifyGatewayWs, token, headers: headers, cancellationToken).ConfigureAwait(false);
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

            // Source de vérité des badges (serveur).
            try
            {
                await SendAsync("notify.counts.get", payload: null, cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                // ignore (best-effort)
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

            if (root.TryGetProperty("requestId", out var rid) && rid.ValueKind == JsonValueKind.String)
            {
                var requestId = rid.GetString() ?? string.Empty;
                if (!string.IsNullOrWhiteSpace(requestId) && _pendingAcks.TryGetValue(requestId, out var tcs))
                {
                    string? error = null;
                    if (root.TryGetProperty("payload", out var p) && p.ValueKind == JsonValueKind.Object &&
                        p.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String)
                    {
                        error = m.GetString();
                    }
                    tcs.TrySetResult((type, error));
                }
            }

            if (string.Equals(type, "admin.broadcast", StringComparison.OrdinalIgnoreCase))
            {
                var message = root.TryGetProperty("payload", out var p) && p.TryGetProperty("message", out var m)
                    ? (m.GetString() ?? string.Empty)
                    : string.Empty;
                if (!string.IsNullOrWhiteSpace(message))
                {
                    RunOnUi(() => _screenReader.AnnouncePolite(message));
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
            else if (string.Equals(type, "social.friend.requested", StringComparison.OrdinalIgnoreCase))
            {
                HandleFriendRequested(root);
            }
            else if (string.Equals(type, "social.friend.connected", StringComparison.OrdinalIgnoreCase))
            {
                HandleFriendPresence(root, connected: true);
            }
            else if (string.Equals(type, "social.friend.disconnected", StringComparison.OrdinalIgnoreCase))
            {
                HandleFriendPresence(root, connected: false);
            }
            else if (string.Equals(type, "sounds.updated", StringComparison.OrdinalIgnoreCase))
            {
                _ = HandleSoundsUpdatedAsync();
            }
            else if (string.Equals(type, "notify.inbox.snapshot", StringComparison.OrdinalIgnoreCase))
            {
                RunOnUi(() => HandleInboxSnapshot(root));
            }
            else if (string.Equals(type, "notify.inbox.item", StringComparison.OrdinalIgnoreCase))
            {
                RunOnUi(() => HandleInboxItem(root));
            }
            else if (string.Equals(type, "notify.admin_contact.error", StringComparison.OrdinalIgnoreCase))
            {
                var msg = root.TryGetProperty("payload", out var p) && p.ValueKind == JsonValueKind.Object &&
                          p.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String
                    ? (m.GetString() ?? string.Empty)
                    : string.Empty;
                if (!string.IsNullOrWhiteSpace(msg))
                {
                    RunOnUi(() => _screenReader.AnnouncePolite(msg));
                }
            }
            else if (string.Equals(type, "notify.counts", StringComparison.OrdinalIgnoreCase))
            {
                RunOnUi(() => HandleCounts(root));
            }
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "Message notify invalide.");
        }
    }

    private static void RunOnUi(Action action)
    {
        try
        {
            var dispatcher = Application.Current?.Dispatcher;
            if (dispatcher == null || dispatcher.CheckAccess())
            {
                action();
                return;
            }

            _ = dispatcher.BeginInvoke(action, DispatcherPriority.Background);
        }
        catch
        {
            // ignore
        }
    }

    public async Task<(bool Ok, string? Error)> SendWithAckAsync(
        string type,
        object? payload,
        string successType,
        string errorType,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(type))
        {
            return (false, "Type manquant.");
        }

        await StartAsync(cancellationToken).ConfigureAwait(false);
        var ws = _ws;
        if (ws == null)
        {
            return (false, "WS notify non connecté.");
        }

        var requestId = Guid.NewGuid().ToString("N");
        var tcs = new TaskCompletionSource<(string Type, string? Error)>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pendingAcks[requestId] = tcs;

        try
        {
            var raw = JsonSerializer.Serialize(new
            {
                type,
                requestId,
                payload,
            });
            await ws.SendAsync(raw, cancellationToken).ConfigureAwait(false);

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(6));

            var completed = await Task.WhenAny(tcs.Task, Task.Delay(Timeout.InfiniteTimeSpan, timeoutCts.Token))
                .ConfigureAwait(false);

            if (completed != tcs.Task)
            {
                return (false, "Délai dépassé.");
            }

            var (respType, err) = await tcs.Task.ConfigureAwait(false);
            if (string.Equals(respType, successType, StringComparison.OrdinalIgnoreCase))
            {
                return (true, null);
            }

            if (string.Equals(respType, errorType, StringComparison.OrdinalIgnoreCase))
            {
                return (false, string.IsNullOrWhiteSpace(err) ? "Erreur." : err);
            }

            return (false, "Réponse inattendue.");
        }
        finally
        {
            _pendingAcks.TryRemove(requestId, out _);
        }
    }

    private void HandleCounts(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var unreadNotifications = payload.TryGetProperty("unreadNotifications", out var n) && n.ValueKind == JsonValueKind.Number
                ? n.GetInt32()
                : 0;
            var unreadMessages = payload.TryGetProperty("unreadMessages", out var m) && m.ValueKind == JsonValueKind.Number
                ? m.GetInt32()
                : 0;

            _badges.SetUnreadNotifications(unreadNotifications);
            _badges.SetUnreadMessaging(unreadMessages);
        }
        catch
        {
            // ignore
        }
    }

    public async Task SendAsync(string type, object? payload = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(type))
        {
            return;
        }

        await StartAsync(cancellationToken).ConfigureAwait(false);
        var ws = _ws;
        if (ws == null)
        {
            throw new InvalidOperationException("WS notify non connecté.");
        }

        var raw = JsonSerializer.Serialize(new
        {
            type,
            payload,
        });
        await ws.SendAsync(raw, cancellationToken).ConfigureAwait(false);
    }

    public Task RequestInboxSnapshotAsync(CancellationToken cancellationToken = default) =>
        SendAsync("notify.inbox.list", payload: null, cancellationToken);

    private void HandleInboxSnapshot(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("items", out var itemsEl) || itemsEl.ValueKind != JsonValueKind.Array)
            {
                _inbox.ReplaceAll(Array.Empty<NotificationItem>());
                return;
            }

            var items = new List<NotificationItem>();
            foreach (var el in itemsEl.EnumerateArray())
            {
                if (TryParseNotificationItem(el, out var item) && item != null)
                {
                    items.Add(item);
                }
            }

            _inbox.ReplaceAll(items);
        }
        catch
        {
            // ignore
        }
    }

    private void HandleInboxItem(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!TryParseNotificationItem(payload, out var item) || item == null)
            {
                return;
            }

            _inbox.Upsert(item);

            if (string.Equals(item.Kind, "admin_contact", StringComparison.OrdinalIgnoreCase))
            {
                var me = _session.CurrentUser;
                var fromMe = me != null && item.FromUserId == me.UserId;
                _sounds.Play(fromMe ? SoundId.AdminContactSent : SoundId.AdminContactReceived);
            }
        }
        catch
        {
            // ignore
        }
    }

    private static bool TryParseNotificationItem(JsonElement payload, out NotificationItem? item)
    {
        item = null;
        try
        {
            var id = payload.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String
                ? idEl.GetString()
                : null;
            var kind = payload.TryGetProperty("kind", out var kEl) && kEl.ValueKind == JsonValueKind.String
                ? kEl.GetString()
                : null;
            var createdAt = payload.TryGetProperty("createdAt", out var cEl) && cEl.ValueKind == JsonValueKind.String
                ? cEl.GetString()
                : null;

            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(kind))
            {
                return false;
            }

            var ts = DateTimeOffset.TryParse(createdAt, out var dto) ? dto : DateTimeOffset.UtcNow;

            if (string.Equals(kind, "admin_contact", StringComparison.OrdinalIgnoreCase))
            {
                var contactId = payload.TryGetProperty("contactId", out var ci) && ci.ValueKind == JsonValueKind.String
                    ? ci.GetString()
                    : null;
                var fromUserId = payload.TryGetProperty("fromUserId", out var fu) && fu.ValueKind == JsonValueKind.Number
                    ? fu.GetInt32()
                    : 0;
                var fromUsername = payload.TryGetProperty("fromUsername", out var fn) && fn.ValueKind == JsonValueKind.String
                    ? (fn.GetString() ?? string.Empty)
                    : string.Empty;
                var message = payload.TryGetProperty("message", out var msg) && msg.ValueKind == JsonValueKind.String
                    ? (msg.GetString() ?? string.Empty)
                    : string.Empty;
                int? toUserId = null;
                if (payload.TryGetProperty("toUserId", out var tu) && tu.ValueKind == JsonValueKind.Number)
                {
                    toUserId = tu.GetInt32();
                }

                item = new NotificationItem
                {
                    Id = id,
                    Kind = "admin_contact",
                    CreatedAt = ts,
                    ContactId = contactId,
                    FromUserId = fromUserId,
                    FromUsername = fromUsername,
                    ToUserId = toUserId,
                    Message = message,
                };
                return true;
            }

            item = new NotificationItem
            {
                Id = id,
                Kind = kind,
                CreatedAt = ts,
            };
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task HandleSoundsUpdatedAsync()
    {
        try
        {
            await _remoteSounds.RefreshAsync(force: true).ConfigureAwait(false);

            // Recharge les paths et les players (best-effort).
            _sounds.PreloadAll();

            // Réapplique l'ambiance/musique selon la vue courante (sur le thread UI pour éviter les races).
            var dispatcher = Application.Current?.Dispatcher;
            if (dispatcher != null)
            {
                _ = dispatcher.BeginInvoke(() =>
                {
                    try
                    {
                        var view = _navigation.CurrentView;
                        _sounds.StopLoop(SoundId.MainMenuMusic);
                        _sounds.StopLoop(SoundId.TavernAmbience);
                        if (view is CatalogView)
                        {
                            _sounds.StartLoop(SoundId.TavernAmbience);
                        }
                        else if (view is MainMenuView)
                        {
                            _sounds.StartLoop(SoundId.MainMenuMusic);
                        }
                    }
                    catch
                    {
                        // ignore (best-effort)
                    }
                }, DispatcherPriority.Background);
            }
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "Sounds updated handling failed");
        }
    }

    private async Task HandleClientUpdateRequiredAsync(string message, string minRequiredVersion, string url)
    {
        try
        {
            await Updates.ClientUpdateManager.HandleRequiredFromNotifyAsync(
                    _dialogs,
                    message,
                    minRequiredVersion,
                    url)
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
            await Updates.ClientUpdateManager.HandleAvailableFromNotifyAsync(
                    _dialogs,
                    message,
                    version,
                    url)
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
            _sounds.Play(SoundId.InvitationReceived);

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

    private void HandleFriendRequested(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            // Backend sends only requesterId; keep it generic client-side.
            _screenReader.AnnouncePolite("Nouvelle demande d'ami.");
            _sounds.Play(SoundId.FriendInvitationReceived);
        }
        catch
        {
            // ignore
        }
    }

    private void HandleFriendPresence(JsonElement root, bool connected)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var id = payload.TryGetProperty("userId", out var uid) && uid.ValueKind == JsonValueKind.Number
                ? uid.GetInt32()
                : 0;
            var name = payload.TryGetProperty("username", out var u) && u.ValueKind == JsonValueKind.String
                ? (u.GetString() ?? string.Empty)
                : string.Empty;

            if (id <= 0)
            {
                return;
            }

            var me = _session.CurrentUser;
            if (me != null && me.UserId == id)
            {
                return;
            }

            var label = string.IsNullOrWhiteSpace(name) ? $"Ami #{id}" : name.Trim();
            _screenReader.AnnouncePolite(connected ? $"{label} s'est connecté." : $"{label} s'est déconnecté.");
            _sounds.Play(connected ? SoundId.FriendConnected : SoundId.FriendDisconnected);
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

    private async Task<System.Collections.Generic.IDictionary<string, string>?> BuildHeadersAsync(CancellationToken cancellationToken)
    {
        var ticket = await _tickets.GetTicketAsync("notify", cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(ticket))
        {
            return null;
        }
        return new System.Collections.Generic.Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["x-lila-ws-ticket"] = ticket
        };
    }
}
