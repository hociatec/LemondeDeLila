using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Core.Constants;
using client_win.Modules.Audio.Models;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Audio.Services;

public sealed partial class SoundService
{
    private string ResolveFilePath(SoundEntry entry)
    {
        var overridePath = entry.OverridePath?.Invoke();
        if (!string.IsNullOrWhiteSpace(overridePath))
        {
            try
            {
                var candidate = Path.GetFullPath(overridePath);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch
            {
                // ignore
            }
        }

        return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, entry.DefaultRelativePath));
    }

    private string ResolveFilePath(SoundId sound, SoundEntry entry)
    {
        if (sound == SoundId.ClientConnected)
        {
            try
            {
                var overridePath = entry.OverridePath?.Invoke();
                if (!string.IsNullOrWhiteSpace(overridePath))
                {
                    var candidate = Path.GetFullPath(overridePath);
                    if (File.Exists(candidate))
                    {
                        return candidate;
                    }
                }
            }
            catch
            {
                // ignore
            }

            if (_preferLocalSystemSounds)
            {
                return ResolveFilePath(entry);
            }

            if (_remoteSoundsEnabled)
            {
                var remotePath = _remote?.TryGetPath(sound);
                if (!string.IsNullOrWhiteSpace(remotePath))
                {
                    try
                    {
                        var candidate = Path.GetFullPath(remotePath);
                        if (File.Exists(candidate))
                        {
                            return candidate;
                        }
                    }
                    catch
                    {
                        // ignore
                    }
                }
            }

            return ResolveFilePath(entry);
        }

        if (_preferLocalSystemSounds &&
            (sound == SoundId.ClientDisconnected || sound == SoundId.ClientClosing))
        {
            return ResolveFilePath(entry);
        }

        if (_remoteSoundsEnabled)
        {
            lock (_gate)
            {
                if (_remoteBroken.Contains(sound))
                {
                    return ResolveFilePath(entry);
                }
            }

            var remotePath = _remote?.TryGetPath(sound);
            if (!string.IsNullOrWhiteSpace(remotePath))
            {
                try
                {
                    var candidate = Path.GetFullPath(remotePath);
                    if (File.Exists(candidate))
                    {
                        return candidate;
                    }
                }
                catch
                {
                    // ignore
                }
            }
        }

        return ResolveFilePath(entry);
    }

    private void EnsurePlayerLoaded(SoundId sound, string absolutePath, bool canInterruptPlayback)
    {
        if (_players.TryGetValue(sound, out var existing) &&
            _loadedPaths.TryGetValue(sound, out var loaded) &&
            string.Equals(loaded, absolutePath, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (!canInterruptPlayback && _playEndSignals.ContainsKey(sound))
        {
            return;
        }

        if (!canInterruptPlayback && _looping.Contains(sound))
        {
            return;
        }

        if (_players.TryGetValue(sound, out var old))
        {
            try { old.Stop(); } catch { /* ignore */ }

            if (_loopPlayers.TryGetValue(sound, out var loopPlayer) && ReferenceEquals(loopPlayer, old))
            {
                if (_loopHandlers.TryGetValue(sound, out var loopHandler))
                {
                    try { old.MediaEnded -= loopHandler; } catch { /* ignore */ }
                }
                _loopPlayers.Remove(sound);
                _loopHandlers.Remove(sound);
                _looping.Remove(sound);
            }

            try { old.Close(); } catch { /* ignore */ }
            _players.Remove(sound);
        }
        _loadedPaths.Remove(sound);
        _opened.Remove(sound);

        var player = new MediaPlayer();
        player.IsMuted = true;
        player.Volume = 0;
        player.MediaOpened += (_, _) =>
        {
            lock (_gate)
            {
                if (_players.TryGetValue(sound, out var current) && ReferenceEquals(current, player))
                {
                    _opened.Add(sound);
                }
            }
        };
        player.MediaFailed += (_, args) =>
        {
            _logger.LogWarning(
                "Sound playback failed ({Sound}): {Error}",
                sound,
                args.ErrorException?.Message ?? "unknown error");
            CompleteWarmUp(sound);

            try
            {
                string? loadedPath = null;
                SoundEntry? entry = null;
                lock (_gate)
                {
                    _loadedPaths.TryGetValue(sound, out loadedPath);
                    _sounds.TryGetValue(sound, out entry);
                }

                if (!string.IsNullOrWhiteSpace(loadedPath) &&
                    IsFromSoundsCache(loadedPath) &&
                    entry != null)
                {
                    var localPath = ResolveFilePath(entry);
                    if (!string.IsNullOrWhiteSpace(localPath) &&
                        !string.Equals(localPath, loadedPath, StringComparison.OrdinalIgnoreCase) &&
                        File.Exists(localPath))
                    {
                        var shouldFallback = false;
                        lock (_gate)
                        {
                            if (!_remoteBroken.Contains(sound))
                            {
                                _remoteBroken.Add(sound);
                                shouldFallback = true;
                            }
                        }

                        if (shouldFallback)
                        {
                            _logger.LogWarning(
                                "Audio: remote sound marked broken -> fallback to local for {Sound} (remote={RemoteFile} local={LocalFile})",
                                sound,
                                Path.GetFileName(loadedPath),
                                Path.GetFileName(localPath));

                            if (_looping.Contains(sound))
                            {
                                try { StopLoop(sound); } catch { /* ignore */ }
                                try { StartLoop(sound); } catch { /* ignore */ }
                            }
                            else
                            {
                                EnqueuePlayback(new PlayRequest(sound, entry, localPath));
                            }
                        }
                    }
                }
            }
            catch
            {
                // best-effort
            }

            lock (_gate)
            {
                if (sound == SoundId.ClientOpened)
                {
                    OpenStartupGate("ClientOpened media failed");
                }
                else if (sound == SoundId.ClientConnected && Volatile.Read(ref _startupGateOpened) == 0)
                {
                    OpenStartupGate("ClientConnected media failed");
                }
                if (_playEndSignals.TryGetValue(sound, out var tcs))
                {
                    _playEndSignals.Remove(sound);
                    tcs.TrySetResult(true);
                }
                if (_players.TryGetValue(sound, out var current) && ReferenceEquals(current, player))
                {
                    _players.Remove(sound);
                    _loadedPaths.Remove(sound);
                    _opened.Remove(sound);
                }
            }
            try { player.Close(); } catch { /* ignore */ }
        };
        player.Open(new Uri(absolutePath, UriKind.Absolute));
        _players[sound] = player;
        _loadedPaths[sound] = absolutePath;
    }

    private void OnOptionsChanged(object? sender, EventArgs e)
    {
        _dispatcher.BeginInvoke((Action)SyncOptions, DispatcherPriority.Normal);
    }

    private static double Clamp01(double v)
    {
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }

    private static string GetSoundsCacheDir() =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "sounds-cache");

    private static bool IsFromSoundsCache(string filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath))
        {
            return false;
        }

        try
        {
            var cacheDir = GetSoundsCacheDir();
            if (string.IsNullOrWhiteSpace(cacheDir))
            {
                return false;
            }

            var normalizedCache = Path.GetFullPath(cacheDir)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) +
                Path.DirectorySeparatorChar;
            var normalizedFile = Path.GetFullPath(filePath);
            return normalizedFile.StartsWith(normalizedCache, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private string DescribeSoundSource(SoundId sound, SoundEntry entry, string filePath)
    {
        try
        {
            var overridePath = entry.OverridePath?.Invoke();
            if (!string.IsNullOrWhiteSpace(overridePath))
            {
                var fullOverride = Path.GetFullPath(overridePath);
                if (string.Equals(Path.GetFullPath(filePath), fullOverride, StringComparison.OrdinalIgnoreCase))
                {
                    return "override";
                }
            }
        }
        catch
        {
            // ignore
        }

        try
        {
            if (_remoteSoundsEnabled && IsFromSoundsCache(filePath))
            {
                return "remote-cache";
            }
        }
        catch
        {
            // ignore
        }

        return "local";
    }

    private void RecordDurationIfKnown(SoundId sound, MediaPlayer player)
    {
        try
        {
            if (!player.NaturalDuration.HasTimeSpan)
            {
                return;
            }

            var duration = player.NaturalDuration.TimeSpan;
            if (duration <= TimeSpan.Zero)
            {
                return;
            }

            lock (_gate)
            {
                _soundDurations[sound] = duration;
            }
        }
        catch
        {
            // ignore
        }
    }

    private TaskCompletionSource<bool> RegisterWarmUpSignal(SoundId sound)
    {
        lock (_warmUpGate)
        {
            if (_warmUpSignals.TryGetValue(sound, out var existing))
            {
                return existing;
            }
            var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            _warmUpSignals[sound] = tcs;
            return tcs;
        }
    }

    private TaskCompletionSource<bool>? TakeWarmUpSignal(SoundId sound)
    {
        lock (_warmUpGate)
        {
            if (_warmUpSignals.TryGetValue(sound, out var existing))
            {
                _warmUpSignals.Remove(sound);
                return existing;
            }
        }
        return null;
    }

    private void CompleteWarmUp(SoundId sound)
    {
        var tcs = TakeWarmUpSignal(sound);
        if (tcs != null)
        {
            tcs.TrySetResult(true);
        }
    }

    private void CancelWarmUp(SoundId sound)
    {
        var tcs = TakeWarmUpSignal(sound);
        if (tcs != null)
        {
            tcs.TrySetCanceled();
        }
    }

}
