using System;

namespace client_win.Modules.Updates;

public static class ClientUpdateNotifySuppression
{
    private static readonly object Gate = new();
    private static DateTime _suppressUntilUtc = DateTime.MinValue;

    public static void SuppressFor(TimeSpan duration)
    {
        if (duration <= TimeSpan.Zero)
        {
            return;
        }

        var until = DateTime.UtcNow + duration;
        lock (Gate)
        {
            if (until > _suppressUntilUtc)
            {
                _suppressUntilUtc = until;
            }
        }
    }

    public static bool IsActive()
    {
        lock (Gate)
        {
            return DateTime.UtcNow < _suppressUntilUtc;
        }
    }
}
