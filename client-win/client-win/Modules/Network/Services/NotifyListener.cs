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
    private readonly IAnnouncementService _announcements;
    private readonly ICatalogService _catalog;
    private readonly IDialogService _dialogs;
    private readonly IRoomDirectoryClient _rooms;
    private readonly IGameTableOpener _tables;
    private readonly INavigationService _navigation;
    private readonly ISoundService _sounds;
    private readonly IRemoteSoundCache _remoteSounds;
    private readonly INotificationInbox _inbox;
    private readonly IMenuBadges _badges;
    private volatile bool _countsSupported;
    private TaskCompletionSource<bool>? _countsFirstReceived;

	    private IWebSocketConnection? _ws;
	    private readonly SemaphoreSlim _connectLock = new(1, 1);
	    private readonly ConcurrentDictionary<string, TaskCompletionSource<(string Type, string? Error)>> _pendingAcks = new();
	    private volatile bool _started;
	    private CancellationTokenSource? _reconnectCts;
	    private Task? _reconnectLoop;
	    private int _reconnectAttempt;
	    private int _reconnectInProgress;
	    private WebSocketState _state = WebSocketState.Disconnected;

    public NotifyListener(
        ClientConfiguration config,
        ISessionService session,
        Func<IWebSocketConnection> wsFactory,
        IWsTicketProvider tickets,
        IScreenReaderAnnouncer screenReader,
        IAnnouncementService announcements,
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
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
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
	        _reconnectCts?.Cancel();
	        _reconnectCts?.Dispose();
	        _reconnectCts = new CancellationTokenSource();

	        await EnsureConnectedAsync(cancellationToken).ConfigureAwait(false);

	        if (_reconnectLoop == null || _reconnectLoop.IsCompleted)
	        {
	            _reconnectLoop = Task.Run(() => ReconnectLoopAsync(_reconnectCts.Token), _reconnectCts.Token);
	        }
	    }

	    public async Task StopAsync(CancellationToken cancellationToken = default)
	    {
	        _started = false;
	        try
	        {
	            _reconnectCts?.Cancel();
	            _reconnectCts?.Dispose();
	        }
	        catch
	        {
	            // ignore
	        }
	        _reconnectCts = null;

	        var loop = _reconnectLoop;
	        _reconnectLoop = null;
	        if (loop != null)
	        {
	            try { await loop.ConfigureAwait(false); } catch { }
	        }

	        var ws = _ws;
	        _ws = null;
	        if (ws != null)
	        {
	            ws.MessageReceived -= OnMessage;
	            ws.Error -= OnWsError;
	            ws.StateChanged -= OnWsStateChanged;
	            try
	            {
	                await ws.CloseAsync().ConfigureAwait(false);
	            }
	            catch
	            {
	                // ignore
	            }
	        }
	        _state = WebSocketState.Disconnected;
	    }

	    private void RequestReconnect()
	    {
	        if (!_started) return;
	        if (Interlocked.Exchange(ref _reconnectInProgress, 1) == 1) return;
	    }

	    private async Task ReconnectLoopAsync(CancellationToken cancellationToken)
	    {
	        while (!cancellationToken.IsCancellationRequested)
	        {
	            try
	            {
	                if (!_started)
	                {
	                    return;
	                }

	                if (_state == WebSocketState.Connected)
	                {
	                    await Task.Delay(1000, cancellationToken).ConfigureAwait(false);
	                    continue;
	                }

	                if (Interlocked.CompareExchange(ref _reconnectInProgress, 0, 0) == 0)
	                {
	                    await Task.Delay(500, cancellationToken).ConfigureAwait(false);
	                    continue;
	                }

	                var attempt = Math.Min(6, Interlocked.Increment(ref _reconnectAttempt));
	                var delay = ComputeBackoff(attempt);
	                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);

	                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(12));
	                using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
	                await EnsureConnectedAsync(linked.Token).ConfigureAwait(false);

	                if (_state != WebSocketState.Connected)
	                {
	                    Interlocked.Exchange(ref _reconnectInProgress, 1);
	                }
	            }
	            catch (OperationCanceledException)
	            {
	                return;
	            }
	            catch
	            {
	                await Task.Delay(2000, cancellationToken).ConfigureAwait(false);
	            }
	        }
	    }

	    private async Task EnsureConnectedAsync(CancellationToken cancellationToken)
	    {
	        if (!_started)
	        {
	            return;
	        }

	        var token = _session.CurrentUser?.Token;
	        if (string.IsNullOrWhiteSpace(token))
	        {
	            return;
	        }

	        await _connectLock.WaitAsync(cancellationToken).ConfigureAwait(false);
	        try
	        {
	            if (!_started)
	            {
	                return;
	            }

	            var ws = _ws;
	            if (ws == null)
	            {
	                ws = _wsFactory();
	                ws.MessageReceived += OnMessage;
	                ws.Error += OnWsError;
	                ws.StateChanged += OnWsStateChanged;
	                _ws = ws;
	            }

	            var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
	            Log.Information("Connexion WS notify vers {Endpoint}", _config.NotifyGatewayWs);
	            await ws.ConnectAsync(_config.NotifyGatewayWs, token, headers: headers, cancellationToken).ConfigureAwait(false);

	            _state = WebSocketState.Connected;
	            Interlocked.Exchange(ref _reconnectAttempt, 0);
	            Interlocked.Exchange(ref _reconnectInProgress, 0);
	            Log.Information("Connexion WS notify établie.");

	            _countsFirstReceived = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
	            _countsSupported = false;
	            _badges.SetUnreadNotifications(0);

	            // Handshake version: permet au serveur de proposer la MAJ à chaque connexion.
	            try
	            {
	                var hello = JsonSerializer.Serialize(new
	                {
	                    type = "client.hello",
	                    payload = new { version = AppInfo.GetShortVersion() },
	                });
	                await ws.SendAsync(hello, cancellationToken).ConfigureAwait(false);
	            }
	            catch
	            {
	                // Best-effort
	            }

	            // Source de vérité des badges (serveur) avec ack explicite.
	            try
	            {
	                var (ok, error) = await SendWithAckAsync(
	                    "notify.counts.get",
	                    payload: null,
	                    successType: "notify.counts",
	                    errorType: "notify.error",
	                    cancellationToken).ConfigureAwait(false);

	                if (ok)
	                {
	                    _countsFirstReceived?.TrySetResult(true);
	                }
	                else
	                {
	                    Log.Warning("notify.counts.get: échec de la réponse: {Error}", error ?? "inconnue");
	                }
	            }
	            catch
	            {
	                // ignore (best-effort)
	            }
	        }
	        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
	        {
	            _state = WebSocketState.Disconnected;
	            Log.Warning(ex, "Impossible de se connecter au WS notify.");
	            RequestReconnect();
	        }
	        finally
	        {
	            _connectLock.Release();
	        }
	    }

	    private static TimeSpan ComputeBackoff(int attempt)
	    {
	        var seconds = attempt switch
	        {
	            1 => 1,
	            2 => 2,
	            3 => 5,
	            4 => 10,
	            5 => 20,
	            _ => 30,
	        };

	        var jitter = 0.8 + (Random.Shared.NextDouble() * 0.4);
	        return TimeSpan.FromMilliseconds(Math.Max(250, seconds * 1000 * jitter));
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

            // Clone the payload before dispatching to the UI thread; doc will be disposed.
            var rootClone = root.Clone();
            root = rootClone; // use cloned element for the rest of this method

            if (root.TryGetProperty("requestId", out var rid) && rid.ValueKind == JsonValueKind.String)
            {
                var requestId = rid.GetString() ?? string.Empty;
                if (!string.IsNullOrWhiteSpace(requestId) && _pendingAcks.TryGetValue(requestId, out var tcs))
	                {
	                    string? error = null;
	                    if (root.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Object &&
	                        payload.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String)
	                    {
	                        error = m.GetString();
	                    }
	                    tcs.TrySetResult((type, error));
	                }
            }

            // Tout ce qui touche à WPF (collections bindées, sons, annonces, navigation)
            // doit être exécuté sur le thread UI pour éviter les blocages aléatoires.
            RunOnUi(() => HandleMessageOnUi(type, rootClone));
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "Message notify invalide.");
        }
	    }

		    private void OnWsError(string msg)
		    {
		        Log.Warning("WS notify error: {Message}", msg);
		        _ = Task.Run(() => HandleDisconnectAsync(msg));
		    }

		    private void OnWsStateChanged(WebSocketState state)
		    {
		        _state = state;
		        if (state == WebSocketState.Error || state == WebSocketState.Disconnected)
		        {
		            _ = Task.Run(() => HandleDisconnectAsync(state.ToString()));
		        }
		    }

		    private async Task HandleDisconnectAsync(string reason)
		    {
	        try
	        {
	            foreach (var kvp in _pendingAcks)
	            {
	                kvp.Value.TrySetResult(("notify.error", $"WS notify déconnecté: {reason}"));
	            }
	            _pendingAcks.Clear();
                _countsSupported = false;
	        }
	        catch
	        {
	            // ignore
	        }

		        try
		        {
		            RequestReconnect();
		        }
		        catch
		        {
		            // ignore
		        }
		    }

        private void HandleMessageOnUi(string type, JsonElement root)
        {
            if (string.Equals(type, "admin.broadcast", StringComparison.OrdinalIgnoreCase))
            {
                var message = root.TryGetProperty("payload", out var p) && p.TryGetProperty("message", out var m)
                    ? (m.GetString() ?? string.Empty)
                    : string.Empty;
                if (!string.IsNullOrWhiteSpace(message))
                {
                    _announcements.Enqueue(message, AnnouncementPriority.Polite);
                }
                return;
            }

            if (string.Equals(type, "catalog.invalidate", StringComparison.OrdinalIgnoreCase))
            {
                _catalog.InvalidateCache();
                return;
            }

            if (string.Equals(type, "client.update.available", StringComparison.OrdinalIgnoreCase))
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
                return;
            }

            if (string.Equals(type, "client.update.required", StringComparison.OrdinalIgnoreCase))
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
                return;
            }

            if (string.Equals(type, "rooms.invite.received", StringComparison.OrdinalIgnoreCase))
            {
                _ = HandleRoomInviteReceivedAsync(root);
                return;
            }

            if (string.Equals(type, "rooms.invite.responded", StringComparison.OrdinalIgnoreCase))
            {
                HandleRoomInviteResponded(root);
                return;
            }

            if (string.Equals(type, "messaging.new", StringComparison.OrdinalIgnoreCase))
            {
                HandleMessagingNew(root);
                return;
            }

            if (string.Equals(type, "social.friend.requested", StringComparison.OrdinalIgnoreCase))
            {
                HandleFriendRequested(root);
                return;
            }

            if (string.Equals(type, "social.friend.connected", StringComparison.OrdinalIgnoreCase))
            {
                HandleFriendPresence(root, connected: true);
                return;
            }

            if (string.Equals(type, "social.friend.disconnected", StringComparison.OrdinalIgnoreCase))
            {
                HandleFriendPresence(root, connected: false);
                return;
            }

            if (string.Equals(type, "sounds.updated", StringComparison.OrdinalIgnoreCase))
            {
                _ = HandleSoundsUpdatedAsync();
                return;
            }

            if (string.Equals(type, "notify.inbox.snapshot", StringComparison.OrdinalIgnoreCase))
            {
                HandleInboxSnapshot(root);
                return;
            }

            if (string.Equals(type, "notify.inbox.item", StringComparison.OrdinalIgnoreCase))
            {
                HandleInboxItem(root);
                return;
            }

            if (string.Equals(type, "notify.inbox.removed", StringComparison.OrdinalIgnoreCase))
            {
                HandleInboxRemoved(root);
                return;
            }

            if (string.Equals(type, "notify.admin_contact.error", StringComparison.OrdinalIgnoreCase))
            {
                var msg = root.TryGetProperty("payload", out var p) && p.ValueKind == JsonValueKind.Object &&
                          p.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String
                    ? (m.GetString() ?? string.Empty)
                    : string.Empty;
                if (!string.IsNullOrWhiteSpace(msg))
                {
                    _announcements.Enqueue(msg, AnnouncementPriority.Polite);
                }
                return;
            }

            if (string.Equals(type, "notify.counts", StringComparison.OrdinalIgnoreCase))
            {
                HandleCounts(root);
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
            try
            {
                await ws.SendAsync(raw, cancellationToken).ConfigureAwait(false);
	            }
	            catch (Exception ex)
	            {
	                await HandleDisconnectAsync(ex.Message).ConfigureAwait(false);
	                return (false, "WS notify déconnecté.");
	            }

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

            var prevNotif = _badges.UnreadNotifications;
            _badges.SetUnreadNotifications(unreadNotifications);
            _badges.SetUnreadMessaging(unreadMessages);
            _countsSupported = true;
            _countsFirstReceived?.TrySetResult(true);
            if (prevNotif != unreadNotifications)
            {
                Log.Information("Notify counts sync: prevNotif={Prev} serverNotif={Server}", prevNotif, unreadNotifications);
            }
            Log.Information("Notify counts: notif={Notifications} msg={Messages}", unreadNotifications, unreadMessages);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Echec traitement notify.counts");
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
	        try
	        {
	            await ws.SendAsync(raw, cancellationToken).ConfigureAwait(false);
	        }
	        catch
	        {
	            await HandleDisconnectAsync("send failed").ConfigureAwait(false);
	            throw;
	        }
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
            var unread = items.Count(x => !x.IsRead);
            var prev = _badges.UnreadNotifications;
            _badges.SetUnreadNotifications(unread);
            if (prev != unread)
            {
                Log.Information("Inbox snapshot resync badges: prev={Prev} computed={Computed}", prev, unread);
            }
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

	            // Source de vérité serveur pour badges.
	            _ = Task.Run(async () =>
	            {
	                try { await SendAsync("notify.counts.get").ConfigureAwait(false); } catch { }
	            });
	        }
	        catch
	        {
	            // ignore
	        }
    }

    private void HandleInboxRemoved(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("payload", out var payload) || payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            if (!payload.TryGetProperty("ids", out var idsEl) || idsEl.ValueKind != JsonValueKind.Array)
            {
                return;
            }

            var ids = new List<string>();
            foreach (var el in idsEl.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.String)
                {
                    continue;
                }
                var id = (el.GetString() ?? string.Empty).Trim();
                if (!string.IsNullOrWhiteSpace(id))
                {
                    ids.Add(id);
                }
            }

            if (ids.Count == 0)
            {
                return;
            }

            RunOnUi(() =>
            {
                foreach (var id in ids)
                {
                    _inbox.Remove(id);
                }
            });

            // Source de vérité serveur pour badges.
            _ = Task.Run(async () =>
            {
                try { await SendAsync("notify.counts.get").ConfigureAwait(false); } catch { }
            });
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
            var readAt = payload.TryGetProperty("readAt", out var rEl) && rEl.ValueKind == JsonValueKind.String
                ? rEl.GetString()
                : null;
            var message = payload.TryGetProperty("message", out var msgEl) && msgEl.ValueKind == JsonValueKind.String
                ? msgEl.GetString()
                : string.Empty;
            var fromUserId = payload.TryGetProperty("fromUserId", out var fuEl) && fuEl.ValueKind == JsonValueKind.Number
                ? fuEl.GetInt32()
                : 0;
            var fromUsername = payload.TryGetProperty("fromUsername", out var fnEl) && fnEl.ValueKind == JsonValueKind.String
                ? fnEl.GetString()
                : string.Empty;
            var toUserId = payload.TryGetProperty("toUserId", out var tuEl) && tuEl.ValueKind == JsonValueKind.Number
                ? (int?)tuEl.GetInt32()
                : null;
            var contactId = payload.TryGetProperty("contactId", out var ciEl) && ciEl.ValueKind == JsonValueKind.String
                ? ciEl.GetString()
                : null;
            var status = payload.TryGetProperty("status", out var stEl) && stEl.ValueKind == JsonValueKind.String
                ? (stEl.GetString() ?? string.Empty).Trim()
                : string.Empty;
            var handled = payload.TryGetProperty("handled", out var hEl) && hEl.ValueKind is JsonValueKind.True or JsonValueKind.False
                ? hEl.GetBoolean()
                : false;
            var handledAt = payload.TryGetProperty("handledAt", out var haEl) && haEl.ValueKind == JsonValueKind.String
                ? haEl.GetString()
                : null;
            var handledByUsername = payload.TryGetProperty("handledByUsername", out var hbEl) && hbEl.ValueKind == JsonValueKind.String
                ? hbEl.GetString()
                : null;

            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(kind))
            {
                return false;
            }

            var ts = DateTimeOffset.TryParse(createdAt, out var dto) ? dto : DateTimeOffset.UtcNow;
            DateTimeOffset? handledTs = DateTimeOffset.TryParse(handledAt, out var hDto) ? hDto : null;
            var normalizedStatus = string.IsNullOrWhiteSpace(status) ? string.Empty : status.Trim().ToLowerInvariant();
            var isHandled = normalizedStatus == "handled" ? true : handled;

            item = new NotificationItem
            {
                Id = id,
                Kind = kind,
                CreatedAt = ts,
                IsRead = !string.IsNullOrWhiteSpace(readAt),
                ContactId = contactId,
                FromUserId = fromUserId,
                FromUsername = fromUsername ?? string.Empty,
                ToUserId = toUserId,
                Message = message ?? string.Empty,
                AdminStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
                IsHandled = isHandled,
                HandledAt = handledTs,
                HandledByUsername = handledByUsername,
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

            _announcements.Enqueue($"Invitation reçue de {fromName}.", AnnouncementPriority.Polite);
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
            _announcements.Enqueue(
                accepted ? $"{byName} a accepté votre invitation." : $"{byName} a refusé votre invitation.",
                AnnouncementPriority.Polite);
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

            _announcements.Enqueue(text.Trim(), AnnouncementPriority.Polite);

            var me = _session.CurrentUser;
	            if (me == null || fromId <= 0 || fromId != me.UserId)
	            {
	                _sounds.Play(SoundId.PrivateMessageReceived);
	            }
	            if (!_countsSupported)
	            {
	                _badges.SetUnreadMessaging(_badges.UnreadMessaging + 1);
	            }

	            // Source de vérité serveur pour badges.
	            _ = Task.Run(async () =>
	            {
	                try { await SendAsync("notify.counts.get").ConfigureAwait(false); } catch { }
	            });
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
            _announcements.Enqueue("Nouvelle demande d'ami.", AnnouncementPriority.Polite);
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
            _announcements.Enqueue(
                connected ? $"{label} s'est connecté." : $"{label} s'est déconnecté.",
                AnnouncementPriority.Polite);
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
