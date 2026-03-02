using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using client_win.Modules.Game.Common;

namespace client_win.Modules.Game.Room.Services;

public sealed partial class RoomSession
{
    private sealed class RoomAckTracker
    {
        private readonly object _ackGate = new();
        private readonly Dictionary<string, DateTime> _recentAcks = new(StringComparer.Ordinal);
        private readonly object _ackLatencyGate = new();
        private double _ackLatencyEwmaMs = 120;
        private const double AckLatencyAlpha = 0.25;

        public bool TryConsume(string action, string traceId)
        {
            if (string.IsNullOrWhiteSpace(action) || string.IsNullOrWhiteSpace(traceId))
            {
                return false;
            }

            lock (_ackGate)
            {
                CleanupRecentAcksUnsafe();
                return _recentAcks.Remove(BuildAckKey(action, traceId));
            }
        }

        public void Remember(string action, string traceId)
        {
            if (string.IsNullOrWhiteSpace(action) || string.IsNullOrWhiteSpace(traceId))
            {
                return;
            }

            lock (_ackGate)
            {
                CleanupRecentAcksUnsafe();
                _recentAcks[BuildAckKey(action, traceId)] = DateTime.UtcNow;
            }
        }

        public void RecordLatency(long clientToServerMs)
        {
            if (clientToServerMs <= 0)
            {
                return;
            }

            var sampleMs = Math.Clamp((clientToServerMs * 2.0) + 40.0, 80.0, 1800.0);
            lock (_ackLatencyGate)
            {
                _ackLatencyEwmaMs = (_ackLatencyEwmaMs * (1.0 - AckLatencyAlpha)) + (sampleMs * AckLatencyAlpha);
            }
        }

        public TimeSpan ComputeAdaptiveTimeout()
        {
            lock (_ackLatencyGate)
            {
                var timeoutMs = Math.Clamp((_ackLatencyEwmaMs * 2.2) + 40.0, 120.0, 1200.0);
                return TimeSpan.FromMilliseconds(timeoutMs);
            }
        }

        private void CleanupRecentAcksUnsafe()
        {
            if (_recentAcks.Count == 0)
            {
                return;
            }

            var cutoff = DateTime.UtcNow - GameTiming.Room.RecentAckRetention;
            foreach (var key in _recentAcks
                         .Where(kv => kv.Value < cutoff)
                         .Select(kv => kv.Key)
                         .ToArray())
            {
                _recentAcks.Remove(key);
            }
        }

        private static string BuildAckKey(string action, string traceId)
        {
            return $"{action.Trim().ToLowerInvariant()}|{traceId.Trim().ToLowerInvariant()}";
        }
    }
}

