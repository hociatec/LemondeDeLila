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

    private sealed record OneShotRequest(SoundId Sound, int Priority, TimeSpan Timeout, TaskCompletionSource<bool> Completion);
    private readonly LinkedList<OneShotRequest> _oneShotQueue = new();
    private readonly object _oneShotGate = new();
    private OneShotRequest? _currentOneShot;
    private CancellationTokenSource? _oneShotCts;
    private bool _oneShotProcessorRunning;
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
    private long _lastDisconnectedSoundAtTicks;
    private long _backgroundRequestedAtTicks;
    private AppAudioBackground _desiredBackground = AppAudioBackground.None;
    private AppAudioBackground _appliedBackground = AppAudioBackground.None;
    private int _pauseCount;
    private int _pendingConnectedSound;
    private int _pendingDisconnectedSound;
    private int _pendingOpenedSound;
    private int _pendingTavernOpenedSound;
    private int _pendingReapplyBackground;
    private Task? _pendingConnectedOneShot;
    private Task? _pendingDisconnectedOneShot;

    // ClickOnce peut relancer le client pendant une mise à jour et démarrer un nouveau process
    // dans un autre dossier "Apps\\2.0". On supprime le son d'ouverture sur cette relance uniquement.
    private static readonly TimeSpan StartupSoundDebounceWindow = TimeSpan.FromMinutes(2);
    private static readonly long DefaultDuplicateLoginSuppressTicks = Stopwatch.Frequency * 2;
    private static readonly long DefaultDisconnectSuppressTicks = Stopwatch.Frequency * 2;

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

        _ = ScheduleOneShotAsync(
            SoundId.ClientOpened,
            priority: 1,
            GetSoundWaitTimeout(SoundId.ClientOpened, TimeSpan.FromSeconds(15)));
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
                var now = Stopwatch.GetTimestamp();
                var elapsed = _connectedAtTicks > 0 ? now - _connectedAtTicks : long.MaxValue;
                if (elapsed >= 0 && elapsed < GetDuplicateLoginSuppressTicks())
                {
                    return;
                }
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

        // Allow login sound to overlap with existing audio (startup/menu).

        // If a disconnect one-shot is still queued/playing, cancel it to ensure the login feedback is audible.
        CancelOneShots(SoundId.ClientDisconnected);
        ClearPendingDisconnectedOneShot();
        try { _sounds.Stop(SoundId.ClientDisconnected); } catch { /* ignore */ }
        lock (_stateGate)
        {
            _pendingDisconnectedSound = 0;
        }

        var connectedOneShot = TrackPendingConnectedOneShot(
            PlaySystemOneShotAsync(
                SoundId.ClientConnected,
                GetSoundWaitTimeout(SoundId.ClientConnected, TimeSpan.FromSeconds(10))));
        _ = connectedOneShot.ContinueWith(_ =>
        {
            lock (_stateGate)
            {
                if (_loginSequence == loginSeq)
                {
                    _pendingConnectedSound = 0;
                    Volatile.Write(ref _connectedSoundPlayedSequence, loginSeq);
                }
            }
        }, TaskScheduler.Default);

        if (shouldTransition)
        {
            RequestTransition();
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

                if (HasPendingConnectedOneShot())
                {
                    Volatile.Write(ref _connectedSoundPlayedSequence, loginSeq);
                    return;
                }

                _ = TrackPendingConnectedOneShot(
                    PlaySystemOneShotAsync(
                        SoundId.ClientConnected,
                        GetSoundWaitTimeout(SoundId.ClientConnected, TimeSpan.FromSeconds(10))));
                Volatile.Write(ref _connectedSoundPlayedSequence, loginSeq);
            }
            catch
            {
                // ignore
            }
        });
    }

    public void NotifyLogoutRequested() => HandleDisconnect(userInitiated: true);

    public void NotifyDisconnected() => HandleDisconnect(userInitiated: false);

    private void HandleDisconnect(bool userInitiated)
    {
        var shouldTransition = false;
        var logoutSeq = 0;
        lock (_stateGate)
        {
            // If a disconnect sound is already pending, avoid scheduling another.
            if (_pendingDisconnectedSound != 0)
            {
                _isConnected = false;
                _desiredBackground = AppAudioBackground.None;
                return;
            }

            _isConnected = false;
            _desiredBackground = AppAudioBackground.None;
            _logoutSequence++;
            logoutSeq = _logoutSequence;
            _pendingDisconnectedSound = 1;
            shouldTransition = true;
        }

        // Allow login and disconnect sounds to overlap: do not stop ClientConnected here.

        if (ShouldSuppressDisconnectSound())
        {
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

            return;
        }

        try
        {
            var reason = userInitiated ? "logout" : "network";
            _logger.LogInformation("Audio: disconnect requested ({Reason}, seq={Seq}) -> ClientDisconnected one-shot", reason, logoutSeq);
        }
        catch { /* ignore */ }

        // Feedback immédiat de déconnexion (hors machine à états des transitions).
        try { StopBackgroundLoopsImmediate(); } catch { }
        TrackPendingDisconnectedOneShot(
            PlaySystemOneShotAsync(
                SoundId.ClientDisconnected,
                GetSoundWaitTimeout(SoundId.ClientDisconnected, TimeSpan.FromSeconds(8))));
        lock (_stateGate)
        {
            if (_logoutSequence == logoutSeq)
            {
                _pendingDisconnectedSound = 0;
                Volatile.Write(ref _disconnectedSoundPlayedSequence, logoutSeq);
            }
        }

        ClearPendingConnectedOneShot();

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

        var wait = GetSoundWaitTimeout(
            SoundId.ClientDisconnected,
            timeout > TimeSpan.Zero ? timeout : TimeSpan.FromSeconds(8));
        Task disconnectTask;
        var existing = GetPendingDisconnectedOneShot();
        if (existing != null)
        {
            disconnectTask = existing;
        }
        else
        {
            if (ShouldSuppressDisconnectSound())
            {
                return;
            }
            disconnectTask = TrackPendingDisconnectedOneShot(
                PlaySystemOneShotAsync(SoundId.ClientDisconnected, wait));
        }

        try
        {
            var delay = Task.Delay(timeout > TimeSpan.Zero ? timeout : TimeSpan.FromSeconds(8));
            var completed = await Task.WhenAny(disconnectTask, delay).ConfigureAwait(false);
            if (completed == disconnectTask)
            {
                await disconnectTask.ConfigureAwait(false);
            }
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

        var wait = GetSoundWaitTimeout(
            SoundId.ClientClosing,
            timeout > TimeSpan.Zero ? timeout : TimeSpan.FromSeconds(8));
        try
        {
            await PlaySystemOneShotAsync(SoundId.ClientClosing, wait).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }

        // Best-effort: refresh remote sounds after playing (non-blocking).
        _ = Task.Run(async () =>
        {
            try
            {
                using var refreshCts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                await RefreshRemoteSoundsAsync(force: true, reapplyBackground: false, refreshCts.Token).ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }
        });
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
                lock (_stateGate)
                {
                    _pendingOpenedSound = 0;
                }
                Volatile.Write(ref _openedSoundPlayedSequence, openedSeq);

                _ = Task.Run(async () =>
                {
                    try { await _sounds.WaitForSoundToEndAsync(SoundId.ClientOpened, TimeSpan.FromSeconds(15)).ConfigureAwait(false); } catch { /* ignore */ }
                    try { RequestTransition(); } catch { /* ignore */ }
                });

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
                lock (_stateGate)
                {
                    _pendingConnectedSound = 0;
                }
                Volatile.Write(ref _connectedSoundPlayedSequence, loginSeq);

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

            // Allow background loops to start soon after login,
            // but give the "connected" one-shot a short head start to stay audible.

            if (pauseCount > 0)
            {
                StopBackgroundLoops();
                _appliedBackground = AppAudioBackground.None;
                return;
            }

            // Background loops now start immediately once connected (with a short login one-shot grace period).
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

            // If the login one-shot is still playing, wait briefly before starting loops.
            // This prevents the menu ambience from masking the connection feedback.
            try
            {
                await DelayForConnectedSoundAsync(token).ConfigureAwait(false);
            }
            catch
            {
                return;
            }
            if (token.IsCancellationRequested || version != Volatile.Read(ref _transitionVersion))
            {
                return;
            }

            // One-shot on entering the tavern (played before the ambience loop).
                if (desiredBackground == AppAudioBackground.Tavern &&
                    playTavernOpened &&
                    tavernSeq != Volatile.Read(ref _tavernOpenedSoundPlayedSequence))
                {
                    _ = ScheduleOneShotAsync(
                        SoundId.TavernOpened,
                        priority: 2,
                        GetSoundWaitTimeout(SoundId.TavernOpened, TimeSpan.FromSeconds(5)));
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

    private Task ScheduleOneShotAsync(SoundId sound, int priority, TimeSpan timeout, bool allowDuplicate = false)
    {
        var request = new OneShotRequest(sound, priority, timeout, new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously));
        lock (_oneShotGate)
        {
            if (!allowDuplicate)
            {
                var existing = TryFindScheduledOneShot(sound);
                if (existing != null)
                {
                    return existing;
                }
            }
            var node = _oneShotQueue.First;
            while (node != null && node.Value.Priority <= priority)
            {
                node = node.Next;
            }
            if (node == null)
            {
                _oneShotQueue.AddLast(request);
            }
            else
            {
                _oneShotQueue.AddBefore(node, request);
            }

            if (!_oneShotProcessorRunning)
            {
                _oneShotProcessorRunning = true;
                _ = ProcessOneShotsAsync();
            }

            if (_currentOneShot != null && priority < _currentOneShot.Priority)
            {
                _oneShotCts?.Cancel();
            }
        }
        return request.Completion.Task;
    }

    private Task TrackPendingConnectedOneShot(Task task)
    {
        lock (_stateGate)
        {
            _pendingConnectedOneShot = task;
        }
        _ = task.ContinueWith(t =>
        {
            _ = t.Exception;
            lock (_stateGate)
            {
                if (ReferenceEquals(_pendingConnectedOneShot, t))
                {
                    _pendingConnectedOneShot = null;
                }
            }
        }, TaskScheduler.Default);
        return task;
    }

    private Task TrackPendingDisconnectedOneShot(Task task)
    {
        lock (_stateGate)
        {
            _pendingDisconnectedOneShot = task;
        }
        _ = task.ContinueWith(t =>
        {
            _ = t.Exception;
            lock (_stateGate)
            {
                if (ReferenceEquals(_pendingDisconnectedOneShot, t))
                {
                    _pendingDisconnectedOneShot = null;
                }
            }
        }, TaskScheduler.Default);
        return task;
    }

    private bool HasPendingConnectedOneShot()
    {
        lock (_stateGate)
        {
            return _pendingConnectedOneShot != null && !_pendingConnectedOneShot.IsCompleted;
        }
    }

    private Task? GetPendingDisconnectedOneShot()
    {
        lock (_stateGate)
        {
            if (_pendingDisconnectedOneShot != null && !_pendingDisconnectedOneShot.IsCompleted)
            {
                return _pendingDisconnectedOneShot;
            }
            return null;
        }
    }

    private void ClearPendingConnectedOneShot()
    {
        lock (_stateGate)
        {
            _pendingConnectedOneShot = null;
        }
    }

    private void ClearPendingDisconnectedOneShot()
    {
        lock (_stateGate)
        {
            _pendingDisconnectedOneShot = null;
        }
    }

    private void CancelOneShots(SoundId sound)
    {
        lock (_oneShotGate)
        {
            var node = _oneShotQueue.First;
            while (node != null)
            {
                var next = node.Next;
                if (node.Value.Sound == sound)
                {
                    try { node.Value.Completion.TrySetCanceled(); } catch { /* ignore */ }
                    _oneShotQueue.Remove(node);
                }
                node = next;
            }

            if (_currentOneShot?.Sound == sound)
            {
                _oneShotCts?.Cancel();
            }
        }
    }

    private Task? TryFindScheduledOneShot(SoundId sound)
    {
        if (_currentOneShot?.Sound == sound && !_currentOneShot.Completion.Task.IsCompleted)
        {
            return _currentOneShot.Completion.Task;
        }
        foreach (var pending in _oneShotQueue)
        {
            if (pending.Sound == sound && !pending.Completion.Task.IsCompleted)
            {
                return pending.Completion.Task;
            }
        }
        return null;
    }

    private async Task ProcessOneShotsAsync()
    {
        while (true)
        {
            OneShotRequest request;
            lock (_oneShotGate)
            {
                if (_oneShotQueue.Count == 0)
                {
                    _oneShotProcessorRunning = false;
                    return;
                }
                var node = _oneShotQueue.First;
                if (node == null)
                {
                    _oneShotProcessorRunning = false;
                    return;
                }
                request = node.Value;
                _oneShotQueue.RemoveFirst();
                _currentOneShot = request;
                _oneShotCts?.Dispose();
                _oneShotCts = new CancellationTokenSource();
            }

            try
            {
                _sounds.Play(request.Sound);
                await _sounds.WaitForSoundToEndAsync(
                    request.Sound,
                    request.Timeout,
                    _oneShotCts.Token).ConfigureAwait(false);
                request.Completion.TrySetResult(true);
            }
            catch (OperationCanceledException)
            {
                request.Completion.TrySetCanceled();
            }
            catch
            {
                request.Completion.TrySetResult(true);
            }
            finally
            {
                lock (_oneShotGate)
                {
                    if (ReferenceEquals(_currentOneShot, request))
                    {
                        _currentOneShot = null;
                        try { _oneShotCts?.Dispose(); } catch { /* ignore */ }
                        _oneShotCts = null;
                    }
                }
            }
        }
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

    private async Task DelayForConnectedSoundAsync(CancellationToken token)
    {
        Task? pending;
        lock (_stateGate)
        {
            pending = _pendingConnectedOneShot;
        }

        if (pending == null || pending.IsCompleted)
        {
            return;
        }

        var wait = GetConnectedSoundGateTimeout();
        try
        {
            await Task.WhenAny(pending, Task.Delay(wait, token)).ConfigureAwait(false);
        }
        catch
        {
            // ignore
        }
    }

    private long GetDuplicateLoginSuppressTicks()
    {
        try
        {
            var duration = _sounds.TryGetSoundDuration(SoundId.ClientConnected);
            if (duration.HasValue && duration.Value > TimeSpan.Zero)
            {
                var baseTicks = (long)Math.Round(duration.Value.TotalSeconds * Stopwatch.Frequency);
                var extraTicks = Stopwatch.Frequency / 4; // ~250ms guard
                var minTicks = Stopwatch.Frequency / 2; // ~500ms
                var maxTicks = Stopwatch.Frequency * 4; // ~4s
                var computed = baseTicks + extraTicks;
                if (computed < minTicks)
                {
                    return minTicks;
                }
                if (computed > maxTicks)
                {
                    return maxTicks;
                }
                return computed;
            }
        }
        catch
        {
            // ignore
        }

        return DefaultDuplicateLoginSuppressTicks;
    }

    private Task PlaySystemOneShotAsync(SoundId sound, TimeSpan timeout)
    {
        if (sound != SoundId.ClientConnected)
        {
            CancelOneShots(sound);
            try { _sounds.Stop(sound); } catch { /* ignore */ }
        }

        try
        {
            _sounds.Play(sound);
        }
        catch
        {
            return Task.CompletedTask;
        }

        return _sounds.WaitForSoundToEndAsync(sound, timeout);
    }

    private bool ShouldSuppressDisconnectSound()
    {
        try
        {
            var now = Stopwatch.GetTimestamp();
            var last = Volatile.Read(ref _lastDisconnectedSoundAtTicks);
            var minTicks = GetDisconnectSuppressTicks();
            if (last > 0 && now - last >= 0 && now - last < minTicks)
            {
                return true;
            }

            Volatile.Write(ref _lastDisconnectedSoundAtTicks, now);
        }
        catch
        {
            // ignore
        }

        return false;
    }

    private long GetDisconnectSuppressTicks()
    {
        try
        {
            var duration = _sounds.TryGetSoundDuration(SoundId.ClientDisconnected);
            if (duration.HasValue && duration.Value > TimeSpan.Zero)
            {
                var baseTicks = (long)Math.Round(duration.Value.TotalSeconds * Stopwatch.Frequency);
                var extraTicks = Stopwatch.Frequency / 4; // ~250ms guard
                var minTicks = Stopwatch.Frequency; // ~1s
                var maxTicks = Stopwatch.Frequency * 5; // ~5s
                var computed = baseTicks + extraTicks;
                if (computed < minTicks)
                {
                    return minTicks;
                }
                if (computed > maxTicks)
                {
                    return maxTicks;
                }
                return computed;
            }
        }
        catch
        {
            // ignore
        }

        return DefaultDisconnectSuppressTicks;
    }

    private TimeSpan GetConnectedSoundGateTimeout()
    {
        try
        {
            var duration = _sounds.TryGetSoundDuration(SoundId.ClientConnected);
            if (duration.HasValue && duration.Value > TimeSpan.Zero)
            {
                var wait = duration.Value + TimeSpan.FromMilliseconds(250);
                if (wait < TimeSpan.FromMilliseconds(500))
                {
                    return TimeSpan.FromMilliseconds(500);
                }
                if (wait > TimeSpan.FromSeconds(4))
                {
                    return TimeSpan.FromSeconds(4);
                }
                return wait;
            }
        }
        catch
        {
            // ignore
        }

        return TimeSpan.FromSeconds(3);
    }

}
