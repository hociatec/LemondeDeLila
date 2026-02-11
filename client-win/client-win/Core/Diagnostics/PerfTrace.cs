using System;
using System.Diagnostics;
using Serilog;

namespace client_win.Core.Diagnostics;

public static class PerfTrace
{
    private static readonly bool EnabledFlag =
#if DEBUG
        true;
#else
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("LEMONDEDELILA_PERF_TRACE"));
#endif

    public static bool Enabled => EnabledFlag;

    public static long Start() => Stopwatch.GetTimestamp();

    public static void Mark(string name, long startTicks)
    {
        if (!Enabled)
        {
            return;
        }

        var now = Stopwatch.GetTimestamp();
        var ms = (now - startTicks) * 1000.0 / Stopwatch.Frequency;

#if DEBUG
        Log.Debug("[perf] {Name} +{Ms:0.0}ms", name, ms);
#else
        // In production, perf traces are opt-in via env var, but the default log level is typically Information.
        // Emit at Information so the trace is actually captured without requiring debug logs.
        Log.Information("[perf] {Name} +{Ms:0.0}ms", name, ms);
#endif
    }

    public static IDisposable Measure(string name)
    {
        if (!Enabled)
        {
            return NoopDisposable.Instance;
        }

        return new MeasureScope(name);
    }

    private sealed class MeasureScope : IDisposable
    {
        private readonly string _name;
        private readonly long _start;

        public MeasureScope(string name)
        {
            _name = name;
            _start = Stopwatch.GetTimestamp();

#if DEBUG
            Log.Debug("[perf] {Name} start", _name);
#else
            Log.Information("[perf] {Name} start", _name);
#endif
        }

        public void Dispose()
        {
            var end = Stopwatch.GetTimestamp();
            var ms = (end - _start) * 1000.0 / Stopwatch.Frequency;

#if DEBUG
            Log.Debug("[perf] {Name} end +{Ms:0.0}ms", _name, ms);
#else
            Log.Information("[perf] {Name} end +{Ms:0.0}ms", _name, ms);
#endif
        }
    }

    private sealed class NoopDisposable : IDisposable
    {
        public static readonly NoopDisposable Instance = new();
        public void Dispose() { }
    }
}

