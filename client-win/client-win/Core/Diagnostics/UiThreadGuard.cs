using System;
using System.Linq;
using System.Windows;
using System.Windows.Threading;
using Serilog;

namespace client_win.Core.Diagnostics;

public static class UiThreadGuard
{
    private static readonly bool EnabledFlag =
#if DEBUG
        true;
#else
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("LEMONDEDELILA_UI_THREAD_GUARD"));
#endif

    public static bool Enabled => EnabledFlag;

    public static bool IsOnUiThread()
    {
        try
        {
            var dispatcher = Application.Current?.Dispatcher;
            return dispatcher != null && dispatcher.CheckAccess();
        }
        catch
        {
            return false;
        }
    }

    public static void WarnIfOnUiThread(string operation, string? detail = null)
    {
        if (!Enabled)
        {
            return;
        }

        if (!IsOnUiThread())
        {
            return;
        }

        try
        {
            var stack = Environment.StackTrace;
            // Keep logs readable: keep only first frames after this method.
            var lines = (stack ?? string.Empty)
                .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
                .Skip(2)
                .Take(18);
            var shortStack = string.Join("\n", lines);
            Log.Warning("[ui-thread] {Operation} called on UI thread. {Detail}\n{Stack}", operation, detail ?? string.Empty, shortStack);
        }
        catch
        {
            // best-effort
        }
    }

    public static IDisposable MeasureUiThreadContinuation(string operation, string? detail = null)
    {
        if (!Enabled)
        {
            return NoopDisposable.Instance;
        }

        return new MeasureScope(operation, detail);
    }

    private sealed class MeasureScope : IDisposable
    {
        private readonly string _operation;
        private readonly string? _detail;
        private readonly long _startTicks;

        public MeasureScope(string operation, string? detail)
        {
            _operation = operation;
            _detail = detail;
            _startTicks = PerfTrace.Start();
        }

        public void Dispose()
        {
            try
            {
                if (IsOnUiThread())
                {
                    PerfTrace.Mark($"ui.continuation {_operation} {_detail ?? string.Empty}".Trim(), _startTicks);
                }
            }
            catch
            {
                // ignore
            }
        }
    }

    private sealed class NoopDisposable : IDisposable
    {
        public static readonly NoopDisposable Instance = new();
        public void Dispose() { }
    }
}

