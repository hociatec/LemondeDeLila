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
        Log.Debug("[perf] {Name} +{Ms:0.0}ms", name, ms);
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
            Log.Debug("[perf] {Name} start", _name);
        }

        public void Dispose()
        {
            var end = Stopwatch.GetTimestamp();
            var ms = (end - _start) * 1000.0 / Stopwatch.Frequency;
            Log.Debug("[perf] {Name} end +{Ms:0.0}ms", _name, ms);
        }
    }

    private sealed class NoopDisposable : IDisposable
    {
        public static readonly NoopDisposable Instance = new();
        public void Dispose() { }
    }
}

