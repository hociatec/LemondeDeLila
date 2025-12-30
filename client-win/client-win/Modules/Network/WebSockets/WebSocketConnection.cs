using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;

namespace client_win.Modules.Network.WebSockets;

/// <summary>
/// Connexion WebSocket générique : gère l'ouverture, l'envoi et la réception brute (texte).
/// </summary>
public sealed class WebSocketConnection : IWebSocketConnection
{
    private ClientWebSocket? _socket;
    private CancellationTokenSource? _cts;
    private Task? _receiveLoop;
    private static readonly TimeSpan DefaultConnectTimeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan DefaultKeepAliveInterval = TimeSpan.FromSeconds(25);

    public event Action<WebSocketState>? StateChanged;
    public event Action<string>? MessageReceived;
    public event Action<string>? Error;

    public async Task ConnectAsync(Uri endpoint, string? token = null, IDictionary<string, string>? headers = null, CancellationToken cancellationToken = default)
    {
        await CloseAsync().ConfigureAwait(false);

        _socket = new ClientWebSocket();
        _socket.Options.KeepAliveInterval = DefaultKeepAliveInterval;
        if (!string.IsNullOrWhiteSpace(token))
        {
            _socket.Options.SetRequestHeader("Authorization", $"Bearer {token}");
        }
        _socket.Options.SetRequestHeader("x-lila-client-version", AppInfo.GetShortVersion());
        if (headers != null)
        {
            foreach (var kvp in headers)
            {
                _socket.Options.SetRequestHeader(kvp.Key, kvp.Value);
            }
        }

        // IMPORTANT:
        // - connect timeout: uniquement pour l'appel ConnectAsync (sinon on coupe la room après X secondes d'inactivité)
        // - lifetime token: pour le loop de réception et la fermeture contrôlée
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        SetState(WebSocketState.Connecting);

        try
        {
            using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            connectCts.CancelAfter(DefaultConnectTimeout);

            await _socket.ConnectAsync(endpoint, connectCts.Token).ConfigureAwait(false);
            _receiveLoop = Task.Run(() => ReceiveLoopAsync(_cts.Token));
            SetState(WebSocketState.Connected);
        }
        catch (Exception ex)
        {
            SetState(WebSocketState.Error);
            Error?.Invoke($"WebSocket: {ex.Message}");
            await CloseAsync().ConfigureAwait(false);
            throw;
        }
    }

    public async Task SendAsync(string message, CancellationToken cancellationToken = default)
    {
        if (_socket == null || _socket.State != System.Net.WebSockets.WebSocketState.Open)
        {
            throw new InvalidOperationException("WebSocket non connecté.");
        }
        byte[] buffer = Encoding.UTF8.GetBytes(message);
        await _socket.SendAsync(buffer, WebSocketMessageType.Text, true, cancellationToken).ConfigureAwait(false);
    }

    private async Task ReceiveLoopAsync(CancellationToken cancellationToken)
    {
        if (_socket == null) return;
        var buffer = new byte[4096];
        while (!cancellationToken.IsCancellationRequested && _socket.State == System.Net.WebSockets.WebSocketState.Open)
        {
            try
            {
                var segment = new ArraySegment<byte>(buffer);
                using var ms = new System.IO.MemoryStream();
                WebSocketReceiveResult result;
                do
                {
                    result = await _socket.ReceiveAsync(segment, cancellationToken).ConfigureAwait(false);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "closing", cancellationToken).ConfigureAwait(false);
                        SetState(WebSocketState.Disconnected);
                        return;
                    }
                    ms.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);

                if (ms.Length == 0) continue;
                string text = Encoding.UTF8.GetString(ms.ToArray());
                SafeInvoke(MessageReceived, text);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                Error?.Invoke($"WebSocket: {ex.Message}");
                SetState(WebSocketState.Error);
                await CloseAsync().ConfigureAwait(false);
                return;
            }
        }
    }

    public async Task CloseAsync()
    {
        if (_cts != null)
        {
            _cts.Cancel();
            _cts.Dispose();
            _cts = null;
        }

        if (_socket != null)
        {
            try
            {
                if (_socket.State == System.Net.WebSockets.WebSocketState.Open ||
                    _socket.State == System.Net.WebSockets.WebSocketState.CloseReceived)
                {
                    await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "close", CancellationToken.None).ConfigureAwait(false);
                }
            }
            catch { }
            _socket.Dispose();
            _socket = null;
        }

        SetState(WebSocketState.Disconnected);
    }

    private void SetState(WebSocketState state) => StateChanged?.Invoke(state);

    private void SafeInvoke(Action<string>? handlers, string payload)
    {
        if (handlers == null)
        {
            return;
        }

        foreach (var del in handlers.GetInvocationList())
        {
            try
            {
                ((Action<string>)del).Invoke(payload);
            }
            catch (Exception ex)
            {
                Error?.Invoke($"WebSocket handler error: {ex.Message}");
            }
        }
    }

    public async ValueTask DisposeAsync()
    {
        await CloseAsync().ConfigureAwait(false);
    }
}
