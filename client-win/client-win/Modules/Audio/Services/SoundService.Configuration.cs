using System;

namespace client_win.Modules.Audio.Services;

public sealed partial class SoundService
{
    private static bool IsEnabledFlag(string variableName) =>
        string.Equals(Environment.GetEnvironmentVariable(variableName), "1", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(Environment.GetEnvironmentVariable(variableName), "true", StringComparison.OrdinalIgnoreCase);

    private static bool IsDisabledFlag(string variableName) =>
        string.Equals(Environment.GetEnvironmentVariable(variableName), "0", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(Environment.GetEnvironmentVariable(variableName), "false", StringComparison.OrdinalIgnoreCase);

    private static bool ShouldUseRemoteSounds() => !IsEnabledFlag("LMDL_DISABLE_REMOTE_SOUNDS");

    private static bool ShouldRequireRemoteSounds(bool remoteSoundsEnabled) =>
        remoteSoundsEnabled && !IsEnabledFlag("LMDL_ALLOW_LOCAL_SOUNDS");

    private static bool ShouldPreferLocalSystemSounds()
    {
        var allowRemoteSystemSounds = !IsDisabledFlag("LMDL_ALLOW_REMOTE_SYSTEM_SOUNDS");
        return IsEnabledFlag("LMDL_PREFER_LOCAL_SYSTEM_SOUNDS") || !allowRemoteSystemSounds;
    }

    private static bool IsStartupTraceEnabled() => IsEnabledFlag("LMDL_AUDIO_STARTUP_TRACE");
}
