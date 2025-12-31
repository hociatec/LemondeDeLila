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
        _ws = _wsFactory();
        _ws.MessageReceived += OnMessage;
        _ws.Error += msg =>
        {
            _status = $"Présence : erreur ({msg})";
            Log.Warning("WS presence error: {Message}", msg);
        };
        _ws.StateChanged += state =>
        {
            _state = state;
            _status = state == WebSocketState.Connected ? "Présence connectée." : "Présence déconnectée.";
        };

        try
        {
            var headers = await BuildHeadersAsync(cancellationToken).ConfigureAwait(false);
            await _ws.ConnectAsync(_config.PresenceGatewayWs, token, headers: headers, cancellationToken).ConfigureAwait(false);
            Log.Information("Connexion WS presence établie.");
            await SendPendingContextAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Impossible de se connecter au WS presence.");
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

            _ = _dispatcher.InvokeAsync(() =>
            {
                ApplyPlayers(parsed);
                PlayersChanged?.Invoke();
            }, DispatcherPriority.Background);
        }
        catch
        {
            // ignore
        }
    }

    private void ApplyPlayers(IReadOnlyList<PresencePlayer> players)
    {
        Players.Clear();

        var me = _session.CurrentUser;
        var sorted = players
            .OrderBy(p => ScoreActivity(p.Activity))
            .ThenBy(p => p.Username, StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var p in sorted)
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
