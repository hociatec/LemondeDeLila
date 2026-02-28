using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using client_win.Modules.Game.Common;
using Serilog;

namespace client_win.Modules.Game.Play.Session.Services;

internal sealed class GamePlayConnectionController : IAsyncDisposable
{
    private readonly Dispatcher _dispatcher;
    private readonly Func<CancellationToken, Task<GameSession>> _connect;
    private readonly Func<GameSession?> _getSession;
    private readonly Action<GameSession?> _setSession;
    private readonly Action<GameSession> _bindSession;
    private readonly Action<GameSession> _unbindSession;
    private readonly Action<string> _setConnectionStatus;
    private readonly Action _refreshCanExecute;
    private readonly Action _noteForcedTurnRequest;

    private CancellationTokenSource? _reconnectCts;
    private Task? _reconnectLoop;

    internal GamePlayConnectionController(
        Dispatcher dispatcher,
        Func<CancellationToken, Task<GameSession>> connect,
        Func<GameSession?> getSession,
        Action<GameSession?> setSession,
        Action<GameSession> bindSession,
        Action<GameSession> unbindSession,
        Action<string> setConnectionStatus,
        Action refreshCanExecute,
        Action noteForcedTurnRequest)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _connect = connect ?? throw new ArgumentNullException(nameof(connect));
        _getSession = getSession ?? throw new ArgumentNullException(nameof(getSession));
        _setSession = setSession ?? throw new ArgumentNullException(nameof(setSession));
        _bindSession = bindSession ?? throw new ArgumentNullException(nameof(bindSession));
        _unbindSession = unbindSession ?? throw new ArgumentNullException(nameof(unbindSession));
        _setConnectionStatus = setConnectionStatus ?? throw new ArgumentNullException(nameof(setConnectionStatus));
        _refreshCanExecute = refreshCanExecute ?? throw new ArgumentNullException(nameof(refreshCanExecute));
        _noteForcedTurnRequest = noteForcedTurnRequest ?? throw new ArgumentNullException(nameof(noteForcedTurnRequest));
    }

    internal async Task InitializeAsync(CancellationToken cancellationToken)
    {
        _setConnectionStatus("Connexion au moteur de jeu...");

        try
        {
            var session = await _connect(cancellationToken).ConfigureAwait(false);
            _setSession(session);
            _bindSession(session);

            await _dispatcher.InvokeAsync(() =>
            {
                _setConnectionStatus("Connecté au moteur de jeu.");
                _refreshCanExecute();
            }, DispatcherPriority.Background);

            await session.RequestStateAsync(cancellationToken).ConfigureAwait(false);
            _noteForcedTurnRequest();
            await session.RequestTurnAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _setConnectionStatus($"Connexion jeu échouée: {ex.Message}");
        }
    }

    internal void HandleServerError(string message)
    {
        if (!LooksLikeDisconnect(message))
        {
            return;
        }

        StartReconnectLoop();
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            _reconnectCts?.Cancel();
        }
        catch
        {
            // ignore
        }

        // Empêcher des InvokeAsync tardifs après la sortie de la table.
        // (Sinon la loop peut continuer un instant et toucher le VM après navigation.)
        var loop = _reconnectLoop;
        if (loop != null)
        {
            try
            {
                await loop.ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
        }

        var session = _getSession();
        _setSession(null);
        if (session != null)
        {
            _unbindSession(session);
            try
            {
                await session.CloseAsync().ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
            await session.DisposeAsync().ConfigureAwait(false);
        }

        if (_reconnectCts != null)
        {
            _reconnectCts.Dispose();
            _reconnectCts = null;
        }
    }

    private static bool LooksLikeDisconnect(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        var m = message.Trim();
        return m.Contains("Connexion jeu perdue", StringComparison.OrdinalIgnoreCase) ||
               m.Contains("WebSocket", StringComparison.OrdinalIgnoreCase) ||
               m.Contains("closed the WebSocket connection", StringComparison.OrdinalIgnoreCase);
    }

    private void StartReconnectLoop()
    {
        if (_reconnectLoop != null && !_reconnectLoop.IsCompleted)
        {
            return;
        }

        _reconnectCts?.Cancel();
        _reconnectCts?.Dispose();
        _reconnectCts = new CancellationTokenSource();

        _reconnectLoop = Task.Run(() => ReconnectLoopAsync(_reconnectCts.Token));
    }

    private async Task ReconnectLoopAsync(CancellationToken cancellationToken)
    {
        var attempt = 0;
        while (!cancellationToken.IsCancellationRequested)
        {
            attempt++;

            await _dispatcher.InvokeAsync(() =>
            {
                _setConnectionStatus($"Reconnexion au moteur de jeu... (tentative {attempt})");
                _refreshCanExecute();
            }, DispatcherPriority.Background);

            try
            {
                var old = _getSession();
                _setSession(null);
                if (old != null)
                {
                    _unbindSession(old);
                    try
                    {
                        await old.CloseAsync().ConfigureAwait(false);
                    }
                    catch
                    {
                        // ignore
                    }
                    await old.DisposeAsync().ConfigureAwait(false);
                }

                using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                connectCts.CancelAfter(GameTiming.Game.ReconnectConnectTimeout);

                var session = await _connect(connectCts.Token).ConfigureAwait(false);
                _bindSession(session);
                _setSession(session);

                await session.JoinAsync(connectCts.Token).ConfigureAwait(false);
                await session.RequestStateAsync(connectCts.Token).ConfigureAwait(false);
                _noteForcedTurnRequest();
                await session.RequestTurnAsync(connectCts.Token).ConfigureAwait(false);

                await _dispatcher.InvokeAsync(() =>
                {
                    _setConnectionStatus("Reconnecté au moteur de jeu.");
                    _refreshCanExecute();
                }, DispatcherPriority.Background);

                return;
            }
            catch (Exception ex)
            {
                var msg = ex.Message ?? string.Empty;
                if (ex is OperationCanceledException or TaskCanceledException)
                {
                    Log.Debug("Reconnexion game WS annulée (tentative {Attempt})", attempt);
                }
                else if (msg.Contains("refusée", StringComparison.OrdinalIgnoreCase) ||
                         msg.Contains("refused", StringComparison.OrdinalIgnoreCase))
                {
                    Log.Information("Reconnexion game WS impossible (serveur indisponible) (tentative {Attempt}): {Message}", attempt, msg);
                }
                else
                {
                    Log.Warning("Reconnexion game WS échouée (tentative {Attempt}): {Message}", attempt, msg);
                }

                await _dispatcher.InvokeAsync(() =>
                {
                    _setConnectionStatus($"Connexion jeu perdue. Reconnexion... (tentative {attempt})");
                    _refreshCanExecute();
                }, DispatcherPriority.Background);
            }

            var delay = ComputeBackoff(attempt);
            try
            {
                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                return;
            }
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

        return GameTiming.ComputeJitterBackoff(seconds);
    }
}
