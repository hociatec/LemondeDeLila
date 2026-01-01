using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Threading;
using System.Windows.Media;
using client_win.Modules.Audio.Models;
using client_win.Modules.Settings.Services;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Audio.Services;

public sealed class SoundService : ISoundService, IDisposable
{
    private sealed record SoundEntry(
        string DefaultRelativePath,
        Func<string?>? OverridePath,
        Func<bool> IsEnabled,
        Func<double> Volume);

    private readonly IOptionsService _options;
    private readonly IRemoteSoundCache? _remote;
    private readonly Dispatcher _dispatcher;
    private readonly ILogger<SoundService> _logger;
    private readonly object _gate = new();
    private readonly Dictionary<SoundId, MediaPlayer> _players = new();
    private readonly Dictionary<SoundId, string> _loadedPaths = new();
    private readonly Dictionary<SoundId, long> _lastPlayTicks = new();
    private readonly Dictionary<SoundId, SoundEntry> _sounds;
    private readonly HashSet<SoundId> _looping = new();
    private readonly Dictionary<SoundId, MediaPlayer> _loopPlayers = new();
    private readonly Dictionary<SoundId, EventHandler> _loopHandlers = new();
    private readonly Dictionary<SoundId, TaskCompletionSource<bool>> _playEndSignals = new();

    // Avoid audio spam when a burst of messages happens (e.g. history replay, reconnect).
    private static readonly long MinIntervalTicks = Stopwatch.Frequency / 12; // ~83ms

