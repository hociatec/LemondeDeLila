using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Windows.Threading;
using System.Windows.Media;
using client_win.Modules.Audio.Models;
using client_win.Modules.Settings.Services;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Audio.Services;

public sealed class SoundService : ISoundService, IDisposable
{
    private sealed record SoundEntry(string RelativePath, Func<bool> IsEnabled, Func<double> Volume);

    private readonly IOptionsService _options;
    private readonly Dispatcher _dispatcher;
    private readonly ILogger<SoundService> _logger;
    private readonly object _gate = new();
    private readonly Dictionary<SoundId, MediaPlayer> _players = new();
    private readonly Dictionary<SoundId, long> _lastPlayTicks = new();
    private readonly Dictionary<SoundId, SoundEntry> _sounds;

    // Avoid audio spam when a burst of messages happens (e.g. history replay, reconnect).
    private static readonly long MinIntervalTicks = Stopwatch.Frequency / 12; // ~83ms

    public SoundService(IOptionsService options, Dispatcher dispatcher, ILogger<SoundService> logger)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        _sounds = new Dictionary<SoundId, SoundEntry>
        {
            [SoundId.ChatMessageSent] = new SoundEntry(
                RelativePath: Path.Combine("Assets", "Sounds", "envoimsgtchat.mp3"),
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
            [SoundId.ChatMessageReceived] = new SoundEntry(
                RelativePath: Path.Combine("Assets", "Sounds", "receptionmsgtchat.mp3"),
                IsEnabled: () => !_options.Current.MuteAll && _options.Current.SoundChatMessages,
                Volume: () => Clamp01(_options.Current.SoundChatMessagesVolume / 100.0)),
        };
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

        var filePath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, entry.RelativePath));
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
                lock (_gate)
                {
                    if (!_players.TryGetValue(sound, out player!))
                    {
                        player = new MediaPlayer();
                        player.MediaFailed += (_, args) =>
                        {
                            _logger.LogWarning(
                                "Sound playback failed ({Sound}): {Error}",
                                sound,
                                args.ErrorException?.Message ?? "unknown error");
                            lock (_gate)
                            {
                                if (_players.TryGetValue(sound, out var existing) && ReferenceEquals(existing, player))
                                {
                                    _players.Remove(sound);
                                }
                            }
                            try { player.Close(); } catch { /* ignore */ }
                        };
                        player.Open(new Uri(filePath, UriKind.Absolute));
                        _players[sound] = player;
                    }
                }

                player.Volume = entry.Volume();
                player.Stop();
                player.Position = TimeSpan.Zero;
                player.Play();
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Sound playback error ({Sound})", sound);
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

    public void Dispose()
    {
        lock (_gate)
        {
            foreach (var p in _players.Values)
            {
                try { p.Close(); } catch { /* ignore */ }
            }
            _players.Clear();
            _lastPlayTicks.Clear();
        }
    }

    private static double Clamp01(double v)
    {
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }
}
