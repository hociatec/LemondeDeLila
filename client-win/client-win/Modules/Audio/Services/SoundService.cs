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
    private readonly Dictionary<SoundId, int> _playGeneration = new();
    private readonly HashSet<SoundId> _opened = new();
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
                // Son court et distinct pour rendre la connexion perceptible.
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: () => _options.Current.SoundClientConnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.ClientDisconnected] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundClientDisconnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundNavigate,
                Volume: () => Clamp01(_options.Current.SoundNavigateVolume / 100.0)),
            [SoundId.MainMenuMusic] = new SoundEntry(
                // PLACEHOLDER: Ce fichier par défaut n'est pas approprié pour une musique de fond.
                // L'administrateur doit uploader une vraie musique de menu via l'interface admin.
                // Le son uploadé sera automatiquement utilisé via RemoteSoundCache.
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: null,
                IsEnabled: () => !_options.Current.MuteAll,
                Volume: () => 0.25),
            [SoundId.TavernAmbience] = new SoundEntry(
                // PLACEHOLDER: Ce fichier par défaut n'est pas approprié pour une ambiance de taverne.
                // L'administrateur doit uploader une vraie ambiance via l'interface admin.
                // Le son uploadé sera automatiquement utilisé via RemoteSoundCache.
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
            [SoundId.FriendConnected] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "invitationrecu.mp3"),
                OverridePath: () => _options.Current.SoundFriendConnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
            [SoundId.FriendDisconnected] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundFriendDisconnectedPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundSelect,
                Volume: () => Clamp01(_options.Current.SoundSelectVolume / 100.0)),
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
            [SoundId.GameVictory] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomopened.mp3"),
                OverridePath: () => _options.Current.SoundGameVictoryPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.GameDefeat] = new SoundEntry(
                DefaultRelativePath: Path.Combine("Assets", "Sounds", "roomexit.mp3"),
                OverridePath: () => _options.Current.SoundGameDefeatPath,
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
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
                        EnsurePlayerLoaded(sound, filePath, canInterruptPlayback: false);
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

    public void Preload(SoundId sound, bool warmUp = false)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Sound file missing: {Path}", filePath);
            return;
        }

        void PreloadOnUiThread()
        {
            try
            {
                MediaPlayer player;
                int generationSnapshot;
                lock (_gate)
                {
                    EnsurePlayerLoaded(sound, filePath, canInterruptPlayback: false);
                    player = _players[sound];
                    _playGeneration.TryGetValue(sound, out generationSnapshot);
                }

                if (!warmUp)
                {
                    return;
                }

                // Warm-up best-effort: encourage Media Foundation to decode/buffer before the first real playback.
                void WarmUp(int expectedGeneration)
                {
                    bool IsStillCurrent()
                    {
                        lock (_gate)
                        {
                            return _playGeneration.TryGetValue(sound, out var current) ? current == expectedGeneration : expectedGeneration == 0;
                        }
                    }

                    if (!IsStillCurrent())
                    {
                        return;
                    }

                    var previousVolume = player.Volume;
                    var previousMuted = player.IsMuted;
                    try
                    {
                        if (!IsStillCurrent())
                        {
                            return;
                        }

                        // Utiliser IsMuted plutôt que Volume=0 pour éviter un "blip" audible selon le timing du moteur audio.
                        player.IsMuted = true;
                        player.Volume = 0;
                        player.Stop();
                        player.Position = TimeSpan.Zero;
                        player.Play();
                        if (IsStillCurrent())
                        {
                            player.Pause();
                            player.Position = TimeSpan.Zero;
                        }
                    }
                    catch
                    {
                        // ignore (best-effort)
                    }
                    finally
                    {
                        // Ne pas écraser une lecture réelle qui aurait démarré pendant le warm-up.
                        if (IsStillCurrent())
                        {
                            try { player.Volume = previousVolume; } catch { /* ignore */ }
                            try { player.IsMuted = previousMuted; } catch { /* ignore */ }
                        }
                    }
                }

                bool alreadyOpened;
                lock (_gate)
                {
                    alreadyOpened = _opened.Contains(sound);
                }

                if (alreadyOpened)
                {
                    WarmUp(generationSnapshot);
                    return;
                }

                EventHandler? opened = null;
                opened = (_, _) =>
                {
                    try { player.MediaOpened -= opened; } catch { /* ignore */ }
                    WarmUp(generationSnapshot);
                };
                player.MediaOpened += opened;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Sound preload error ({Sound})", sound);
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
            // Au démarrage, il peut arriver que ClientOpened (son d'ouverture) et ClientConnected (connexion rapide/auto-login)
            // soient joués à quelques centaines de ms d'intervalle, ce qui donne une impression de "double lancement".
            // Dans ce cas, on supprime le son "connexion" si on vient de jouer "ouverture".
            if (sound == SoundId.ClientConnected &&
                _lastPlayTicks.TryGetValue(SoundId.ClientOpened, out var lastOpened) &&
                now - lastOpened < Stopwatch.Frequency * 2)
            {
                return;
            }

            if (_lastPlayTicks.TryGetValue(sound, out var last) && now - last < MinIntervalTicks)
            {
                return;
            }
            _lastPlayTicks[sound] = now;
            _playGeneration[sound] = _playGeneration.TryGetValue(sound, out var current) ? current + 1 : 1;
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
                    EnsurePlayerLoaded(sound, filePath, canInterruptPlayback: true);
                    player = _players[sound];

                    tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                    _playEndSignals[sound] = tcs;
                }

                void StartPlayback()
                {
                    player.IsMuted = false;
                    player.Volume = entry.Volume();
                    player.Stop();
                    player.Position = TimeSpan.Zero;
                    player.Play();
                }

                // MediaPlayer.Open est async; si le média n'est pas encore ouvert,
                // démarrer uniquement lorsque MediaOpened arrive (sinon risque de double-play au moment de l'ouverture).
                bool alreadyOpened;
                lock (_gate)
                {
                    alreadyOpened = _opened.Contains(sound);
                }
                if (alreadyOpened)
                {
                    try { StartPlayback(); } catch { /* ignore */ }
                }
                else
                {
                    EventHandler? opened = null;
                    opened = (_, _) =>
                    {
                        try { player.MediaOpened -= opened; } catch { /* ignore */ }
                        try { StartPlayback(); } catch { /* ignore */ }
                    };
                    player.MediaOpened += opened;
                }

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
            _ = _dispatcher.BeginInvoke((Action)PlayOnUiThread, DispatcherPriority.Normal);
        }
    }

    public async Task WaitForSoundToEndAsync(SoundId sound, TimeSpan timeout)
    {
        if (timeout <= TimeSpan.Zero)
        {
            return;
        }

        // Le son peut démarrer légèrement après l'appel (ex: event WS Connected),
        // donc on attend un court délai qu'il "commence" avant de considérer qu'il n'y a rien à attendre.
        var sw = Stopwatch.StartNew();
        TaskCompletionSource<bool>? tcs;
        lock (_gate)
        {
            _playEndSignals.TryGetValue(sound, out tcs);
        }

        var startWaitMs = Math.Min(1500, (int)Math.Max(0, timeout.TotalMilliseconds));
        while (tcs == null && sw.ElapsedMilliseconds < startWaitMs)
        {
            try
            {
                await Task.Delay(50).ConfigureAwait(false);
            }
            catch
            {
                return;
            }

            lock (_gate)
            {
                _playEndSignals.TryGetValue(sound, out tcs);
            }
        }

        if (tcs == null)
        {
            return;
        }

        var remaining = timeout - sw.Elapsed;
        if (remaining <= TimeSpan.Zero)
        {
            return;
        }

        try
        {
            await Task.WhenAny(tcs.Task, Task.Delay(remaining)).ConfigureAwait(false);
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
                EnsurePlayerLoaded(sound, filePath, canInterruptPlayback: true);
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
            _playGeneration.Clear();
            _opened.Clear();
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

        if (_players.TryGetValue(sound, out var old))
        {
            try { old.Close(); } catch { /* ignore */ }
            _players.Remove(sound);
        }
        _loadedPaths.Remove(sound);
        _opened.Remove(sound);

        var player = new MediaPlayer();
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
            lock (_gate)
            {
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

    private static double Clamp01(double v)
    {
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }
}
