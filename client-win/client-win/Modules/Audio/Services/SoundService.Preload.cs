using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using client_win.Modules.Audio.Models;

namespace client_win.Modules.Audio.Services;

public sealed partial class SoundService
{
    public Task WarmUpAsync(
        SoundId sound,
        CancellationToken cancellationToken = default)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return Task.CompletedTask;
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            return Task.CompletedTask;
        }

        var tcs = RegisterWarmUpSignal(sound);

        if (cancellationToken.CanBeCanceled)
        {
            var registration = cancellationToken.Register(() => CancelWarmUp(sound));
            _ = tcs.Task.ContinueWith(_ => registration.Dispose(), TaskScheduler.Default);
        }

        try
        {
            Preload(sound, warmUp: true);
        }
        catch
        {
            CompleteWarmUp(sound);
        }

        return tcs.Task;
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

        _ = _dispatcher.BeginInvoke((Action)PreloadOnUiThread, DispatcherPriority.Background);
    }

    public void Preload(SoundId sound, bool warmUp = false)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }

        var warmUpSignaled = false;
        void SignalWarmUpCompletion()
        {
            if (!warmUp || warmUpSignaled)
            {
                return;
            }
            warmUpSignaled = true;
            CompleteWarmUp(sound);
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Sound file missing: {Path}", filePath);
            SignalWarmUpCompletion();
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

                void DoWarmUp()
                {
                    try
                    {
                        var originalVolume = player.Volume;
                        var originalMute = player.IsMuted;
                        player.IsMuted = true;
                        player.Volume = 0;
                        player.Play();
                        player.Stop();
                        player.Position = TimeSpan.Zero;
                        player.IsMuted = originalMute;
                        player.Volume = originalVolume;
                    }
                    catch
                    {
                        // ignore
                    }
                    finally
                    {
                        SignalWarmUpCompletion();
                    }
                }

                if (_opened.Contains(sound))
                {
                    RecordDurationIfKnown(sound, player);
                    try
                    {
                        lock (_gate)
                        {
                            if (_playEndSignals.ContainsKey(sound) || _looping.Contains(sound))
                            {
                                SignalWarmUpCompletion();
                                return;
                            }
                        }
                    }
                    catch
                    {
                        // ignore
                    }
                    DoWarmUp();
                }
                else
                {
                    EventHandler? handler = null;
                    handler = (_, _) =>
                    {
                        try { player.MediaOpened -= handler; } catch { }
                        RecordDurationIfKnown(sound, player);
                        try
                        {
                            lock (_gate)
                            {
                                if (_playEndSignals.ContainsKey(sound) || _looping.Contains(sound))
                                {
                                    SignalWarmUpCompletion();
                                    return;
                                }
                            }
                        }
                        catch
                        {
                            // ignore
                        }
                        DoWarmUp();
                    };
                    player.MediaOpened += handler;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Sound preload error ({Sound})", sound);
                SignalWarmUpCompletion();
            }
        }

        if (_dispatcher.CheckAccess())
        {
            PreloadOnUiThread();
        }
        else if (warmUp)
        {
            _ = _dispatcher.InvokeAsync((Action)PreloadOnUiThread, DispatcherPriority.Send);
        }
        else
        {
            _ = _dispatcher.BeginInvoke((Action)PreloadOnUiThread, DispatcherPriority.Background);
        }
    }

    public void PreloadImmediate(SoundId sound, bool warmUp = false)
    {
        if (!_sounds.TryGetValue(sound, out var entry))
        {
            return;
        }

        var warmUpSignaled = false;
        void SignalWarmUpCompletion()
        {
            if (!warmUp || warmUpSignaled)
            {
                return;
            }
            warmUpSignaled = true;
            CompleteWarmUp(sound);
        }

        var filePath = ResolveFilePath(sound, entry);
        if (!File.Exists(filePath))
        {
            _logger.LogDebug("Sound file missing: {Path}", filePath);
            SignalWarmUpCompletion();
            return;
        }

        void PreloadNowOnUiThread()
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

                void DoWarmUp()
                {
                    try
                    {
                        player.IsMuted = true;
                        player.Volume = 0;
                        player.Play();
                        player.Stop();
                        player.Position = TimeSpan.Zero;
                    }
                    catch
                    {
                        // ignore
                    }
                    finally
                    {
                        SignalWarmUpCompletion();
                    }
                }

                if (_opened.Contains(sound))
                {
                    RecordDurationIfKnown(sound, player);
                    try
                    {
                        lock (_gate)
                        {
                            if (_playEndSignals.ContainsKey(sound) || _looping.Contains(sound))
                            {
                                SignalWarmUpCompletion();
                                return;
                            }
                        }
                    }
                    catch
                    {
                        // ignore
                    }

                    DoWarmUp();
                    return;
                }

                EventHandler? handler = null;
                handler = (_, _) =>
                {
                    try
                    {
                        lock (_gate)
                        {
                            if (!_players.TryGetValue(sound, out var current) || !ReferenceEquals(current, player))
                            {
                                return;
                            }
                            _playGeneration.TryGetValue(sound, out var gen);
                            if (gen != generationSnapshot)
                            {
                                return;
                            }
                        }

                        player.MediaOpened -= handler;
                        DoWarmUp();
                    }
                    catch
                    {
                        try { player.MediaOpened -= handler; } catch { /* ignore */ }
                        SignalWarmUpCompletion();
                    }
                };

                player.MediaOpened += handler;
            }
            catch
            {
                SignalWarmUpCompletion();
            }
        }

        if (_dispatcher.CheckAccess())
        {
            PreloadNowOnUiThread();
        }
        else
        {
            _dispatcher.Invoke((Action)PreloadNowOnUiThread, DispatcherPriority.Send);
        }
    }
}
