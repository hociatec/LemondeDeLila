using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using Microsoft.Extensions.Logging;
using client_win.Modules.Audio.Models;

namespace client_win.Modules.Audio.Services;

public sealed partial class SoundService
{
    private bool IsInStartupWindow(long nowTicks)
    {
        var sinceStart = nowTicks - _serviceStartTicks;
        return sinceStart >= 0 && sinceStart < Stopwatch.Frequency * 20;
    }

    private void TraceStartupOnce(string key, Func<string> messageFactory)
    {
        try
        {
            var now = Stopwatch.GetTimestamp();
            if (!IsInStartupWindow(now))
            {
                return;
            }

            lock (_gate)
            {
                if (_startupTraceOnce.Contains(key))
                {
                    if (now - _startupTraceLastLogTicks < Stopwatch.Frequency * 2)
                    {
                        return;
                    }
                }

                _startupTraceOnce.Add(key);
                _startupTraceLastLogTicks = now;
            }

            var msg = messageFactory();
            _logger.LogWarning(
                "Audio startup trace: pid={Pid} {Message}",
                Environment.ProcessId,
                msg);
            if (_startupTraceEnabled)
            {
                _logger.LogWarning(
                    "Audio startup trace stack:\n{Stack}",
                    Environment.StackTrace);
            }
        }
        catch
        {
            // ignore
        }
    }

    private void OpenStartupGate(string reason)
    {
        if (Interlocked.Exchange(ref _startupGateOpened, 1) == 1)
        {
            return;
        }

        TraceStartupOnce(
            "startup.gate.open",
            () => $"startup gate opened ({reason})");
    }

    private void TraceStartupPlayRequest(
        SoundId sound,
        string filePath,
        string reason)
    {
        TraceStartupOnce(
            $"startup.play.request.{sound}",
            () =>
                $"request play {sound} ({reason}) gate(startup={Volatile.Read(ref _startupGateOpened)} connected={Volatile.Read(ref _connectedGate)}) file={Path.GetFileName(filePath)}");
    }

    private void TraceStartupPlayStart(SoundId sound, string filePath)
    {
        TraceStartupOnce(
            $"startup.play.start.{sound}",
            () =>
                $"start playback {sound} gate(startup={Volatile.Read(ref _startupGateOpened)} connected={Volatile.Read(ref _connectedGate)}) file={Path.GetFileName(filePath)}");
    }
}
