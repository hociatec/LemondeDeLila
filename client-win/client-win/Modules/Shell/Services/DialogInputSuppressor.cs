using System;
using System.Diagnostics;
using System.Threading;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Empêche les fuites clavier (Entrée/Échap) juste après la fermeture d'un dialogue modal.
/// </summary>
public static class DialogInputSuppressor
{
    private static long _suppressUntilTicks;

    public static void Arm(TimeSpan duration)
    {
        var now = Stopwatch.GetTimestamp();
        var extraTicks = (long)(duration.TotalSeconds * Stopwatch.Frequency);
        var until = now + Math.Max(0, extraTicks);
        Interlocked.Exchange(ref _suppressUntilTicks, until);
    }

    public static bool IsArmed
    {
        get
        {
            var until = Volatile.Read(ref _suppressUntilTicks);
            if (until <= 0)
            {
                return false;
            }

            var now = Stopwatch.GetTimestamp();
            return now <= until;
        }
    }
}

