using System;

namespace client_win.Modules.Network.Services;

public static class ServerClock
{
    private static readonly object _gate = new();
    private static long _offsetMs;
    private static bool _hasOffset;

    public static long UtcNowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public static long NowServerMs()
    {
        var now = UtcNowMs();
        lock (_gate)
        {
            return _hasOffset ? now + _offsetMs : now;
        }
    }

    public static void UpdateFromPong(long serverTimeMs, long clientSentAtMs, long clientReceivedAtMs)
    {
        if (clientSentAtMs <= 0 || clientReceivedAtMs <= 0 || serverTimeMs <= 0)
        {
            return;
        }

        var midpoint = (clientSentAtMs + clientReceivedAtMs) / 2;
        var estimate = serverTimeMs - midpoint;

        lock (_gate)
        {
            if (!_hasOffset)
            {
                _offsetMs = estimate;
                _hasOffset = true;
                return;
            }

            // Lissage léger pour éviter le jitter.
            _offsetMs = (long)Math.Round((_offsetMs * 0.8) + (estimate * 0.2));
        }
    }
}
