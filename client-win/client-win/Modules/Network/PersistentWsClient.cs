using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;

namespace client_win.Modules.Network;

/// <summary>
/// Maintient une connexion WebSocket persistante et route les réponses par requestId.
/// </summary>
public sealed class PersistentWsClient : IAsyncDisposable
{
    private const int DefaultSendTimeoutSeconds = 10;
    private const int DefaultReceiveTimeoutSeconds = 20;
    private const int MaxReconnectAttempts = 3;
    private const int ReconnectDelayMilliseconds = 1000;

    private readonly Uri _endpoint;
    private readonly Modules.Error.ErrorBus? _errorBus;
    private readonly JsonSerializerOptions _serializerOptions = new(JsonSerializerDefaults.Web);
    private readonly TimeSpan _sendTimeout;
    private readonly TimeSpan _receiveTimeout;
    private readonly ConcurrentDictionary<string, TaskCompletionSource<string>> _pending = new();
    private readonly object _sync = new();

    private ClientWebSocket? _socket;
    private string? _currentToken;
    private string? _currentSignature;
    private CancellationTokenSource? _receiveCts;
    private Task? _receiveLoop;
    private bool _isDisposed;

    public PersistentWsClient(Uri endpoint, Modules.Error.ErrorBus? errorBus = null, int? sendTimeoutSeconds = null, int? receiveTimeoutSeconds = null)
    {
        _endpoint = endpoint ?? throw new ArgumentNullException(nameof(endpoint));
        _errorBus = errorBus;
        _sendTimeout = TimeSpan.FromSeconds(sendTimeoutSeconds ?? DefaultSendTimeoutSeconds);
        _receiveTimeout = TimeSpan.FromSeconds(receiveTimeoutSeconds ?? DefaultReceiveTimeoutSeconds);
    }

    public async Task<string> SendAsync(string type, object payload, string? token, string? signature, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(type))
        {
            throw new ArgumentException("type requis", nameof(type));
        }

        var socket = await EnsureConnectedAsync(token, signature, cancellationToken).ConfigureAwait(false);
        string requestId = Guid.NewGuid().ToString("N");
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pending[requestId] = tcs;

        var message = new
        {
            type,
            requestId,
            payload
        };

