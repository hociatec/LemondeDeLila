using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Core.Constants;
using client_win.Core.Network;
using Serilog;

namespace client_win.Modules.Network;

/// <summary>
/// Maintient une connexion WebSocket persistante et route les réponses par requestId.
/// Implémente exponential backoff, keep-alive, auto-reconnect et circuit breaker.
/// </summary>
public sealed class PersistentWsClient : IAsyncDisposable
{
    private const int DefaultSendTimeoutSeconds = 10;
    private const int DefaultReceiveTimeoutSeconds = 20;
    private static readonly TimeSpan DefaultConnectTimeout = TimeSpan.FromSeconds(10);

    private readonly Uri _endpoint;
    private readonly Modules.Error.ErrorBus? _errorBus;
    private readonly JsonSerializerOptions _serializerOptions = new(JsonSerializerDefaults.Web);
    private readonly TimeSpan _sendTimeout;
    private readonly TimeSpan _receiveTimeout;
    private readonly NetworkConfiguration _networkConfig;
    private readonly NetworkStateMonitor? _networkMonitor;
    private readonly ConcurrentDictionary<string, TaskCompletionSource<string>> _pending = new();
    private readonly object _sync = new();
    private readonly SemaphoreSlim _connectGate = new(1, 1);
    private readonly SemaphoreSlim _sendGate = new(1, 1);

    // Circuit breaker
    private int _consecutiveFailures;
    private DateTime _firstFailureTime = DateTime.MinValue;

    private ClientWebSocket? _socket;
    private string? _currentToken;
    private string? _currentWsTicket;
    private CancellationTokenSource? _receiveCts;
    private Task? _receiveLoop;
    private bool _isDisposed;
    private bool _isPausedByNetwork;
    private volatile bool _updateRequired;
    private HashSet<string>? _supportedWsTypes;

    public event Action<string>? UnmatchedMessageReceived;
    public event Action? Connected;
    public event Action<string>? Disconnected;
    public event Action<int, TimeSpan>? Reconnecting;

    public void SetSupportedWsTypes(IEnumerable<string>? wsTypes)
    {
        if (wsTypes == null)
        {
            lock (_sync)
            {
                _supportedWsTypes = null;
            }
            return;
        }

        var set = new HashSet<string>(
            wsTypes.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()),
            StringComparer.OrdinalIgnoreCase);

