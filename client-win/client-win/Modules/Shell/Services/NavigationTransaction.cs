using System.Threading;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Process-wide navigation transaction flag for NVDA/WPF focus safety.
/// This is intentionally static so shell-wide focus guards can consult it without DI.
/// </summary>
internal static class NavigationTransaction
{
    private static int _nextToken;
    private static int _activeToken;

    public static bool IsActive => Volatile.Read(ref _activeToken) != 0;

    public static int Begin()
    {
        var token = Interlocked.Increment(ref _nextToken);
        Volatile.Write(ref _activeToken, token);
        return token;
    }

    public static void End(int token)
    {
        if (token == 0)
        {
            return;
        }

        if (Volatile.Read(ref _activeToken) == token)
        {
            Volatile.Write(ref _activeToken, 0);
        }
    }
}