        byte[] buffer = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message, _serializerOptions));
        using var sendCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        sendCts.CancelAfter(_sendTimeout);
        try
        {
            await socket.SendAsync(buffer, WebSocketMessageType.Text, true, sendCts.Token).ConfigureAwait(false);
        }
        catch
        {
            _pending.TryRemove(requestId, out _);
            throw;
        }

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(_receiveTimeout);
        using var registration = timeoutCts.Token.Register(() => tcs.TrySetCanceled(timeoutCts.Token));
        return await tcs.Task.ConfigureAwait(false);
    }

    private async Task<ClientWebSocket> EnsureConnectedAsync(string? token, string? signature, CancellationToken cancellationToken)
    {
        lock (_sync)
        {
            if (_socket != null &&
                _socket.State == WebSocketState.Open &&
                string.Equals(_currentToken, token, StringComparison.Ordinal) &&
                string.Equals(_currentSignature, signature, StringComparison.Ordinal))
            {
                return _socket;
            }
        }

        await ResetSocketAsync().ConfigureAwait(false);

        Exception? lastException = null;
        for (int attempt = 1; attempt <= MaxReconnectAttempts; attempt++)
        {
            try
            {
                var socket = new ClientWebSocket();
                if (!string.IsNullOrWhiteSpace(token))
                {
                    socket.Options.SetRequestHeader("Authorization", $"Bearer {token}");
                }
                if (!string.IsNullOrWhiteSpace(signature))
                {
                    socket.Options.SetRequestHeader("x-lila-ws-signature", signature);
                }

                await socket.ConnectAsync(_endpoint, cancellationToken).ConfigureAwait(false);

                lock (_sync)
                {
                    _socket = socket;
                    _currentToken = token;
                    _currentSignature = signature;
                    _receiveCts = new CancellationTokenSource();

                    // CORRECTION: Observe la tâche pour éviter UnobservedTaskException
                    _receiveLoop = Task.Run(() => ReceiveLoopAsync(socket, _receiveCts.Token));
                    _receiveLoop.ContinueWith(task =>
                    {
                        if (task.IsFaulted && task.Exception != null)
                        {
                            // Log l'exception pour éviter UnobservedTaskException
                            _errorBus?.Publish(new Modules.Error.AppError(
                                "Erreur critique dans la boucle de réception WebSocket.",
                                Modules.Error.ErrorSeverity.Error,
                                context: WsMessageTypes.ErrorContext.WsReceive,
                                detail: task.Exception.InnerException?.Message ?? task.Exception.Message));
                        }
                    }, TaskContinuationOptions.OnlyOnFaulted);
                }

                return socket;
            }
            catch (Exception ex)
            {
                lastException = ex;
                if (attempt < MaxReconnectAttempts)
                {
                    await Task.Delay(ReconnectDelayMilliseconds * attempt, cancellationToken).ConfigureAwait(false);
                }
            }
        }

        _errorBus?.Publish(new Modules.Error.AppError(
            "Impossible de se connecter au serveur après plusieurs tentatives.",
            Modules.Error.ErrorSeverity.Error,
            context: WsMessageTypes.ErrorContext.WsConnect,
            detail: lastException?.Message));
        throw new InvalidOperationException("Impossible de se connecter au serveur WebSocket.", lastException);
    }

    private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken cancellationToken)
    {
        var buffer = new byte[4096];
        while (!cancellationToken.IsCancellationRequested && socket.State == WebSocketState.Open)
        {
            try
            {
                var builder = new ArraySegment<byte>(buffer);
                using var stream = new MemoryStream();
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(builder, cancellationToken).ConfigureAwait(false);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "closing", cancellationToken).ConfigureAwait(false);
                        return;
                    }
                    stream.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);

                var payload = stream.ToArray();
                if (payload.Length == 0)
                {
                    continue;
                }

                using var doc = JsonDocument.Parse(payload);
                var root = doc.RootElement;
                string requestId = root.TryGetProperty("requestId", out var idNode) ? idNode.GetString() ?? string.Empty : string.Empty;
                if (string.IsNullOrWhiteSpace(requestId))
                {
                    continue;
                }

                if (_pending.TryRemove(requestId, out var tcs))
                {
                    tcs.TrySetResult(doc.RootElement.GetRawText());
                }
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                _errorBus?.Publish(new Modules.Error.AppError("Connexion WS interrompue.", Modules.Error.ErrorSeverity.Warning, context: WsMessageTypes.ErrorContext.WsReceive, detail: ex.Message));
                await ResetSocketAsync().ConfigureAwait(false);
                return;
            }
        }
    }

    private async Task ResetSocketAsync()
    {
        ClientWebSocket? toDispose = null;
        Task? receiveLoopToWait = null;
        TaskCompletionSource<string>[] pendingToCancel;

        lock (_sync)
        {
            if (_receiveCts != null)
            {
                _receiveCts.Cancel();
                _receiveCts.Dispose();
                _receiveCts = null;
            }
            if (_socket != null)
            {
                toDispose = _socket;
                _socket = null;
            }

            // CORRECTION: Capture la tâche de réception pour l'attendre
            if (_receiveLoop != null)
            {
                receiveLoopToWait = _receiveLoop;
                _receiveLoop = null;
            }

            _currentToken = null;
            _currentSignature = null;

            // THREAD SAFETY: Créer un snapshot des requêtes pendantes dans le lock
            // avant de nettoyer le dictionnaire. Ceci évite les race conditions
            // si un autre thread appelle SendAsync pendant le reset.
            pendingToCancel = _pending.Values.ToArray();
            _pending.Clear();
        }

        // CORRECTION: Attendre la fin de la boucle de réception en dehors du lock
        if (receiveLoopToWait != null)
        {
            try
            {
                // Attendre maximum 5 secondes pour éviter de bloquer indéfiniment
                await Task.WhenAny(receiveLoopToWait, Task.Delay(5000)).ConfigureAwait(false);
            }
            catch
            {
                // JUSTIFICATION: Erreurs d'attente non critiques
                // La tâche sera garbage collectée de toute façon
            }
        }

        // Dispose du socket en dehors du lock (I/O lente)
        if (toDispose != null)
        {
            try
            {
                if (toDispose.State == WebSocketState.Open || toDispose.State == WebSocketState.CloseReceived)
                {
                    await toDispose.CloseAsync(WebSocketCloseStatus.NormalClosure, "reset", CancellationToken.None).ConfigureAwait(false);
                }
            }
            catch
            {
                // JUSTIFICATION: Erreurs de fermeture non critiques, le socket sera GC de toute façon
                // Logging causerait du bruit sans valeur ajoutée
            }
            toDispose.Dispose();
        }

        // Annule toutes les requêtes pendantes en dehors du lock
        foreach (var tcs in pendingToCancel)
        {
            tcs.TrySetCanceled();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_isDisposed)
        {
            return;
        }
        _isDisposed = true;
        await ResetSocketAsync().ConfigureAwait(false);
    }
}