        lock (_sync)
        {
            _supportedWsTypes = set.Count > 0 ? set : null;
        }
    }

    // Surcharge explicite pour DI (évite les erreurs d'appariement d'arguments nommés/optionnels)
    public PersistentWsClient(
        Uri endpoint,
        Modules.Error.ErrorBus errorBus,
        int sendTimeoutSeconds,
        int receiveTimeoutSeconds,
        NetworkConfiguration networkConfig,
        NetworkStateMonitor networkMonitor)
        : this(endpoint, errorBus, (int?)sendTimeoutSeconds, (int?)receiveTimeoutSeconds, networkConfig, networkMonitor)
    {
    }

    public PersistentWsClient(
        Uri endpoint,
        Modules.Error.ErrorBus? errorBus = null,
        int? sendTimeoutSeconds = null,
        int? receiveTimeoutSeconds = null,
        NetworkConfiguration? networkConfig = null,
        NetworkStateMonitor? networkMonitor = null)
    {
        _endpoint = endpoint ?? throw new ArgumentNullException(nameof(endpoint));
        _errorBus = errorBus;
        _sendTimeout = TimeSpan.FromSeconds(sendTimeoutSeconds ?? DefaultSendTimeoutSeconds);
        _receiveTimeout = TimeSpan.FromSeconds(receiveTimeoutSeconds ?? DefaultReceiveTimeoutSeconds);
        _networkConfig = networkConfig ?? NetworkConfiguration.Load();
        _networkMonitor = networkMonitor;

        // S'abonner aux événements réseau si disponible
        if (_networkMonitor != null)
        {
            _networkMonitor.NetworkAvailable += OnNetworkAvailable;
            _networkMonitor.NetworkUnavailable += OnNetworkUnavailable;
            _isPausedByNetwork = !_networkMonitor.IsNetworkAvailable;
        }

        Log.Debug("PersistentWsClient créé pour {Endpoint}", endpoint);
    }

    private void OnNetworkAvailable()
    {
        lock (_sync)
        {
            if (_isPausedByNetwork)
            {
                _isPausedByNetwork = false;
                Log.Information("Réseau disponible, reconnexion WebSocket débloquée");
                // Reset circuit breaker quand le réseau revient
                _consecutiveFailures = 0;
            }
        }
    }

    private void OnNetworkUnavailable()
    {
        lock (_sync)
        {
            _isPausedByNetwork = true;
            Log.Warning("Réseau indisponible, pause des tentatives de reconnexion WebSocket");
        }
    }

    public async Task<string> SendAsync(string type, object payload, string? token, string? wsTicket, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(type))
        {
            throw new ArgumentException("type requis", nameof(type));
        }

        // If we know the server capabilities, avoid sending unsupported messages.
        // Keep api.capabilities always allowed so we can bootstrap the capabilities cache.
        if (!string.Equals(type, "api.capabilities", StringComparison.OrdinalIgnoreCase))
        {
            HashSet<string>? supported;
            lock (_sync)
            {
                supported = _supportedWsTypes;
            }

            if (supported != null && !supported.Contains(type))
            {
                // Ne pas bloquer les routes admin sur une liste de capabilities potentiellement incomplète / périmée.
                // Exemple: backend mis à jour mais le client garde une ancienne liste en cache.
                if (type.StartsWith("admin.", StringComparison.OrdinalIgnoreCase))
                {
                    Log.Warning("WS route absente des capabilities, envoi quand même (admin): {Type}", type);
                }
                else
                {
                    throw new NotSupportedException($"WS route non supportée par le serveur: {type}");
                }
            }
        }

        // NOTE: le socket peut être disposé par la receive loop (ResetSocketAsync)
        // pendant un envoi, ce qui provoque un ObjectDisposedException/SslStream disposed.
        // On fait un retry best-effort en forçant un reset puis une reconnexion.
        for (int attempt = 1; attempt <= 2; attempt++)
        {
            var socket = await EnsureConnectedAsync(token, wsTicket, cancellationToken).ConfigureAwait(false);
            string requestId = Guid.NewGuid().ToString("N");
            var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
            _pending[requestId] = tcs;

            var message = new
            {
                type,
                requestId,
                payload
            };

            Log.Debug("WS -> {Type} ({RequestId}) [attempt {Attempt}]", type, requestId, attempt);
            byte[] buffer = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message, _serializerOptions));
            try
            {
                using var sendCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                sendCts.CancelAfter(_sendTimeout);
                await _sendGate.WaitAsync(sendCts.Token).ConfigureAwait(false);
                try
                {
                    await socket.SendAsync(buffer, WebSocketMessageType.Text, true, sendCts.Token).ConfigureAwait(false);
                }
                finally
                {
                    try { _sendGate.Release(); } catch { }
                }

                using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeoutCts.CancelAfter(_receiveTimeout);
                using var registration = timeoutCts.Token.Register(() => tcs.TrySetCanceled(timeoutCts.Token));
                return await tcs.Task.ConfigureAwait(false);
            }
            catch (TaskCanceledException ex) when (attempt < 2 && !cancellationToken.IsCancellationRequested)
            {
                // Peut arriver si la connexion est réinitialisée en parallèle (ResetSocketAsync)
                // et annule les pending avant l'expiration du vrai timeout.
                _pending.TryRemove(requestId, out _);
                Log.Warning(ex, "WS request canceled (retry): {Type}", type);
                await ResetSocketAsync().ConfigureAwait(false);
                continue;
            }
            catch (Exception ex) when (attempt < 2 && !cancellationToken.IsCancellationRequested && IsRetryableTransportException(ex))
            {
                _pending.TryRemove(requestId, out _);
                Log.Warning(ex, "WS send failed (retry): {Type}", type);
                await ResetSocketAsync().ConfigureAwait(false);
                continue;
            }
            catch
            {
                _pending.TryRemove(requestId, out _);
                throw;
            }
        }

        // Unreachable: the loop returns or throws.
        throw new InvalidOperationException("WS send failed after retries.");
    }

    private static bool IsRetryableTransportException(Exception ex)
    {
        if (ex is ObjectDisposedException) return true;
        if (ex is WebSocketException) return true;
        if (ex is IOException) return true;
        if (ex is InvalidOperationException ioe &&
            ioe.Message.Contains("WebSocket", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
        return false;
    }

    private async Task<ClientWebSocket> EnsureConnectedAsync(string? token, string? wsTicket, CancellationToken cancellationToken)
    {
        await _connectGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
        // Vérifier circuit breaker
        CheckCircuitBreaker();

        if (_updateRequired)
        {
            throw new InvalidOperationException("Mise Ã  jour requise pour continuer.");
        }

        lock (_sync)
        {
            if (_socket != null &&
                _socket.State == WebSocketState.Open &&
                string.Equals(_currentToken, token, StringComparison.Ordinal))
            {
                return _socket;
            }
        }

        await ResetSocketAsync().ConfigureAwait(false);

        Exception? lastException = null;
        int maxAttempts = _networkConfig.MaxReconnectAttempts;

        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            // Si réseau indisponible, attendre avant de réessayer
            if (_isPausedByNetwork)
            {
                Log.Debug("Tentative {Attempt}/{Max} ignorée - réseau indisponible", attempt, maxAttempts);
                await Task.Delay(1000, cancellationToken).ConfigureAwait(false);
                continue;
            }

            try
            {
                var socket = new ClientWebSocket();

                // Keep-alive configuration
                socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(_networkConfig.KeepAliveIntervalSeconds);
                Log.Debug("Keep-alive WebSocket configuré: {Interval}s", _networkConfig.KeepAliveIntervalSeconds);

                // Headers d'authentification
                if (!string.IsNullOrWhiteSpace(token))
                {
                    socket.Options.SetRequestHeader("Authorization", $"Bearer {token}");
                }
                if (!string.IsNullOrWhiteSpace(wsTicket))
                {
                    socket.Options.SetRequestHeader("x-lila-ws-ticket", wsTicket);
                }
                socket.Options.SetRequestHeader("x-lila-client-version", AppInfo.GetShortVersion());

                Log.Debug("Tentative de connexion WebSocket {Attempt}/{Max} vers {Endpoint}", attempt, maxAttempts, _endpoint);
                using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                connectCts.CancelAfter(_sendTimeout > TimeSpan.Zero ? _sendTimeout : DefaultConnectTimeout);
                await socket.ConnectAsync(_endpoint, connectCts.Token).ConfigureAwait(false);

                lock (_sync)
                {
                    _socket = socket;
                    _currentToken = token;
                    _currentWsTicket = wsTicket;
                    _receiveCts = new CancellationTokenSource();

                    // Observe la tâche pour éviter UnobservedTaskException
                    _receiveLoop = Task.Run(() => ReceiveLoopAsync(socket, _receiveCts.Token));
                    _receiveLoop.ContinueWith(task =>
                    {
                        if (task.IsFaulted && task.Exception != null)
                        {
                            Log.Error(task.Exception, "Erreur critique dans la boucle de réception WebSocket");
                            _errorBus?.Publish(new Modules.Error.AppError(
                                "Erreur critique dans la boucle de réception WebSocket.",
                                Modules.Error.ErrorSeverity.Error,
                                context: WsMessageTypes.ErrorContext.WsReceive,
                                detail: task.Exception.InnerException?.Message ?? task.Exception.Message));
                        }
                    }, TaskContinuationOptions.OnlyOnFaulted);
                }

                try
                {
                    Connected?.Invoke();
                }
                catch
                {
                    // ignore
                }

                // Connexion réussie - reset circuit breaker
                ResetCircuitBreaker();
                Log.Information("✓ Connexion WebSocket établie avec succès (tentative {Attempt})", attempt);
                return socket;
            }
            catch (Exception ex)
            {
                lastException = ex;
                RecordFailure();

                Log.Warning(ex, "Échec connexion WebSocket (tentative {Attempt}/{Max})", attempt, maxAttempts);

                if (attempt < maxAttempts)
                {
                    var delay = RetryStrategy.CalculateDelay(attempt, _networkConfig);
                    try
                    {
                        Reconnecting?.Invoke(attempt + 1, delay);
                    }
                    catch
                    {
                        // ignore
                    }
                    Log.Debug("Attente de {Delay}ms avant prochaine tentative...", delay.TotalMilliseconds);
                    await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
                }
            }
        }

        _errorBus?.Publish(new Modules.Error.AppError(
            "Impossible de se connecter au serveur après plusieurs tentatives.",
            Modules.Error.ErrorSeverity.Error,
            context: WsMessageTypes.ErrorContext.WsConnect,
            detail: lastException?.Message));

        Log.Error(lastException, "✗ Impossible de se connecter au serveur WebSocket après {Attempts} tentatives", maxAttempts);
        throw new InvalidOperationException("Impossible de se connecter au serveur WebSocket.", lastException);
        }
        finally
        {
            try { _connectGate.Release(); } catch { }
        }
    }

    private void CheckCircuitBreaker()
    {
        lock (_sync)
        {
            if (_consecutiveFailures >= _networkConfig.CircuitBreakerThreshold)
            {
                var elapsed = DateTime.UtcNow - _firstFailureTime;
                if (elapsed < TimeSpan.FromMinutes(_networkConfig.CircuitBreakerWindowMinutes))
                {
                    var message = $"Circuit breaker ouvert: {_consecutiveFailures} échecs consécutifs en {elapsed.TotalMinutes:F1} minutes";
                    Log.Error(message);
                    throw new InvalidOperationException(message);
                }
                else
                {
                    // Fenêtre expirée, reset
                    Log.Information("Circuit breaker: Fenêtre de {Minutes} minutes expirée, réinitialisation", _networkConfig.CircuitBreakerWindowMinutes);
                    _consecutiveFailures = 0;
                }
            }
        }
    }

    private void RecordFailure()
    {
        lock (_sync)
        {
            if (_consecutiveFailures == 0)
            {
                _firstFailureTime = DateTime.UtcNow;
            }
            _consecutiveFailures++;
            Log.Debug("Circuit breaker: {Failures} échecs consécutifs", _consecutiveFailures);
        }
    }

    private void ResetCircuitBreaker()
    {
        lock (_sync)
        {
            if (_consecutiveFailures > 0)
            {
                Log.Debug("Circuit breaker réinitialisé (était à {Failures} échecs)", _consecutiveFailures);
                _consecutiveFailures = 0;
                _firstFailureTime = DateTime.MinValue;
            }
        }
    }

    private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken cancellationToken)
    {
        var buffer = new byte[_networkConfig.ReceiveBufferSize];
        Log.Debug("Receive loop démarrée avec buffer de {Size} bytes", buffer.Length);

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
                        Log.Information("WebSocket fermé par le serveur: {Status} - {Description}",
                            socket.CloseStatus, socket.CloseStatusDescription);
                        var isUpdateRequired = IsUpdateRequiredClose(socket.CloseStatus, socket.CloseStatusDescription);
                        PublishCloseAsErrorIfNeeded(socket.CloseStatus, socket.CloseStatusDescription);
                        if (!isUpdateRequired)
                        {
                            FireDisconnected($"close {socket.CloseStatus} {socket.CloseStatusDescription}".Trim());
                        }
                        FailAllPending($"Connexion WS fermée par le serveur ({socket.CloseStatus} - {socket.CloseStatusDescription}).");
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
                string msgType = root.TryGetProperty("type", out var typeNode) ? typeNode.GetString() ?? string.Empty : string.Empty;

                Log.Debug("WS <- {Type} ({RequestId})", string.IsNullOrWhiteSpace(msgType) ? "?" : msgType, string.IsNullOrWhiteSpace(requestId) ? "?" : requestId);

                if (string.IsNullOrWhiteSpace(requestId))
                {
                    // Certains backends ne renvoient pas de requestId : on route vers la première requête en attente
                    if (_pending.Count == 0)
                    {
                        Log.Debug("Message WebSocket sans requestId ignoré (aucune requête en attente)");
                        continue;
                    }

                    var firstPendingKey = _pending.Keys.FirstOrDefault();
                    if (!string.IsNullOrEmpty(firstPendingKey) && _pending.TryRemove(firstPendingKey, out var tcsNoId))
                    {
                        Log.Warning("Message WebSocket sans requestId: routage vers la requête {RequestId}", firstPendingKey);
                        tcsNoId.TrySetResult(doc.RootElement.GetRawText());
                    }
                    else
                    {
                        Log.Debug("Message WebSocket sans requestId reçu mais aucun pending trouvé");
                    }
                    continue;
                }

                if (_pending.TryRemove(requestId, out var tcs))
                {
                    tcs.TrySetResult(doc.RootElement.GetRawText());
                }
                else
                {
                    // Message "push" (subscription) ou réponse tardive : ne pas jeter, on le propage.
                    try
                    {
                        UnmatchedMessageReceived?.Invoke(doc.RootElement.GetRawText());
                    }
                    catch
                    {
                        // ignore
                    }
                }
            }
            catch (OperationCanceledException)
            {
                Log.Debug("Receive loop annulée");
                return;
            }
            catch (Exception ex)
            {
                Log.Warning("Erreur dans receive loop WebSocket: {Message}", ex.Message);
                _errorBus?.Publish(new Modules.Error.AppError(
                    "Connexion WS interrompue.",
                    Modules.Error.ErrorSeverity.Warning,
                    context: WsMessageTypes.ErrorContext.WsReceive,
                    detail: ex.Message));

                FireDisconnected(ex.Message);
                await ResetSocketAsync().ConfigureAwait(false);

                // NOTE: Au lieu de return (qui terminait définitivement la loop),
                // on pourrait implémenter une auto-reconnexion ici.
                // Pour l'instant, on laisse la logique existante : la loop se termine
                // et une nouvelle connexion sera créée au prochain SendAsync.
                return;
            }
        }

        Log.Debug("Receive loop terminée (cancelled: {Cancelled}, state: {State})",
            cancellationToken.IsCancellationRequested, socket.State);
    }

    private void FireDisconnected(string? reason)
    {
        try
        {
            Disconnected?.Invoke(string.IsNullOrWhiteSpace(reason) ? "disconnected" : reason.Trim());
        }
        catch
        {
            // ignore
        }
    }

    private static bool IsUpdateRequiredClose(WebSocketCloseStatus? status, string? description)
    {
        var code = status.HasValue ? (int)status.Value : 0;
        var reason = (description ?? string.Empty).Trim();

        // Custom server close code used by Lila to force updates.
        // Keep the detection intentionally simple and ASCII-safe.
        return code == 4406 || reason.Contains("update required", StringComparison.OrdinalIgnoreCase);
    }

    private void PublishCloseAsErrorIfNeeded(WebSocketCloseStatus? status, string? description)
    {
        try
        {
            var code = status.HasValue ? (int)status.Value : 0;
            var reason = (description ?? string.Empty).Trim();

            // Custom server close code used by Lila to force updates.
            // We also fallback to reason substring detection because some stacks may not preserve custom codes.
            var isUpdateRequired =
                code == 4406 ||
                reason.Contains("update required", StringComparison.OrdinalIgnoreCase) ||
                reason.Contains("mise à jour", StringComparison.OrdinalIgnoreCase);

            if (!isUpdateRequired)
            {
                return;
            }

            // Avoid reconnect loops: once the server requires an update, stop trying to reconnect.
            _updateRequired = true;

            // Keep message stable so ShellErrorHandler can consistently show the update dialog.
            _errorBus?.Publish(new Modules.Error.AppError(
                "Mise à jour requise pour continuer.",
                Modules.Error.ErrorSeverity.Error,
                context: "client.update.required",
                detail: $"ws.close {code} {reason}".Trim()));
        }
        catch
        {
            // ignore
        }
    }

    private void FailAllPending(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            message = "Connexion WS interrompue.";
        }

        foreach (var key in _pending.Keys)
        {
            if (_pending.TryRemove(key, out var tcs))
            {
                tcs.TrySetException(new InvalidOperationException(message));
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
            _currentWsTicket = null;
            _supportedWsTypes = null;

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
                // Attendre maximum timeout configuré pour éviter de bloquer indéfiniment
                int timeout = _networkConfig?.CleanupTimeoutMs ?? AppConstants.SocketCleanupTimeoutMs;
                await Task.WhenAny(receiveLoopToWait, Task.Delay(timeout)).ConfigureAwait(false);
                Log.Debug("Receive loop attendue pendant cleanup (timeout: {Timeout}ms)", timeout);
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

        Log.Debug("Dispose PersistentWsClient");
        _isDisposed = true;

        // Unsubscribe des événements réseau
        if (_networkMonitor != null)
        {
            _networkMonitor.NetworkAvailable -= OnNetworkAvailable;
            _networkMonitor.NetworkUnavailable -= OnNetworkUnavailable;
        }

        await ResetSocketAsync().ConfigureAwait(false);
    }
}