    public SoundService(IOptionsService options, IRemoteSoundCache? remote, Dispatcher dispatcher, ILogger<SoundService> logger)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _remote = remote;
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        _sounds = new Dictionary<SoundId, SoundEntry>
        {
            [SoundId.ClientOpened] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: () => _options.Current.SoundClientOpenedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundAppLaunch,
                Volume: () => Clamp01(_options.Current.SoundAppLaunchVolume / 100.0)),
            [SoundId.ClientConnected] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomjoined.mp3"),
                OverridePath: () => _options.Current.SoundClientConnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.ClientDisconnected] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundClientDisconnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.MainMenuMusic] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll,
                Volume: () => 0.25),
            [SoundId.TavernAmbience] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll,
                Volume: () => 0.20),
            [SoundId.ChatMessageSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "envoimsgtchat.mp3"),
                OverridePath: () => _options.Current.SoundChatMessageSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.ChatMessageReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "receptionmsgtchat.mp3"),
                OverridePath: () => _options.Current.SoundChatMessageReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.PrivateMessageSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "msgprivateenvoi.mp3"),
                OverridePath: () => _options.Current.SoundPrivateMessageSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.PrivateMessageReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "msgprivatereceve.mp3"),
                OverridePath: () => _options.Current.SoundPrivateMessageReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.FriendInvitationSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationenvoyer.mp3"),
                OverridePath: () => _options.Current.SoundFriendInvitationSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.FriendInvitationReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: () => _options.Current.SoundFriendInvitationReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.InvitationSent] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationenvoyer.mp3"),
                OverridePath: () => _options.Current.SoundInvitationSentPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.InvitationReceived] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: () => _options.Current.SoundInvitationReceivedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.RoomOpened] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: () => _options.Current.SoundRoomOpenedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.RoomJoined] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: () => _options.Current.SoundRoomJoinedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.RoomExit] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundRoomExitPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
        };
    }

    public void PreloadAll()
    {
        void PreloadOnUiThread()
        {
            foreach (var (sound, entry) in _sounds)
            {
                var filePath = ResolveFilePath(sound, entry);
                if (!File.Exists(filePath))
                {
                    _logger.LogDebug("Sound file missing: {Path}", filePath);
                    continue;
                }

                try
                {
                    lock (_gate)
                    {
                        EnsurePlayerLoaded(sound, filePath);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Sound preload error ({Sound})", sound);
                }
            }
        }

        if (_dispatcher.CheckAccess())
        {
            PreloadOnUiThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)PreloadOnUiThread, DispatcherPriority.Background);
        }
    }

    public void Play(SoundId sound)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }
        if (!entry.IsEnabled())
        {
            return;
        }

        long now = Stopwatch.GetTimestamp();
        lock (_gate)
        {
            if (_lastPlayTicks.TryGetValue(sound, out var last) && now - last < MinIntervalTicks)
            {
                return;
            }
            _lastPlayTicks[sound] = now;
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Sound file missing: {Path}", filePath);
            return;
        }

        void PlayOnUiThread()
        {
            try
            {
                MediaPlayer player;
                TaskCompletionSource<bool> tcs;
                lock (_gate)
                {
                    EnsurePlayerLoaded(sound, filePath);
                    player = _players[sound];

                    tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                    _playEndSignals[sound] = tcs;
                }

                player.Volume = entry.Volume();
                player.Stop();
                player.Position = TimeSpan.Zero;
                player.Play();

                // Signal end for waiters (best-effort).
                EventHandler? ended = null;
                ended = (_, _) =>
                {
                    try { player.MediaEnded -= ended; } catch { /* ignore */ }
                    lock (_gate)
                    {
                        if (_playEndSignals.TryGetValue(sound, out var current) && ReferenceEquals(current, tcs))
                        {
                            _playEndSignals.Remove(sound);
                        }
                    }
                    tcs.TrySetResult(true);
                };
                player.MediaEnded += ended;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Sound playback error ({Sound})", sound);
                lock (_gate)
                {
                    if (_playEndSignals.TryGetValue(sound, out var tcs))
                    {
                        _playEndSignals.Remove(sound);
                        tcs.TrySetResult(true);
                    }
                }
            }
        }

        if (_dispatcher.CheckAccess())
        {
            PlayOnUiThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)PlayOnUiThread, DispatcherPriority.Background);
        }
    }

    public async Task WaitForSoundToEndAsync(SoundId sound, TimeSpan timeout)
    {
        TaskCompletionSource<bool>? tcs = null;
        lock (_gate)
        {
            _playEndSignals.TryGetValue(sound, out tcs);
        }

        if (tcs == null)
        {
            return;
        }

        try
        {
            await Task.WhenAny(tcs.Task, Task.Delay(timeout)).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    public void StartLoop(SoundId sound)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }
        if (!entry.IsEnabled())
        {
            StopLoop(sound);
            return;
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Loop sound file missing: {Path}", filePath);
            return;
        }

        void StartOnUiThread()
        {
            MediaPlayer player;
            EventHandler handler;

            lock (_gate)
            {
                EnsurePlayerLoaded(sound, filePath);
                player = _players[sound];

                if (_loopPlayers.TryGetValue(sound, out var previousPlayer) && !ReferenceEquals(previousPlayer, player))
                {
                    if (_loopHandlers.TryGetValue(sound, out var previousHandler))
                    {
                        try { previousPlayer.MediaEnded -= previousHandler; } catch { /* ignore */ }
                    }
                    _loopPlayers.Remove(sound);
                    _loopHandlers.Remove(sound);
                    _looping.Remove(sound);
                }

                if (_looping.Contains(sound))
                {
                    try
                    {
                        player.Volume = entry.Volume();
                        player.Play();
                    }
                    catch
                    {
                        // ignore
                    }
                    return;
                }

                handler = (_, _) =>
                {
                    lock (_gate)
                    {
                        if (!_looping.Contains(sound))
                        {
                            return;
                        }
                    }

                    try
                    {
                        player.Position = TimeSpan.Zero;
                        player.Play();
                    }
                    catch
                    {
                        // ignore
                    }
                };

                _looping.Add(sound);
                _loopPlayers[sound] = player;
                _loopHandlers[sound] = handler;
                player.MediaEnded += handler;
            }

            try
            {
                player.Volume = entry.Volume();
                player.Stop();
                player.Position = TimeSpan.Zero;
                player.Play();
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Loop sound start failed ({Sound})", sound);
            }
        }

        if (_dispatcher.CheckAccess())
        {
            StartOnUiThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)StartOnUiThread, DispatcherPriority.Background);
        }
    }

    public void StopLoop(SoundId sound)
    {
        void StopOnUiThread()
        {
            MediaPlayer? player = null;
            EventHandler? handler = null;

            lock (_gate)
            {
                _looping.Remove(sound);

                if (_loopPlayers.TryGetValue(sound, out var p))
                {
                    player = p;
                    _loopPlayers.Remove(sound);
                }

                if (_loopHandlers.TryGetValue(sound, out var h))
                {
                    handler = h;
                    _loopHandlers.Remove(sound);
                }
            }

            if (player != null && handler != null)
            {
                try { player.MediaEnded -= handler; } catch { /* ignore */ }
            }

            if (player != null)
            {
                try { player.Stop(); } catch { /* ignore */ }
            }

            lock (_gate)
            {
                if (_playEndSignals.TryGetValue(sound, out var tcs))
                {
                    _playEndSignals.Remove(sound);
                    tcs.TrySetResult(true);
                }
            }
        }

        if (_dispatcher.CheckAccess())
        {
            StopOnUiThread();
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)StopOnUiThread, DispatcherPriority.Background);
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            _looping.Clear();
            _loopPlayers.Clear();
            _loopHandlers.Clear();
            foreach (var tcs in _playEndSignals.Values)
            {
                tcs.TrySetResult(true);
            }
            _playEndSignals.Clear();
            foreach (var p in _players.Values)
            {
                try { p.Close(); } catch { /* ignore */ }
            }
            _players.Clear();
            _loadedPaths.Clear();
            _lastPlayTicks.Clear();
        }
    }

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

        return ResolveFilePath(entry);
    }

    private void EnsurePlayerLoaded(SoundId sound, string absolutePath)
    {
        if (_players.TryGetValue(sound, out var existing) &&
            _loadedPaths.TryGetValue(sound, out var loaded) &&
            string.Equals(loaded, absolutePath, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (_players.TryGetValue(sound, out var old))
        {
            try { old.Close(); } catch { /* ignore */ }
            _players.Remove(sound);
        }
        _loadedPaths.Remove(sound);

        var player = new MediaPlayer();
        player.MediaFailed += (_, args) =>
        {
            _logger.LogWarning(
                "Sound playback failed ({Sound}): {Error}",
                sound,
                args.ErrorException?.Message ?? "unknown error");
            lock (_gate)
            {
                if (_players.TryGetValue(sound, out var current) && ReferenceEquals(current, player))
                {
                    _players.Remove(sound);
                    _loadedPaths.Remove(sound);
                }
            }
            try { player.Close(); } catch { /* ignore */ }
        };
        player.Open(new Uri(absolutePath, UriKind.Absolute));
        _players[sound] = player;
        _loadedPaths[sound] = absolutePath;
    }

    private static double Clamp01(double v)
    {
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }
}
