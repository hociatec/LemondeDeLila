using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using client_win.Modules.Config;
using client_win.Modules.Network.Services;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.Presence.Models;
using client_win.Modules.User.Services;
using Serilog;

namespace client_win.Modules.Presence.Services;

public sealed class PresenceMonitor : IPresenceMonitor, IAsyncDisposable
{
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly Func<IWebSocketConnection> _wsFactory;
    private readonly Dispatcher _dispatcher;
    private readonly IWsTicketProvider _tickets;

    private IWebSocketConnection? _ws;
    private bool _started;
    private string _status = "Présence déconnectée.";
    private WebSocketState _state = WebSocketState.Disconnected;
    private CancellationTokenSource? _reconnectCts;
    private Task? _reconnectLoop;
    private int _reconnectAttempt;
    private int _reconnectInProgress;

    private readonly object _pendingPlayersGate = new();
    private IReadOnlyList<PresencePlayer>? _pendingPlayers;
    private int _applyPlayersScheduled;
    private int _playersChangedScheduled;

    private string _pendingContextJson = JsonSerializer.Serialize(new { type = "presence-context", context = "home" });
    private int? _currentRoomId;
    private string? _currentRoomName;

    public PresenceMonitor(
        ClientConfiguration config,
        ISessionService session,
        Func<IWebSocketConnection> wsFactory,
        Dispatcher dispatcher,
        IWsTicketProvider tickets)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _wsFactory = wsFactory ?? throw new ArgumentNullException(nameof(wsFactory));
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _tickets = tickets ?? throw new ArgumentNullException(nameof(tickets));
        Players = new ObservableCollection<PresencePlayer>();
    }

    public ObservableCollection<PresencePlayer> Players { get; }

    public string Status => _status;

    public event Action? PlayersChanged;

    public int? CurrentRoomId => _currentRoomId;
    public string? CurrentRoomName => _currentRoomName;

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_started) return;
        var token = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        _started = true;
        _reconnectCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _ = EnsureConnectedAsync(_reconnectCts.Token).ConfigureAwait(false);

        // Boucle de reconnexion best-effort (ex: ticket endpoint temporairement KO, coupure réseau).
        _reconnectLoop = Task.Run(() => ReconnectLoopAsync(_reconnectCts.Token), _reconnectCts.Token);
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
        await _dispatcher.InvokeAsync(() =>
        {
            Players.Clear();
            PlayersChanged?.Invoke();
        }, DispatcherPriority.Background);
    }

    public Task SetHomeAsync(CancellationToken cancellationToken = default)
    {
        _currentRoomId = null;
        _currentRoomName = null;
        _pendingContextJson = JsonSerializer.Serialize(new { type = "presence-context", context = "home" },
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return SendPendingContextAsync(cancellationToken);
    }

    public Task SetTableAsync(int roomId, string? roomName, CancellationToken cancellationToken = default)
    {
        _currentRoomId = roomId > 0 ? roomId : null;
        _currentRoomName = string.IsNullOrWhiteSpace(roomName) ? null : roomName.Trim();
        _pendingContextJson = JsonSerializer.Serialize(new
        {
            type = "presence-context",
            context = "table",
            roomId = roomId,
            roomName = _currentRoomName
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return SendPendingContextAsync(cancellationToken);
    }

    private async Task SendPendingContextAsync(CancellationToken cancellationToken)
    {
        var ws = _ws;
        if (ws == null)
        {
            return;
        }
        if (_state != WebSocketState.Connected)
        {
            return;
        }
        try
        {
            await ws.SendAsync(_pendingContextJson, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            // Best-effort
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

        // Close any previous socket before recreating.
        var existing = _ws;
        if (existing != null)
        {
            try { await existing.CloseAsync().ConfigureAwait(false); } catch { /* ignore */ }
        }

        var ws = _wsFactory();
        _ws = ws;

        ws.MessageReceived += OnMessage;
        ws.Error += msg =>
        {
            _status = $"Présence : erreur ({msg})";
            Log.Warning("WS presence error: {Message}", msg);
        };
        ws.StateChanged += state =>
        {
            _state = state;
            if (state == WebSocketState.Connected)
            {
                _status = "Présence connectée.";
                _reconnectAttempt = 0;
                Interlocked.Exchange(ref _reconnectInProgress, 0);
                return;
            }

            _status = "Présence déconnectée.";
            if (_started && (state == WebSocketState.Disconnected || state == WebSocketState.Error))
            {
                RequestReconnect();
            }
        };

        try
        {
            var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
            await ws.ConnectAsync(_config.PresenceGatewayWs, token, headers: headers, cancellationToken).ConfigureAwait(false);
            Log.Information("Connexion WS presence établie.");
            await SendPendingContextAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            _status = "Présence déconnectée.";
            Log.Warning(ex, "Impossible de se connecter au WS presence.");
            RequestReconnect();
        }
    }

    private void RequestReconnect()
    {
        if (!_started)
        {
            return;
        }

        // Only one reconnect attempt at a time.
        if (Interlocked.Exchange(ref _reconnectInProgress, 1) == 1)
        {
            return;
        }
    }

    private async Task ReconnectLoopAsync(CancellationToken cancellationToken)
    {
        // This loop stays alive for the session; it triggers reconnect attempts when needed.
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // If already connected, idle.
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
                var delaySeconds = attempt switch
                {
                    1 => 1,
                    2 => 2,
                    3 => 5,
                    4 => 10,
                    5 => 20,
                    _ => 30,
                };

                await Task.Delay(TimeSpan.FromSeconds(delaySeconds), cancellationToken).ConfigureAwait(false);
                await EnsureConnectedAsync(cancellationToken).ConfigureAwait(false);

                // EnsureConnectedAsync clears the in-progress flag on success; if not connected, keep trying.
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
                // Best-effort: don't crash background loop.
                await Task.Delay(2000, cancellationToken).ConfigureAwait(false);
            }
        }
    }

    private void OnMessage(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return;
        if (raw.IndexOf("presence-update", StringComparison.OrdinalIgnoreCase) < 0)
        {
            return;
        }
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (!string.Equals(type, "presence-update", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
            if (!root.TryGetProperty("players", out var playersNode) || playersNode.ValueKind != JsonValueKind.Array)
            {
                return;
            }

            var parsed = new List<PresencePlayer>();
            foreach (var p in playersNode.EnumerateArray())
            {
                if (!p.TryGetProperty("id", out var idProp) || idProp.ValueKind != JsonValueKind.Number) continue;
                if (!p.TryGetProperty("username", out var uProp) || uProp.ValueKind != JsonValueKind.String) continue;

                var id = idProp.GetInt32();
                var username = uProp.GetString() ?? string.Empty;
                var activity = p.TryGetProperty("activity", out var a) && a.ValueKind == JsonValueKind.String
                    ? a.GetString() ?? "home"
                    : "home";

                int? roomId = null;
                string? roomName = null;
                if (p.TryGetProperty("currentRoom", out var room) && room.ValueKind == JsonValueKind.Object)
                {
                    if (room.TryGetProperty("id", out var rid) && rid.ValueKind == JsonValueKind.Number)
                    {
                        roomId = rid.GetInt32();
                    }
                    if (room.TryGetProperty("name", out var rn) && rn.ValueKind == JsonValueKind.String)
                    {
                        roomName = rn.GetString();
                    }
                }

                parsed.Add(new PresencePlayer(id, username, activity, roomId, roomName));
            }

            // Trier hors UI thread pour éviter de bloquer l'interface lors d'une rafale d'updates.
            var sorted = parsed
                .OrderBy(p => ScoreActivity(p.Activity))
                .ThenBy(p => p.Username, StringComparer.OrdinalIgnoreCase)
                .ToList();

            QueueApplyPlayers(sorted);
        }
        catch
        {
            // ignore
        }
    }

    private void QueueApplyPlayers(IReadOnlyList<PresencePlayer> latest)
    {
        // Coalescing: présence peut envoyer des rafales (rejoins/quitte), on ne veut pas clear+rebuild UI à chaque frame.
        lock (_pendingPlayersGate)
        {
            _pendingPlayers = latest;
        }

        if (Interlocked.Exchange(ref _applyPlayersScheduled, 1) == 1)
        {
            return;
        }

        _ = _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(ApplyPendingPlayers));
    }

    private void ApplyPendingPlayers()
    {
        try
        {
            IReadOnlyList<PresencePlayer>? next;
            lock (_pendingPlayersGate)
            {
                next = _pendingPlayers;
                _pendingPlayers = null;
            }

            if (next == null)
            {
                return;
            }

            ApplyPlayers(next);
            QueuePlayersChanged();
        }
        finally
        {
            Interlocked.Exchange(ref _applyPlayersScheduled, 0);

            // Une mise à jour a pu arriver juste après le dernier tour de boucle.
            lock (_pendingPlayersGate)
            {
                if (_pendingPlayers != null && Interlocked.Exchange(ref _applyPlayersScheduled, 1) == 0)
                {
                    _ = _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(ApplyPendingPlayers));
                }
            }
        }
    }

    private void QueuePlayersChanged()
    {
        if (Interlocked.Exchange(ref _playersChangedScheduled, 1) == 1)
        {
            return;
        }

        _ = _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            try
            {
                PlayersChanged?.Invoke();
            }
            catch
            {
                // Ne pas casser le Dispatcher sur une exception d'abonné.
            }
            finally
            {
                Interlocked.Exchange(ref _playersChangedScheduled, 0);
            }
        }));
    }

    private void ApplyPlayers(IReadOnlyList<PresencePlayer> players)
    {
        Players.Clear();

        var me = _session.CurrentUser;
        foreach (var p in players)
        {
            var username = p.Username;
            if (me != null && string.Equals(username, me.Username, StringComparison.OrdinalIgnoreCase))
            {
                username = $"{username} (vous)";
            }
            Players.Add(new PresencePlayer(p.Id, username, p.Activity, p.CurrentRoomId, p.CurrentRoomName));
        }
    }

    private static int ScoreActivity(string activity)
    {
        var a = (activity ?? string.Empty).Trim().ToLowerInvariant();
        return a switch
        {
            "table" => 0,
            "chat" => 1,
            _ => 2
        };
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync().ConfigureAwait(false);
    }

    private async Task<IDictionary<string, string>?> BuildHeadersAsync(CancellationToken cancellationToken)
    {
        var ticket = await _tickets.GetTicketAsync("presence", cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(ticket))
        {
            return null;
        }
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["x-lila-ws-ticket"] = ticket
        };
    }
}
