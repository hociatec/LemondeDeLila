using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Audio.Models;
using client_win.Modules.Settings.Services;
using client_win.Core.Constants;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Audio.Services;

public sealed class AppAudioCoordinator : IAppAudioCoordinator
{
    private readonly ISoundService _sounds;
    private readonly IOptionsService? _options;
    private readonly IRemoteSoundCache _remote;
    private readonly ILogger<AppAudioCoordinator> _logger;
    private readonly SemaphoreSlim _transitionLock = new(1, 1);
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    private readonly object _stateGate = new();
    private CancellationTokenSource _transitionCts = new();
    private int _transitionVersion;

    private int _loginSequence;
    private int _logoutSequence;
    private int _appOpenedSequence;
    private int _tavernEnteredSequence;
    private int _connectedSoundPlayedSequence;
    private int _disconnectedSoundPlayedSequence;
    private int _openedSoundPlayedSequence;
    private int _tavernOpenedSoundPlayedSequence;

    private bool _isConnected;
    private long _connectedAtTicks;
    private long _backgroundRequestedAtTicks;
    private AppAudioBackground _desiredBackground = AppAudioBackground.None;
    private AppAudioBackground _appliedBackground = AppAudioBackground.None;
    private int _pauseCount;
    private int _pendingConnectedSound;
    private int _pendingDisconnectedSound;
    private int _pendingOpenedSound;
    private int _pendingTavernOpenedSound;
    private int _pendingReapplyBackground;

    // ClickOnce peut relancer le client pendant une mise à jour et démarrer un nouveau process
    // dans un autre dossier "Apps\\2.0". On supprime le son d'ouverture sur cette relance uniquement.
    private static readonly TimeSpan StartupSoundDebounceWindow = TimeSpan.FromMinutes(2);

    public AppAudioCoordinator(
        ISoundService sounds,
        IOptionsService? options,
        IRemoteSoundCache remote,
        ILogger<AppAudioCoordinator> logger)
    {
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _options = options;
        _remote = remote ?? throw new ArgumentNullException(nameof(remote));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Best-effort: prefetch remote sounds early so latest overrides are available ASAP.
        _ = Task.Run(async () =>
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await RefreshRemoteSoundsAsync(force: false, reapplyBackground: false, cts.Token).ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
        });

        // Reduce first-play latency for common backgrounds (placeholders or admin overrides).
        TryPreload(SoundId.MainMenuMusic, warmUp: true);
        TryPreload(SoundId.TavernAmbience, warmUp: true);
        TryPreload(SoundId.TavernOpened, warmUp: true);
        // Reduce first-play latency for table one-shots.
        TryPreload(SoundId.RoomOpened, warmUp: true);
        TryPreload(SoundId.RoomJoined, warmUp: true);
        // Reduce first-play latency for common gameplay one-shots (notably quiz feedback).
        TryPreload(SoundId.DiceRolled, warmUp: true);
        TryPreload(SoundId.QuizCorrect, warmUp: true);
        TryPreload(SoundId.QuizWrong, warmUp: true);
        // Reduce first-play latency for connection sounds (critical feedback).
        TryPreload(SoundId.ClientConnected, warmUp: true);
        TryPreload(SoundId.ClientDisconnected, warmUp: true);

