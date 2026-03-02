using System;

namespace client_win.Modules.Game.Common;

internal static class GameTiming
{
    internal static class Room
    {
        internal static readonly TimeSpan GatewayConnectTimeout = TimeSpan.FromSeconds(45);
        internal static readonly TimeSpan GatewayRetryDelay = TimeSpan.FromMilliseconds(350);
        internal static readonly TimeSpan ClockSyncTimeout = TimeSpan.FromMilliseconds(1200);
        internal static readonly TimeSpan LeaveTimeout = TimeSpan.FromSeconds(2);
        internal static readonly TimeSpan StateRefreshThrottle = TimeSpan.FromSeconds(1);
        internal static readonly TimeSpan ReconnectAttemptTimeout = TimeSpan.FromSeconds(12);
        internal static readonly TimeSpan EnsureJoinedTimeout = TimeSpan.FromSeconds(10);
        internal static readonly TimeSpan KeepAliveTick = TimeSpan.FromSeconds(20);
        internal static readonly TimeSpan GhostConnectionThreshold = TimeSpan.FromSeconds(60);
        internal static readonly TimeSpan RecentAckRetention = TimeSpan.FromSeconds(30);
    }

    internal static class Game
    {
        internal static readonly TimeSpan KeepAliveDefaultTick = TimeSpan.FromSeconds(20);
        internal static readonly TimeSpan KeepAliveMinTick = TimeSpan.FromSeconds(5);
        internal static readonly TimeSpan ReconnectConnectTimeout = TimeSpan.FromSeconds(10);
        internal static readonly TimeSpan WatchdogTick = TimeSpan.FromSeconds(10);
        internal static readonly TimeSpan GhostConnectionThreshold = TimeSpan.FromSeconds(60);
        internal static readonly TimeSpan FreshStateTimeout = TimeSpan.FromSeconds(2);
    }

    internal static class Table
    {
        internal static readonly TimeSpan PresenceReplayDelay = TimeSpan.FromMilliseconds(500);
        internal static readonly TimeSpan OpenSoundDelay = TimeSpan.FromMilliseconds(50);
        internal static readonly TimeSpan RoomLobbyUnsubscribeTimeout = TimeSpan.FromSeconds(2);
        internal static readonly TimeSpan RoomLobbyRefreshDebounce = TimeSpan.FromMilliseconds(350);
        internal static readonly TimeSpan RulesConnectTimeout = TimeSpan.FromSeconds(8);
        internal static readonly TimeSpan RulesResponseTimeout = TimeSpan.FromSeconds(5);
        internal static readonly TimeSpan WizardPromptConnectTimeout = TimeSpan.FromSeconds(8);
        internal static readonly TimeSpan WizardPromptFetchTimeout = TimeSpan.FromSeconds(8);
        internal static readonly TimeSpan WizardPromptSoftWait = TimeSpan.FromMilliseconds(220);
        internal static readonly TimeSpan PostStartReplayConnectTimeout = TimeSpan.FromSeconds(4);
        internal static readonly TimeSpan PromptFastTimeout = TimeSpan.FromSeconds(2.2);
        internal static readonly TimeSpan PromptSlowTimeout = TimeSpan.FromSeconds(3);
        internal static readonly TimeSpan PromptMaxTimeout = TimeSpan.FromSeconds(4);
    }

    internal static class History
    {
        internal static readonly TimeSpan RecentDedupeWindow = TimeSpan.FromSeconds(10);
        internal static readonly TimeSpan TurnDedupeWindow = TimeSpan.FromSeconds(3);
        internal static readonly TimeSpan MessageDedupeWindow = TimeSpan.FromSeconds(2);
    }

    internal static class Focus
    {
        internal static readonly int[] CriticalRetryDelaysMs = { 90, 180, 320, 500, 750, 1050 };
    }

    internal static class Announcement
    {
        internal static readonly TimeSpan TurnAnnouncementDedupeWindow = TimeSpan.FromSeconds(1);
    }

    internal static class Audio
    {
        internal static readonly TimeSpan DrawSoundCooldown = TimeSpan.FromMilliseconds(350);
    }

    internal static TimeSpan ComputeJitterBackoff(int seconds, int minMs = 250)
    {
        var jitter = 0.8 + (Random.Shared.NextDouble() * 0.4);
        return TimeSpan.FromMilliseconds(Math.Max(minMs, seconds * 1000 * jitter));
    }
}
