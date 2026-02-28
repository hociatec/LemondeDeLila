using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Common;

namespace client_win.Modules.Game.Play.Session.Services;

internal sealed class GameSessionKeepAlive : IAsyncDisposable
{
    private readonly Func<bool> _isConnected;
    private readonly Func<CancellationToken, Task> _sendPing;
    private CancellationTokenSource? _cts;
    private Task? _loop;

    internal GameSessionKeepAlive(Func<bool> isConnected, Func<CancellationToken, Task> sendPing)
    {
        _isConnected = isConnected ?? throw new ArgumentNullException(nameof(isConnected));
        _sendPing = sendPing ?? throw new ArgumentNullException(nameof(sendPing));
    }

    internal void Start(TimeSpan? interval = null)
    {
        var tick = interval ?? GameTiming.Game.KeepAliveDefaultTick;
        if (tick < GameTiming.Game.KeepAliveMinTick)
        {
            tick = GameTiming.Game.KeepAliveMinTick;
        }

        if (_loop != null && !_loop.IsCompleted)
        {
            return;
        }

        _cts?.Cancel();
        _cts?.Dispose();
        _cts = new CancellationTokenSource();

        _loop = Task.Run(() => LoopAsync(tick, _cts.Token));
    }

    internal void Stop()
    {
        try
        {
            _cts?.Cancel();
        }
        catch
        {
            // ignore
        }
    }

    public async ValueTask DisposeAsync()
    {
        Stop();

        if (_cts != null)
        {
            _cts.Dispose();
            _cts = null;
        }

        if (_loop != null)
        {
            try
            {
                await _loop.ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
            _loop = null;
        }
    }

    private async Task LoopAsync(TimeSpan interval, CancellationToken cancellationToken)
    {
        // IMPORTANT: ne pas utiliser `game.state` en keep-alive.
        // `game.state` passe par la queue de mutations côté serveur (même clé roomId/gameType)
        // et peut donc retarder `game.actions` => impression de latence sur les raccourcis.
        // On envoie un ping léger: le serveur compte l'activité via `on message`.
        using var timer = new PeriodicTimer(interval);

        if (_isConnected())
        {
            await _sendPing(cancellationToken).ConfigureAwait(false);
        }

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var ok = await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false);
                if (!ok)
                {
                    return;
                }
            }
            catch
            {
                return;
            }

            if (!_isConnected())
            {
                continue;
            }

            try
            {
                await _sendPing(cancellationToken).ConfigureAwait(false);
            }
            catch
            {
                // Best-effort: l'auto-reconnect est gérée plus haut (ViewModel).
            }
        }
    }
}