        if (_options != null)
        {
            _options.Changed += (_, _) => RequestTransition();
        }
    }

    private static string GetStartupSoundMarkerPath()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "audio");
        Directory.CreateDirectory(appDataPath);
        return Path.Combine(appDataPath, "startup-sound.last");
    }

    private bool ShouldSuppressStartupSound()
    {
        try
        {
            var markerPath = GetStartupSoundMarkerPath();
            if (!File.Exists(markerPath))
            {
                return false;
            }

            var text = File.ReadAllText(markerPath).Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                return false;
            }

            // Format (v2): "{utc:O}|{pid}|{baseDir}"
            // Format (v1): "{utc:O}|{baseDir}"
            var parts = text.Split('|');
            var tsPart = parts.Length > 0 ? parts[0] : text;
            var pidPart = parts.Length > 2 ? parts[1] : null;
            var baseDirPart = parts.Length > 2 ? parts[2] : (parts.Length > 1 ? parts[1] : null);

            if (DateTime.TryParse(tsPart, out var lastUtc))
            {
                if (lastUtc.Kind == DateTimeKind.Unspecified)
                {
                    lastUtc = DateTime.SpecifyKind(lastUtc, DateTimeKind.Utc);
                }
                var age = DateTime.UtcNow - lastUtc.ToUniversalTime();

                if (!(age >= TimeSpan.Zero && age < StartupSoundDebounceWindow))
                {
                    return false;
                }

                // Ne supprimer que si on a bien changé de dossier d'exécution (cas ClickOnce update/restart).
                if (!string.IsNullOrWhiteSpace(baseDirPart))
                {
                    var currentBaseDir = AppContext.BaseDirectory ?? string.Empty;
                    if (string.Equals(baseDirPart, currentBaseDir, StringComparison.OrdinalIgnoreCase))
                    {
                        return false;
                    }

                    // Ne supprimer que si l'ancien process est encore en vie (cas ClickOnce update/restart).
                    if (!string.IsNullOrWhiteSpace(pidPart) && int.TryParse(pidPart, out var pid))
                    {
                        if (pid == Environment.ProcessId)
                        {
                            return false;
                        }

                        try
                        {
                            var p = Process.GetProcessById(pid);
                            return p != null && !p.HasExited;
                        }
                        catch
                        {
                            return false;
                        }
                    }

                    // Ancien format (sans pid): best-effort, ne pas supprimer par défaut.
                    return false;
                }

                // Ancien format (sans baseDir) : best-effort, on ne supprime pas par défaut.
                return false;
            }
        }
        catch
        {
            // best-effort
        }

        return false;
    }

    private void MarkStartupSoundAttempt()
    {
        try
        {
            var markerPath = GetStartupSoundMarkerPath();
            var content = $"{DateTime.UtcNow:O}|{Environment.ProcessId}|{AppContext.BaseDirectory}";
            File.WriteAllText(markerPath, content);
        }
        catch
        {
            // best-effort
        }
    }

    public void NotifyAppOpened()
    {
        var shouldTransition = false;
        lock (_stateGate)
        {
            // One-shot at application startup: ignore redundant calls.
            if (_pendingOpenedSound == 1 || _appOpenedSequence > 0)
            {
                return;
            }

            // ClickOnce peut relancer le client très vite (update/restart) : éviter de rejouer le son d'ouverture
            // plusieurs fois de suite, ce que l'utilisateur perçoit comme "plusieurs sons au lancement".
            if (ShouldSuppressStartupSound())
            {
                try { _logger.LogInformation("Audio: suppress ClientOpened (recent restart detected)"); } catch { /* ignore */ }
                _appOpenedSequence = 1;
                _pendingOpenedSound = 0;
                return;
            }

            _appOpenedSequence = 1;
            _pendingOpenedSound = 1;
            shouldTransition = true;
        }

        MarkStartupSoundAttempt();
        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void NotifyLoginSucceeded()
    {
        var shouldTransition = false;
        var skipOpenedSeq = 0;
        var loginSeq = 0;
        lock (_stateGate)
        {
            // Redundant login: ignore (prevents double "connected" sound).
            if (_isConnected)
            {
                return;
            }

            _isConnected = true;
            _connectedAtTicks = Stopwatch.GetTimestamp();
            _loginSequence++;
            loginSeq = _loginSequence;
            _pendingConnectedSound = 1;

            // If the user connects before the startup transition had time to play the launch sound,
            // don't play it later (it would feel "out of order" and can cause perceived audio spam).
            if (_pendingOpenedSound == 1 &&
                _appOpenedSequence > 0 &&
                Volatile.Read(ref _openedSoundPlayedSequence) == 0)
            {
                _pendingOpenedSound = 0;
                skipOpenedSeq = _appOpenedSequence;
            }
            shouldTransition = true;
        }

        try { _logger.LogInformation("Audio: login succeeded (seq={Seq}) -> ClientConnected one-shot", loginSeq); } catch { /* ignore */ }

        if (skipOpenedSeq != 0)
        {
            Volatile.Write(ref _openedSoundPlayedSequence, skipOpenedSeq);
        }

        if (shouldTransition)
        {
            RequestTransition();
        }

        // If the user connects quickly, wait for the launch sound to finish before playing ClientConnected.
        try
        {
            _logger.LogInformation("Audio: login succeeded, deferring ClientConnected until ClientOpened ends");
        }
        catch
        {
            // ignore
        }

        _ = WarmRefreshAfterLoginAsync();

        // Failsafe: if rapid navigation/overlays cancel transitions, ensure the connection one-shot still plays.
        // This keeps login feedback reliable even if background audio is paused or transitions are superseded.
        _ = Task.Run(async () =>
        {
            try { await Task.Delay(1200).ConfigureAwait(false); } catch { return; }

            try
            {
                bool shouldPlay;
                lock (_stateGate)
                {
                    shouldPlay = _isConnected &&
                                 _pendingConnectedSound == 1 &&
                                 _loginSequence == loginSeq &&
                                 loginSeq != Volatile.Read(ref _connectedSoundPlayedSequence);
                    if (shouldPlay)
                    {
                        _pendingConnectedSound = 0;
                    }
                }

                if (!shouldPlay)
                {
                    return;
                }

                // Best-effort: do not block on remote refresh here.
                TryPlay(SoundId.ClientConnected);
                Volatile.Write(ref _connectedSoundPlayedSequence, loginSeq);
            }
            catch
            {
                // ignore
            }
        });
    }

    public void NotifyLogoutRequested()
    {
        var shouldTransition = false;
        var logoutSeq = 0;
        lock (_stateGate)
        {
            // Redundant logout: ignore (prevents double "disconnected" sound).
            if (!_isConnected && _pendingDisconnectedSound == 0)
            {
                return;
            }

            _isConnected = false;
            _desiredBackground = AppAudioBackground.None;
            _logoutSequence++;
            logoutSeq = _logoutSequence;
            _pendingDisconnectedSound = 1;
            shouldTransition = true;
        }

        try { _logger.LogInformation("Audio: logout requested (seq={Seq}) -> ClientDisconnected one-shot", logoutSeq); } catch { /* ignore */ }

        // Feedback immédiat de déconnexion (hors machine à états des transitions).
        try { StopBackgroundLoopsImmediate(); } catch { }
        TryPlay(SoundId.ClientDisconnected);
        lock (_stateGate)
        {
            if (_logoutSequence == logoutSeq)
            {
                _pendingDisconnectedSound = 0;
                Volatile.Write(ref _disconnectedSoundPlayedSequence, logoutSeq);
            }
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void NotifyTavernEntered()
    {
        TryPreload(SoundId.TavernOpened, warmUp: true);
        TryPreload(SoundId.TavernAmbience, warmUp: true);

        var shouldTransition = false;
        lock (_stateGate)
        {
            // Redundant event: ignore while already in tavern background.
            if (_desiredBackground == AppAudioBackground.Tavern && _pendingTavernOpenedSound == 0)
            {
                return;
            }

            _tavernEnteredSequence++;
            _pendingTavernOpenedSound = 1;
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void SetBackground(AppAudioBackground background)
    {
        if (background == AppAudioBackground.MainMenu)
        {
            TryPreload(SoundId.MainMenuMusic, warmUp: true);
        }
        else if (background == AppAudioBackground.Tavern)
        {
            TryPreload(SoundId.TavernAmbience, warmUp: true);
            TryPreload(SoundId.TavernOpened, warmUp: true);
        }

        var shouldTransition = false;
        lock (_stateGate)
        {
            if (_desiredBackground == background)
            {
                return;
            }

            _desiredBackground = background;
            _backgroundRequestedAtTicks = Stopwatch.GetTimestamp();
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void PauseBackground()
    {
        var shouldTransition = false;
        lock (_stateGate)
        {
            _pauseCount++;
            shouldTransition = true;
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public void ResumeBackground()
    {
        var shouldTransition = false;
        lock (_stateGate)
        {
            if (_pauseCount > 0)
            {
                _pauseCount--;
                shouldTransition = true;
            }
        }

        if (shouldTransition)
        {
            RequestTransition();
        }
    }

    public async Task RefreshRemoteSoundsAsync(bool force, bool reapplyBackground, CancellationToken cancellationToken = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            await _refreshLock.WaitAsync(linked.Token).ConfigureAwait(false);
        }
        catch
        {
            return;
        }

        try
        {
            await _remote.RefreshAsync(force: force, cancellationToken: linked.Token).ConfigureAwait(false);

            // If admin overrides were downloaded, preload them so the next Play/StartLoop is immediate.
            TryPreload(SoundId.MainMenuMusic, warmUp: true);
            TryPreload(SoundId.TavernAmbience, warmUp: true);
            TryPreload(SoundId.TavernOpened, warmUp: true);
            TryPreload(SoundId.ClientConnected, warmUp: true);
            TryPreload(SoundId.ClientDisconnected, warmUp: true);
            // Table one-shots: preload early so "RoomOpened/Joined" feels instant when opening a table.
            TryPreload(SoundId.RoomOpened, warmUp: true);
            TryPreload(SoundId.RoomJoined, warmUp: true);
            // Gameplay one-shots: avoid first-action latency after joining a table.
            TryPreload(SoundId.DiceRolled, warmUp: true);
            TryPreload(SoundId.QuizCorrect, warmUp: true);
            TryPreload(SoundId.QuizWrong, warmUp: true);

            if (reapplyBackground)
            {
                lock (_stateGate)
                {
                    _pendingReapplyBackground = 1;
                }
                RequestTransition();
            }
        }
        catch (OperationCanceledException)
        {
            // ignore
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Remote sound refresh failed");
        }
        finally
        {
            try { _refreshLock.Release(); } catch { /* ignore */ }
        }
    }

    public async Task PlayDisconnectAndWaitAsync(TimeSpan timeout)
    {
        try
        {
            StopBackgroundLoopsImmediate();
        }
        catch
        {
            // ignore
        }

        // Ensure latest admin overrides are applied before playing the sound.
        try
        {
            using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }

        try
        {
            _sounds.Play(SoundId.ClientDisconnected);
        }
        catch
        {
            // ignore
        }

        try
        {
            var wait = GetSoundWaitTimeout(
                SoundId.ClientDisconnected,
                timeout > TimeSpan.Zero ? timeout : TimeSpan.FromSeconds(8));
            await _sounds.WaitForSoundToEndAsync(SoundId.ClientDisconnected, wait).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    public async Task PlayClosingAndWaitAsync(TimeSpan timeout)
    {
        try
        {
            StopBackgroundLoops();
        }
        catch
        {
            // ignore
        }

        // Ensure latest admin overrides are applied before playing the sound.
        try
        {
            using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }

        try
        {
            _sounds.Play(SoundId.ClientClosing);
        }
        catch
        {
            // ignore
        }

        try
        {
            var wait = GetSoundWaitTimeout(
                SoundId.ClientClosing,
                timeout > TimeSpan.Zero ? timeout : TimeSpan.FromSeconds(8));
            await _sounds.WaitForSoundToEndAsync(SoundId.ClientClosing, wait).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    private void RequestTransition()
    {
        CancellationToken token;
        int version;
        lock (_stateGate)
        {
            version = ++_transitionVersion;
            try { _transitionCts.Cancel(); } catch { /* ignore */ }
            try { _transitionCts.Dispose(); } catch { /* ignore */ }
            _transitionCts = new CancellationTokenSource();
            token = _transitionCts.Token;
        }

        _ = TransitionAsync(version, token);
    }

    private async Task WarmRefreshAfterLoginAsync()
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(12));
            await RefreshRemoteSoundsAsync(force: false, reapplyBackground: true, cts.Token).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    private async Task TransitionAsync(int version, CancellationToken token)
    {
        try
        {
            await _transitionLock.WaitAsync(token).ConfigureAwait(false);
        }
        catch
        {
            return;
        }

        try
        {
            bool isConnected;
            long connectedAtTicks;
            AppAudioBackground desiredBackground;
            int pauseCount;
            bool playConnected;
            bool playDisconnected;
            bool playOpened;
            bool playTavernOpened;
            bool reapplyBackground;
            int loginSeq;
            int logoutSeq;
            int openedSeq;
            int tavernSeq;
            long backgroundRequestedAtTicks;

            lock (_stateGate)
            {
                isConnected = _isConnected;
                connectedAtTicks = _connectedAtTicks;
                desiredBackground = _desiredBackground;
                pauseCount = _pauseCount;
                playConnected = _pendingConnectedSound == 1;
                playDisconnected = _pendingDisconnectedSound == 1;
                loginSeq = _loginSequence;
                logoutSeq = _logoutSequence;
                playOpened = _pendingOpenedSound == 1;
                playTavernOpened = _pendingTavernOpenedSound == 1;
                openedSeq = _appOpenedSequence;
                tavernSeq = _tavernEnteredSequence;
                backgroundRequestedAtTicks = _backgroundRequestedAtTicks;
                reapplyBackground = _pendingReapplyBackground == 1;
            }

            if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
            {
                return;
            }

            try
            {
                _sounds.SetConnected(isConnected);
            }
            catch
            {
                // ignore
            }

            // Application launch sound is independent of connection state.
            if (playOpened && openedSeq != Volatile.Read(ref _openedSoundPlayedSequence))
            {
                TryPlay(SoundId.ClientOpened);
                lock (_stateGate)
                {
                    _pendingOpenedSound = 0;
                }
                Volatile.Write(ref _openedSoundPlayedSequence, openedSeq);

                // Once the launch sound has finished, re-run transitions so background loops (if any)
                // can start without ever playing before the launch sound.
                _ = Task.Run(async () =>
                {
                    try { await _sounds.WaitForSoundToEndAsync(SoundId.ClientOpened, TimeSpan.FromSeconds(15)).ConfigureAwait(false); } catch { /* ignore */ }
                    try { RequestTransition(); } catch { /* ignore */ }
                });

                // Refresh remote sounds after playing the launch sound.
                // This keeps startup audio deterministic and avoids delaying it (or letting a fallback gate open).
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                        await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
                    }
                    catch
                    {
                        // ignore
                    }
                });
            }

            if (!isConnected)
            {
                StopBackgroundLoops();
                _appliedBackground = AppAudioBackground.None;
                if (playDisconnected && logoutSeq != Volatile.Read(ref _disconnectedSoundPlayedSequence))
                {
                    try
                    {
                        StopBackgroundLoopsImmediate();
                    }
                    catch
                    {
                        // ignore
                    }

                    TryPlay(SoundId.ClientDisconnected);

                    lock (_stateGate)
                    {
                        _pendingDisconnectedSound = 0;
                    }
                    Volatile.Write(ref _disconnectedSoundPlayedSequence, logoutSeq);
                }
                return;
            }

            // Login succeeded: refresh remote sounds quickly so the "connected" sound can use the admin override.
            // IMPORTANT: this one-shot should play even if background audio is currently paused (e.g. during startup/login overlays).
            if (playConnected && loginSeq != Volatile.Read(ref _connectedSoundPlayedSequence))
            {
                try
                {
                    StopBackgroundLoopsImmediate();
                    _appliedBackground = AppAudioBackground.None;
                }
                catch
                {
                    // ignore
                }

                TryPlay(SoundId.ClientConnected);
                try { _sounds.Stop(SoundId.ClientOpened); } catch { /* ignore */ }

                lock (_stateGate)
                {
                    _pendingConnectedSound = 0;
                }
                Volatile.Write(ref _connectedSoundPlayedSequence, loginSeq);

                // Refresh again after playing to keep cache warm, without blocking transitions.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                        await RefreshRemoteSoundsAsync(force: false, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
                    }
                    catch
                    {
                        // ignore
                    }
                });
            }

            if (pauseCount > 0)
            {
                StopBackgroundLoops();
                _appliedBackground = AppAudioBackground.None;
                return;
            }

            // Background loops now start immediately once connected; we no longer gate them behind fixed timers.
            if (desiredBackground == AppAudioBackground.None)
            {
                StopBackgroundLoops();
                _appliedBackground = AppAudioBackground.None;
                return;
            }

            // Continue immediately to apply background loops.
            if (_appliedBackground == desiredBackground && !reapplyBackground)
            {
                return;
            }

            StopBackgroundLoops();
            _appliedBackground = AppAudioBackground.None;
            if (reapplyBackground)
            {
                lock (_stateGate)
                {
                    _pendingReapplyBackground = 0;
                }
            }

            // One-shot on entering the tavern (played before the ambience loop).
            if (desiredBackground == AppAudioBackground.Tavern &&
                playTavernOpened &&
                tavernSeq != Volatile.Read(ref _tavernOpenedSoundPlayedSequence))
            {
                TryPlay(SoundId.TavernOpened);
                lock (_stateGate)
                {
                    _pendingTavernOpenedSound = 0;
                }
                Volatile.Write(ref _tavernOpenedSoundPlayedSequence, tavernSeq);

                // Give the one-shot a tiny head start to avoid being masked by the loop.
                try { await Task.Delay(200, token).ConfigureAwait(false); } catch { return; }
                if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
                {
                    return;
                }
            }

            switch (desiredBackground)
            {
                case AppAudioBackground.MainMenu:
                    _sounds.StartLoop(SoundId.MainMenuMusic);
                    _appliedBackground = desiredBackground;
                    break;
                case AppAudioBackground.Tavern:
                    _sounds.StartLoop(SoundId.TavernAmbience);
                    _appliedBackground = desiredBackground;
                    break;
            }
        }
        catch (OperationCanceledException)
        {
            // ignore
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Audio transition failed");
        }
        finally
        {
            try { _transitionLock.Release(); } catch { /* ignore */ }
        }
    }

    private void StopBackgroundLoops()
    {
        _sounds.StopLoop(SoundId.MainMenuMusic);
        _sounds.StopLoop(SoundId.TavernAmbience);
    }

    private void StopBackgroundLoopsImmediate()
    {
        _sounds.StopLoopImmediate(SoundId.MainMenuMusic);
        _sounds.StopLoopImmediate(SoundId.TavernAmbience);
    }

    private void TryPreload(SoundId sound, bool warmUp = false)
    {
        try { _sounds.Preload(sound, warmUp: warmUp); } catch { /* ignore */ }
    }

    private void TryPlay(SoundId sound)
    {
        try { _sounds.Play(sound); } catch { /* ignore */ }
    }

    private TimeSpan GetSoundWaitTimeout(SoundId sound, TimeSpan fallback)
    {
        try
        {
            var duration = _sounds.TryGetSoundDuration(sound);
            if (duration.HasValue && duration.Value > TimeSpan.Zero)
            {
                var wait = duration.Value + TimeSpan.FromMilliseconds(400);
                return wait < TimeSpan.FromMilliseconds(300)
                    ? TimeSpan.FromMilliseconds(300)
                    : wait;
            }
        }
        catch
        {
            // ignore
        }

        return fallback;
    }

}
